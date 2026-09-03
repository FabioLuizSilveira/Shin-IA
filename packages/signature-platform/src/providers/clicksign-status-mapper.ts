// Isolated on purpose: this is the ONLY file in this package allowed to
// know Clicksign's own status/event vocabulary (spec section 21 —
// "ClicksignStatusMapper isolated in the adapter"). Nothing here is ever
// imported outside providers/clicksign.ts.
//
// Every mapping below is sourced from developers.clicksign.com's own docs
// (fetched live while planning this adapter — see docs/integrations/CLICKSIGN.md
// for the exact pages), never invented. Where the source material didn't
// give a complete answer, the function throws instead of guessing — the
// live sandbox spike run against this adapter is what fills those gaps in,
// not assumption.

import type { SignatureEventKind, SignatureStatus } from "../types.js";

// Clicksign's v3 envelope lifecycle has exactly 4 documented statuses
// (https://developers.clicksign.com/docs/envelope) — a strictly smaller
// vocabulary than our canonical SignatureStatus's 7 values. "sent" is
// deliberately never produced here: our own createSignatureRequest()
// already sets "sent" locally right after activation, before any signer
// event arrives — getEnvelopeStatus() is a reconciliation path, not the
// primary source of "sent".
export function mapEnvelopeStatus(clicksignStatus: string): SignatureStatus {
  switch (clicksignStatus) {
    case "draft":
      return "draft";
    case "running":
      return "in_progress";
    case "closed":
      return "signed";
    case "canceled":
      return "cancelled";
    default:
      throw new Error(
        `ClicksignStatusMapper: unmapped envelope status "${clicksignStatus}" — confirm against a live sandbox envelope before adding a mapping, never guess`,
      );
  }
}

// Only "document_closed" and "close" are confirmed from Clicksign's own
// webhook event reference pages as of this adapter's build date. Any other
// event type Clicksign actually sends (refusal, cancellation, deadline —
// all plausible, none confirmed in the docs pages this session could
// fetch) must be added here only after being observed for real against
// the registered sandbox webhook — see docs/integrations/CLICKSIGN.md's
// "pontos a confirmar" list. Throwing on an unknown type surfaces that gap
// immediately instead of silently dropping a real event.
export function mapWebhookEventType(clicksignEventName: string): SignatureEventKind {
  switch (clicksignEventName) {
    case "document_closed":
      return "signature_completed";
    case "close":
      return "signature_completed";
    default:
      throw new Error(
        `ClicksignStatusMapper: unmapped webhook event "${clicksignEventName}" — add a real mapping only after confirming it against a live sandbox delivery, never guess`,
      );
  }
}
