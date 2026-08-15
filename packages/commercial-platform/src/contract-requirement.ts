import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractVersion, Product } from "./types.js";

// The product -> template mapping is static and 1:1 (MASTER_SAAS_AGREEMENT
// for "platform", MKT_SERVICE_AGREEMENT for "mkt") — no per-extension
// addenda, no configurable matrix needed (Tracking/AI/Marketplace are plan
// features, not separately contracted products).
export async function resolveRequiredContract(
  db: SupabaseClient,
  product: Product,
): Promise<ContractVersion> {
  const { data: template, error: templateError } = await db
    .from("contract_templates")
    .select("id")
    .eq("product", product)
    .single();
  if (templateError || !template) {
    throw new Error(`no contract template configured for product "${product}"`);
  }

  const { data: version, error: versionError } = await db
    .from("contract_versions")
    .select("*")
    .eq("contract_template_id", template.id)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(`contract version lookup failed: ${versionError.message}`);
  if (!version) throw new Error(`no published contract version for product "${product}"`);

  return version as ContractVersion;
}

export async function resolvePlanVersion(db: SupabaseClient, planVersionId: string) {
  const { data, error } = await db
    .from("plan_versions")
    .select("*, plans(id, product, key, name)")
    .eq("id", planVersionId)
    .single();
  if (error || !data) throw new Error(`plan version not found: ${planVersionId}`);
  return data;
}
