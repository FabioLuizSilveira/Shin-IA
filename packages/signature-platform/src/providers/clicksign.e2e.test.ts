import { describe, expect, it } from "vitest";
import { ClicksignProvider } from "./clicksign.js";

// Real sandbox E2E test (spec section 45: "mocks alone insufficient").
// Skipped automatically when no CLICKSIGN_API_KEY is set in the
// environment — CI and any contributor without sandbox credentials still
// get a clean `pnpm test`. Run it for real with:
//
//   CLICKSIGN_API_KEY=... pnpm --filter @shina/signature-platform test
//
// Scope: only the parts exercisable without a human clicking through a
// signing link or a publicly-reachable webhook URL (createRequest,
// getRequest, cancelRequest). The full sign → webhook → getSignedArtifacts
// path needs a deployed environment Clicksign can actually call back to —
// documented as a separate live-verification step in
// docs/integrations/CLICKSIGN.md, not faked here.
const apiKey = process.env.CLICKSIGN_API_KEY;
const describeIfConfigured = apiKey ? describe : describe.skip;

describeIfConfigured("ClicksignProvider — live sandbox E2E", () => {
  const provider = new ClicksignProvider({
    apiKey: apiKey ?? "",
    webhookSecret: process.env.CLICKSIGN_WEBHOOK_SECRET ?? "unused-in-this-test",
    environment: "sandbox",
  });

  it("creates a real envelope, activates it, and can cancel it", async () => {
    const documentContent = new TextEncoder().encode(
      "%PDF-1.4\n% shina signature-platform e2e test document\n",
    );

    const created = await provider.createRequest({
      tenantId: "e2e-tenant",
      contractId: "e2e-contract",
      contractVersionId: "e2e-version",
      snapshotId: "e2e-snapshot",
      documentContent,
      documentContentType: "application/pdf",
      documentName: "shina-e2e-test.pdf",
      signers: [
        {
          role: "customer",
          // Clicksign rejects "Shinã E2E Test Signer" with a 400 ("name
          // não está em um formato válido") — confirmed live; its name
          // validation apparently rejects digits/abbreviations. A
          // plausible full name avoids that without guessing the exact
          // regex.
          name: "Maria Da Silva Teste",
          email: "e2e-test@shina.local",
          partyType: "customer",
          userId: "e2e-user",
          customerId: "e2e-customer",
        },
      ],
    });

    expect(created.providerRequestId).toBeTruthy();
    expect(created.signers).toHaveLength(1);

    const fetched = await provider.getRequest(created.providerRequestId);
    expect(fetched?.status).toBe("in_progress"); // "running" in Clicksign's own vocabulary

    await provider.cancelRequest(created.providerRequestId);
    const afterCancel = await provider.getRequest(created.providerRequestId);
    expect(afterCancel?.status).toBe("cancelled");
  }, 30000);
});
