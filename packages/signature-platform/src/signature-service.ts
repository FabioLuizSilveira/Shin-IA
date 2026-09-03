import type { SupabaseClient } from "@supabase/supabase-js";
import { recordContractAcceptance } from "@shina/tenant-contract-engine";
import type {
  ApplySignatureEventResult,
  CanonicalSignatureEvent,
  CreateSignatureRequestInput,
  SignatureProvider,
  SignatureRequestRecord,
} from "./types.js";

// Storage bucket already provisioned for contract documents (KYC uploads
// today via the unrelated `contract_documents` table — this reuses only
// the bucket, never that table). Signed artifacts live under their own
// `signatures/` prefix so the two purposes never collide.
const SIGNED_ARTIFACT_BUCKET = "contract-documents";

function artifactStoragePath(
  tenantId: string,
  signatureRequestId: string,
  filename: string,
): string {
  return `signatures/${tenantId}/${signatureRequestId}/${filename}`;
}

// Creates a SignatureRequest anchored to an already-frozen contract
// snapshot. Mirrors recordContractAcceptance()'s own defensive posture:
// contractVersionId/snapshotId presented by the caller are re-derived from
// the contracts row itself and rejected on mismatch — never trusted
// verbatim, so a caller can't create a signature request against a
// version/snapshot that was never actually generated for this contract.
export async function createSignatureRequest(
  db: SupabaseClient,
  provider: SignatureProvider,
  input: CreateSignatureRequestInput,
): Promise<SignatureRequestRecord> {
  const { data: contract, error: contractError } = await db
    .from("contracts")
    .select("template_version_id, snapshot_id")
    .eq("id", input.contractId)
    .single();
  if (contractError || !contract) {
    throw new Error(`signature request rejected: contract ${input.contractId} not found`);
  }
  if (contract.template_version_id !== input.contractVersionId) {
    throw new Error(
      "signature request rejected: contractVersionId does not match the version resolved for this contract",
    );
  }
  if (contract.snapshot_id !== input.snapshotId) {
    throw new Error(
      "signature request rejected: snapshotId does not match the snapshot generated for this contract",
    );
  }

  for (const signer of input.signers) {
    if (signer.partyType === "customer" && !signer.customerId) {
      throw new Error("signer customerId is required when partyType is customer");
    }
    if (signer.partyType === "operator" && !signer.operatorId) {
      throw new Error("signer operatorId is required when partyType is operator");
    }
  }

  const { data: requestRow, error: requestError } = await db
    .from("signature_requests")
    .insert({
      tenant_id: input.tenantId,
      contract_id: input.contractId,
      contract_version_id: input.contractVersionId,
      snapshot_id: input.snapshotId,
      provider: provider.type,
      provider_request_id: null,
      document_name: input.documentName,
      status: "draft",
    })
    .select("id")
    .single();
  if (requestError || !requestRow) {
    throw new Error(`signature request insert failed: ${requestError?.message}`);
  }
  const signatureRequestId: string = requestRow.id;

  const signerRows = input.signers.map((s) => ({
    signature_request_id: signatureRequestId,
    tenant_id: input.tenantId,
    role: s.role,
    party_type: s.partyType ?? null,
    user_id: s.userId ?? null,
    customer_id: s.customerId ?? null,
    operator_id: s.operatorId ?? null,
    name: s.name,
    email: s.email,
    provider_external_id: null as string | null,
    status: "pending",
  }));
  const { error: signersError } = await db.from("signature_signers").insert(signerRows);
  if (signersError) throw new Error(`signature signers insert failed: ${signersError.message}`);

  const created = await provider.createRequest(input);

  // Backfill each signer's provider-assigned external id by matching on
  // email — the order provider.createRequest() returns signers in is
  // expected to match input.signers, but matching by email (not index)
  // avoids silently mis-linking if an adapter ever reorders.
  for (const providerSigner of created.signers) {
    await db
      .from("signature_signers")
      .update({ provider_external_id: providerSigner.externalId })
      .eq("signature_request_id", signatureRequestId)
      .eq("email", providerSigner.email);
  }

  const { error: updateError } = await db
    .from("signature_requests")
    .update({ provider_request_id: created.providerRequestId, status: "sent" })
    .eq("id", signatureRequestId);
  if (updateError) throw new Error(`signature request update failed: ${updateError.message}`);

  return {
    id: signatureRequestId,
    tenantId: input.tenantId,
    contractId: input.contractId,
    provider: provider.type,
    providerRequestId: created.providerRequestId,
    status: "sent",
  };
}

// Gateway-agnostic DB-writing core — mirrors applyBillingEvent's shape
// exactly. Reads only a CanonicalSignatureEvent, never a raw provider
// payload (each provider's normalizeWebhook() is where that parsing
// happens). Idempotency: logged into signature_webhook_events FIRST under
// a composite unique index on (provider, provider_event_id) — composite,
// not a single column like platform_billing_events, because two different
// providers could in principle both mint an id "1" (deliberate divergence
// from the billing-platform pattern, not an oversight). A duplicate-key
// error (23505) means this exact event was already processed.
export async function applySignatureEvent(
  db: SupabaseClient,
  provider: SignatureProvider,
  event: CanonicalSignatureEvent,
): Promise<ApplySignatureEventResult> {
  const { data: logged, error: logError } = await db
    .from("signature_webhook_events")
    .insert({
      provider: event.provider,
      provider_event_id: event.providerEventId,
      event_type: event.eventType,
      payload: event.rawPayload,
    })
    .select("id")
    .single();

  if (logError) {
    if (logError.code === "23505") {
      return { duplicate: true, handled: false };
    }
    throw new Error(`signature event log failed: ${logError.message}`);
  }

  const { data: request, error: requestError } = await db
    .from("signature_requests")
    .select("id, tenant_id, contract_id, contract_version_id, snapshot_id")
    .eq("provider", event.provider)
    .eq("provider_request_id", event.providerRequestId)
    .maybeSingle();
  if (requestError) throw new Error(`signature request lookup failed: ${requestError.message}`);
  if (!request) {
    // Event for a request this system never created (or a different
    // provider account) — logged for audit, nothing to update.
    await db
      .from("signature_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", logged.id);
    return { duplicate: false, handled: false };
  }

  const signatureRequestId: string = request.id;
  let handled = false;

  switch (event.kind) {
    case "signature_request_sent": {
      await db.from("signature_requests").update({ status: "sent" }).eq("id", signatureRequestId);
      handled = true;
      break;
    }

    case "signer_viewed":
    case "signer_signed":
    case "signer_refused": {
      const status =
        event.kind === "signer_viewed"
          ? "viewed"
          : event.kind === "signer_signed"
            ? "signed"
            : "refused";
      const patch: Record<string, unknown> = { status };
      if (event.kind === "signer_signed") patch.signed_at = new Date().toISOString();
      if (event.signerExternalId) {
        await db
          .from("signature_signers")
          .update(patch)
          .eq("signature_request_id", signatureRequestId)
          .eq("provider_external_id", event.signerExternalId);
      }
      if (event.kind !== "signer_signed") {
        await db
          .from("signature_requests")
          .update({ status: "in_progress" })
          .eq("id", signatureRequestId);
      }
      handled = true;
      break;
    }

    case "signature_completed": {
      const artifacts = await provider.getSignedArtifacts(event.providerRequestId);
      let signedHash: string | null = null;
      for (const artifact of artifacts) {
        const path = artifactStoragePath(request.tenant_id, signatureRequestId, artifact.filename);
        const { error: uploadError } = await db.storage
          .from(SIGNED_ARTIFACT_BUCKET)
          .upload(path, artifact.content, { contentType: artifact.contentType, upsert: false });
        if (uploadError) throw new Error(`signed artifact upload failed: ${uploadError.message}`);

        await db.from("signature_artifacts").insert({
          signature_request_id: signatureRequestId,
          tenant_id: request.tenant_id,
          kind: artifact.kind,
          filename: artifact.filename,
          content_type: artifact.contentType,
          storage_path: path,
          hash: artifact.hash,
        });
        if (artifact.kind === "signed") signedHash = artifact.hash;
      }

      await db.from("signature_requests").update({ status: "signed" }).eq("id", signatureRequestId);

      // Bridge back into the Contract Engine — once per CUSTOMER/OPERATOR
      // signer, using the FINAL signed artifact's hash (not the
      // pre-signature snapshot's content_hash) as documentHash, since
      // that's what was actually executed. No live request context is
      // available from an async webhook (unlike a clickwrap accept), so
      // ip/userAgent/sessionId are left null — a known, documented gap.
      if (signedHash) {
        const { data: signers, error: signersError } = await db
          .from("signature_signers")
          .select("party_type, user_id, customer_id, operator_id")
          .eq("signature_request_id", signatureRequestId)
          .in("party_type", ["customer", "operator"]);
        if (signersError) throw new Error(`signer lookup failed: ${signersError.message}`);

        for (const signer of signers ?? []) {
          if (!signer.user_id) continue;
          await recordContractAcceptance(db, {
            tenantId: request.tenant_id,
            partyType: signer.party_type,
            userId: signer.user_id,
            customerId: signer.customer_id ?? null,
            operatorId: signer.operator_id ?? null,
            contractId: request.contract_id,
            contractVersionId: request.contract_version_id,
            snapshotId: request.snapshot_id,
            documentHash: signedHash,
            acceptanceMethod: "electronic_signature_provider",
            request: {},
            metadata: { signatureRequestId, provider: event.provider },
          });
        }
      }
      handled = true;
      break;
    }

    case "signature_cancelled": {
      await db
        .from("signature_requests")
        .update({ status: "cancelled" })
        .eq("id", signatureRequestId);
      handled = true;
      break;
    }

    case "signature_expired": {
      await db
        .from("signature_requests")
        .update({ status: "expired" })
        .eq("id", signatureRequestId);
      handled = true;
      break;
    }

    case "signature_failed": {
      await db.from("signature_requests").update({ status: "failed" }).eq("id", signatureRequestId);
      handled = true;
      break;
    }

    default:
      break;
  }

  await db
    .from("signature_webhook_events")
    .update({ processed_at: new Date().toISOString(), signature_request_id: signatureRequestId })
    .eq("id", logged.id);

  return { duplicate: false, handled, signatureRequestId };
}
