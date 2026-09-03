import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_OWNERSHIP_TYPES = ["own", "shared", "third_party_managed"];

// Shared by POST /api/assets and PATCH /api/assets/[id] — both need the
// same "own has no owner, shared/third_party_managed needs one" validation
// the DB's own check constraint (assets_ownership_consistency) also
// enforces; duplicated here so a bad request 422s with a clear message
// instead of a raw Postgres constraint-violation error.
export function validateOwnership(body: {
  ownership_type?: string;
  owner_org_id?: string | null;
  tenant_share_pct?: number;
}):
  | { ownership_type: string; owner_org_id: string | null; tenant_share_pct: number }
  | { error: string } {
  const ownershipType = body.ownership_type ?? "own";
  if (!VALID_OWNERSHIP_TYPES.includes(ownershipType)) {
    return { error: "ownership_type must be one of: own, shared, third_party_managed" };
  }
  if (ownershipType === "own") {
    return { ownership_type: "own", owner_org_id: null, tenant_share_pct: 100 };
  }
  if (!body.owner_org_id) {
    return {
      error: "owner_org_id is required when ownership_type is shared or third_party_managed",
    };
  }
  const pct = body.tenant_share_pct ?? 0;
  if (typeof pct !== "number" || pct < 0 || pct > 100) {
    return { error: "tenant_share_pct must be a number between 0 and 100" };
  }
  return { ownership_type: ownershipType, owner_org_id: body.owner_org_id, tenant_share_pct: pct };
}

// Asset ownership (sócio/parceiro no ativo, ou administração pra terceiro) —
// computes and records the owner's share whenever a contract-linked invoice
// is marked paid. Scope decided with the user: one owner per asset (no N-way
// split), and this DOES feed a real financial calculation, not just a
// cosmetic field on the asset (see the migration's own comment).
//
// Scoped to the general AR invoices module (invoices.contract_id ->
// contract_assets -> assets) — the mobile deposit/balance/renewal flow
// (api/mobile/customer/*) doesn't populate invoices.contract_id (the
// contract there is only created AFTER the deposit's already paid, from the
// balance webhook), so it doesn't feed this yet. That's a real, documented
// gap, not an oversight — the AR/contracts path is the one that actually
// matches "meu sócio é dono desse ativo" (a standing lease), unlike the
// mobile app's short-term per-reservation flow.
//
// Called from both places an invoice can become "paid": the manual
// transition (api/invoices/[id]/route.ts) and the Asaas webhook
// (api/webhooks/asaas/route.ts, action "invoice"). Idempotent by design —
// asset_owner_settlements has a unique (invoice_id, asset_id) index, so a
// re-delivered webhook or a repeated call is a silent no-op via the
// insert's own duplicate-key error, not a manual dedup check here.
export async function settleAssetOwnersForPaidInvoice(
  db: SupabaseClient,
  params: {
    tenantId: string;
    invoiceId: string;
    contractId: string;
    totalAmount: number;
    currency: string;
  },
): Promise<void> {
  const { data: contractAssets } = await db
    .from("contract_assets")
    .select("asset_id")
    .eq("contract_id", params.contractId);
  if (!contractAssets || contractAssets.length === 0) return;

  const assetIds = [...new Set(contractAssets.map((r) => r.asset_id))];
  const { data: assets } = await db
    .from("assets")
    .select("id, ownership_type, owner_org_id, tenant_share_pct")
    .in("id", assetIds)
    .neq("ownership_type", "own")
    .not("owner_org_id", "is", null);
  if (!assets || assets.length === 0) return;

  // Simplification, documented: split the invoice total evenly across
  // every non-"own" asset on the contract. Correct for the common case (one
  // asset per contract, the typical car-rental shape) -- a contract with
  // multiple assets and no per-asset pricing has no better basis to split
  // by without inventing one.
  const grossPerAsset = Math.round((params.totalAmount / assetIds.length) * 100) / 100;

  for (const asset of assets) {
    const sharePct = Number(asset.tenant_share_pct);
    const tenantAmount = Math.round(grossPerAsset * (sharePct / 100) * 100) / 100;
    const ownerAmount = Math.round((grossPerAsset - tenantAmount) * 100) / 100;

    const { error } = await db.from("asset_owner_settlements").insert({
      tenant_id: params.tenantId,
      asset_id: asset.id,
      owner_org_id: asset.owner_org_id,
      contract_id: params.contractId,
      invoice_id: params.invoiceId,
      gross_amount: grossPerAsset,
      tenant_share_pct: sharePct,
      tenant_amount: tenantAmount,
      owner_amount: ownerAmount,
      currency: params.currency,
    });
    // 23505 = already settled (duplicate invoice_id+asset_id) -- expected
    // on a webhook retry, not an error worth surfacing.
    if (error && error.code !== "23505") {
      console.error("[asset-owner-settlement] insert failed:", error.message);
    }
  }
}
