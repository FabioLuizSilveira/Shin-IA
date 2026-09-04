import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mapEnvelopeStatus, mapWebhookEventType } from "./clicksign-status-mapper.js";
import type {
  CanonicalSignatureEvent,
  CreateSignatureRequestInput,
  ProviderArtifact,
  ProviderCreateRequestResult,
  ProviderSigningSession,
  SignatureProvider,
  SignatureProviderCapabilities,
  SignatureStatus,
} from "../types.js";

// Real Clicksign v3 (Envelope API) adapter. SANDBOX ONLY — deliberately:
// there is no production base URL constant anywhere in this file, and no
// env var selects one. Spec section 51 prohibits any production cutover
// in this phase; making that a structural property of the code (nothing
// to flip) is stronger than a config default that happens to be sandbox.
// Activating production is a separate, explicitly-authorized future change
// to this file, not a flag.
const SANDBOX_BASE_URL = "https://sandbox.clicksign.com/api/v3";

export interface ClicksignProviderOptions {
  apiKey: string;
  /** Verifies inbound webhook HMAC signatures — the `secret` Clicksign
   * returns when you register a webhook via POST /webhooks in the sandbox
   * dashboard/API. Required for normalizeWebhook() to do anything. */
  webhookSecret: string;
}

interface JsonApiErrorBody {
  errors?: { title?: string; detail?: string; status?: string }[];
}

interface EnvelopeAttributes {
  status: string;
  name?: string;
}

interface DocumentAttributes {
  filename?: string;
  status?: string;
  [key: string]: unknown;
}

interface SignerAttributes {
  name: string;
  email: string;
  [key: string]: unknown;
}

interface JsonApiResource<A> {
  id: string;
  type: string;
  attributes: A;
  // The signed-file download link lives here, not under attributes —
  // confirmed live 2026-09-04: GET .../documents returns
  // `links.files.signed` (a presigned, time-limited S3 URL), alongside
  // `links.files.original`/`links.files.ziped`.
  links?: { files?: { original?: string; signed?: string; ziped?: string } };
}

interface JsonApiSingle<A> {
  data: JsonApiResource<A>;
}

interface JsonApiCollection<A> {
  data: JsonApiResource<A>[];
}

export class ClicksignProvider implements SignatureProvider {
  readonly type = "clicksign" as const;
  readonly capabilities: SignatureProviderCapabilities = {
    supportsSigningOrder: false, // P1 doesn't configure signing groups/order — every signer can act in any order
    supportsExpiration: false, // P1 doesn't set deadline_at — every envelope has no deadline yet
    supportsBulkSigners: true,
  };

  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(options: ClicksignProviderOptions) {
    this.apiKey = options.apiKey;
    this.webhookSecret = options.webhookSecret;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${SANDBOX_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as JsonApiErrorBody;
      const detail =
        errorBody.errors?.[0]?.detail ?? errorBody.errors?.[0]?.title ?? res.statusText;
      throw new Error(`Clicksign ${method} ${path} failed (${res.status}): ${detail}`);
    }
    // 204 No Content on some PATCH/DELETE calls
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async createRequest(input: CreateSignatureRequestInput): Promise<ProviderCreateRequestResult> {
    const envelope = await this.request<JsonApiSingle<EnvelopeAttributes>>("POST", "/envelopes", {
      data: {
        type: "envelopes",
        attributes: {
          name: input.documentName,
          locale: "pt-BR",
          auto_close: true,
          remind_interval: "3",
          block_after_refusal: false,
          deadline_partial_signature_action: "closed",
          // Does not change the sender identity (Clicksign always sends
          // from the account owner's own name/email — an account-level
          // setting, not exposed on this endpoint), only the subject/body
          // text the signer reads in the email. Confirmed present on a
          // real envelope's own attributes (default_subject/
          // default_message, both null by default) via GET /envelopes/{id}
          // 2026-09-04. Falls back to null (Clicksign's own default copy)
          // when the caller doesn't supply one.
          default_subject: input.emailSubject ?? null,
          default_message: input.emailMessage ?? null,
        },
      },
    });
    const envelopeId = envelope.data.id;

    const document = await this.request<JsonApiSingle<DocumentAttributes>>(
      "POST",
      `/envelopes/${envelopeId}/documents`,
      {
        data: {
          type: "documents",
          attributes: {
            filename: input.documentName,
            // The doc text says "raw base64, no data URI prefix" — the
            // real sandbox API disagrees and 400s without a full Data URI
            // ("Formatação do campo inválida. O valor deve ser um Data URI
            // completo."), confirmed live while building this adapter.
            // Trusting the live response over the doc text here.
            content_base64: `data:${input.documentContentType};base64,${Buffer.from(input.documentContent).toString("base64")}`,
          },
        },
      },
    );
    const documentId = document.data.id;

    const createdSigners: { input: CreateSignatureRequestInput["signers"][number]; id: string }[] =
      [];
    for (const signer of input.signers) {
      const created = await this.request<JsonApiSingle<SignerAttributes>>(
        "POST",
        `/envelopes/${envelopeId}/signers`,
        {
          data: {
            type: "signers",
            attributes: {
              name: signer.name,
              email: signer.email,
              communicate_events: {
                signature_request: "email",
                signature_reminder: "email",
                document_signed: "email",
              },
            },
          },
        },
      );
      createdSigners.push({ input: signer, id: created.data.id });

      // Two requirements per signer, both tied to the one document: a
      // qualification requirement (action:"agree", role:"sign" — this is
      // what actually obligates the signer to sign, per
      // developers.clicksign.com/reference/criar-requisito-qualificacao)
      // and an authentication requirement (action:"provide_evidence",
      // auth:"email" — the simplest identity-verification method; no
      // ICP-Brasil/biometric infra exists yet). Every signer needs at
      // least one auth requirement before the envelope can be activated.
      await this.request("POST", `/envelopes/${envelopeId}/requirements`, {
        data: {
          type: "requirements",
          attributes: { action: "agree", role: "sign" },
          relationships: {
            document: { data: { type: "documents", id: documentId } },
            signer: { data: { type: "signers", id: created.data.id } },
          },
        },
      });
      await this.request("POST", `/envelopes/${envelopeId}/requirements`, {
        data: {
          type: "requirements",
          attributes: { action: "provide_evidence", auth: "email" },
          relationships: {
            document: { data: { type: "documents", id: documentId } },
            signer: { data: { type: "signers", id: created.data.id } },
          },
        },
      });
    }

    // Activation — irreversible (Clicksign: "não é possível retornar ao
    // draft"), must happen after every signer + requirement exists.
    await this.request("PATCH", `/envelopes/${envelopeId}`, {
      data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } },
    });

    // Activating the envelope does NOT, by itself, send anything to
    // signers -- confirmed live 2026-09-03 (two real signers got no email
    // until this call was made manually against a stuck envelope): a
    // separate POST is required to actually dispatch the signature-request
    // email. Without this, createRequest() "succeeds" (the envelope shows
    // "running") but no signer is ever notified and the flow silently
    // stalls forever with no error anywhere.
    await this.request("POST", `/envelopes/${envelopeId}/notifications`, {
      data: { type: "notifications", attributes: {} },
    });

    return {
      providerRequestId: envelopeId,
      // Confirmed live 2026-09-04: Clicksign's document_closed/close
      // webhooks carry the DOCUMENT's id (this one), not the envelope id
      // above — applySignatureEvent() needs this to actually find the
      // request a real webhook is about.
      providerSecondaryId: documentId,
      // signingUrl intentionally left null in P1 — Clicksign emails each
      // signer its own signing link directly (communicate_events above),
      // which is what spec section 35 asks for (Shinã must avoid sending
      // its own duplicate signing-link email). getSigningSession() below
      // is the path for a future embedded/custom UI that needs the link
      // itself, not exercised by P1's flow.
      signers: createdSigners.map((s) => ({
        externalId: s.id,
        name: s.input.name,
        email: s.input.email,
        signingUrl: null,
      })),
    };
  }

  async getRequest(providerRequestId: string): Promise<{ status: SignatureStatus } | null> {
    try {
      const envelope = await this.request<JsonApiSingle<EnvelopeAttributes>>(
        "GET",
        `/envelopes/${providerRequestId}`,
      );
      return { status: mapEnvelopeStatus(envelope.data.attributes.status) };
    } catch (err) {
      if (err instanceof Error && /failed \(404\)/.test(err.message)) return null;
      throw err;
    }
  }

  async getSigningSession(
    providerRequestId: string,
    signerExternalId: string,
  ): Promise<ProviderSigningSession> {
    // Field name for the signing link on GET .../signers/{id} is one of
    // this adapter's documented "confirm against a live sandbox" gaps
    // (docs/integrations/CLICKSIGN.md) — not exercised by P1's flow
    // (Clicksign emails the link itself), wired for a future embedded UI.
    const signer = await this.request<JsonApiSingle<Record<string, unknown>>>(
      "GET",
      `/envelopes/${providerRequestId}/signers/${signerExternalId}`,
    );
    const signingUrl = signer.data.attributes["sign_url"] as string | undefined;
    if (!signingUrl) {
      throw new Error(
        "ClicksignProvider.getSigningSession: no signing URL field found on the signer response — confirm the real field name against a live sandbox call before relying on this method",
      );
    }
    return { signingUrl, expiresAt: null };
  }

  async cancelRequest(providerRequestId: string): Promise<void> {
    // NOT what the docs imply: PATCHing the ENVELOPE's own status to
    // "canceled" is rejected live ("status deve estar em: draft, running")
    // — envelopes only accept draft/running via this endpoint. Cancellation
    // actually happens at the DOCUMENT level (confirmed live + in
    // developers.clicksign.com/reference/editar-documento): PATCH each
    // document's status to "canceled". P1 always has exactly one document
    // per envelope, so this cancels the whole thing in practice.
    const documents = await this.request<JsonApiCollection<DocumentAttributes>>(
      "GET",
      `/envelopes/${providerRequestId}/documents`,
    );
    for (const doc of documents.data) {
      await this.request("PATCH", `/envelopes/${providerRequestId}/documents/${doc.id}`, {
        data: { id: doc.id, type: "documents", attributes: { status: "canceled" } },
      });
    }
  }

  async getSignedArtifacts(providerRequestId: string): Promise<ProviderArtifact[]> {
    const documents = await this.request<JsonApiCollection<DocumentAttributes>>(
      "GET",
      `/envelopes/${providerRequestId}/documents`,
    );
    const doc = documents.data[0];
    if (!doc) throw new Error(`ClicksignProvider: envelope ${providerRequestId} has no documents`);

    // Confirmed live 2026-09-04: the real field is links.files.signed (a
    // presigned S3 URL, not under attributes as originally guessed).
    const url = doc.links?.files?.signed;
    if (!url) {
      throw new Error(
        "ClicksignProvider.getSignedArtifacts: no signed-file download URL found on the document response — confirm the real field name against a live sandbox call before relying on this method",
      );
    }

    // No Authorization header here — confirmed live 2026-09-04 (a real
    // delivery 400'd until this was removed): this is a presigned S3 URL
    // (X-Amz-Signature etc., visible in the query string), whose signature
    // only covers the `host` header. Adding our own Clicksign API key as a
    // Bearer/raw Authorization header is an extra signed-request header S3
    // never expected, so it fails signature validation and 400s — the
    // presigned URL itself IS the auth, nothing else should be attached.
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      throw new Error(`ClicksignProvider: signed file download failed (${fileRes.status})`);
    }
    const content = new Uint8Array(await fileRes.arrayBuffer());
    // Hash computed independently here, never trusted from Clicksign's own
    // response — a deliberate hardening beyond what FakeSignatureProvider
    // does (it just echoes a fake hash).
    const hash = createHash("sha256").update(content).digest("hex");

    return [
      {
        kind: "signed",
        filename: doc.attributes.filename ?? `${providerRequestId}-signed.pdf`,
        contentType: "application/pdf",
        content,
        hash,
      },
    ];
  }

  async normalizeWebhook(
    rawBody: string,
    headers: Record<string, string | null>,
  ): Promise<CanonicalSignatureEvent[]> {
    // HMAC verification — confirmed 2026-09-04 against
    // developers.clicksign.com/docs/seguranca-de-webhooks (a primary
    // source page that wasn't reachable earlier in this adapter's build;
    // x-clicksign-signature was a secondary-source guess that never once
    // matched real traffic). The real header is `Content-Hmac`, its value
    // is prefixed `sha256=` before the hex digest (the actual bug that
    // made every earlier candidate fail — length mismatch against an
    // un-prefixed digest always fails timingSafeEqual before the hash
    // itself is even compared), and the digest is a standard
    // HMAC-SHA256(key=secret, message=rawBody) hex digest — the doc's own
    // "Do not format the JSON before the calculation" note is why this
    // reads the body as raw text, never JSON.parse()'d first.
    const signatureHeader = headers["content-hmac"] ?? headers["Content-HMAC"];
    if (!signatureHeader) {
      throw new Error("ClicksignProvider: webhook missing content-hmac header");
    }
    const prefix = "sha256=";
    if (!signatureHeader.startsWith(prefix)) {
      throw new Error('ClicksignProvider: content-hmac header missing expected "sha256=" prefix');
    }
    const received = signatureHeader.slice(prefix.length);
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    const authentic = a.length === b.length && timingSafeEqual(a, b);
    if (!authentic) {
      throw new Error("ClicksignProvider: webhook signature verification failed");
    }

    const payload = JSON.parse(rawBody) as {
      event?: { name?: string; occurred_at?: string };
      document?: { key?: string };
      envelope?: { id?: string };
    };
    const eventName = payload.event?.name;
    if (!eventName) throw new Error("ClicksignProvider: malformed webhook payload (no event.name)");

    const providerRequestId = payload.envelope?.id ?? payload.document?.key;
    if (!providerRequestId) {
      throw new Error("ClicksignProvider: malformed webhook payload (no envelope/document id)");
    }

    return [
      {
        provider: this.type,
        // Clicksign's payloads observed in the docs carry no explicit
        // event id field — occurred_at + event name + envelope id is used
        // as a stand-in until a live sandbox delivery confirms whether a
        // real id exists (documented gap, see CLICKSIGN.md).
        providerEventId: `${providerRequestId}_${eventName}_${payload.event?.occurred_at ?? rawBody.length}`,
        eventType: eventName,
        kind: mapWebhookEventType(eventName),
        providerRequestId,
        rawPayload: payload as Record<string, unknown>,
      },
    ];
  }
}
