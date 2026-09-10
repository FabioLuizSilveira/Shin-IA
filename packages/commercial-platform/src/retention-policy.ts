import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 1 — versioned, platform-wide (control plane) data retention policy.
// The tenant is NOT asked technical retention questions during pre-sales;
// the applicable policy is resolved from Plan/Vertical/DataCategory rules
// and only a summary is shown. The ContractSnapshot records
// retentionPolicyVersion so the exact rules in force at acceptance are
// reconstructable.

export type RetentionAction = "retain" | "export_then_delete" | "anonymize" | "delete";

export interface RetentionRule {
  dataCategory: string;
  retention: string;
  action: RetentionAction;
  basis: string;
}

export interface RetentionPolicy {
  id: string;
  version: number;
  name: string;
  rules: RetentionRule[];
  summary: string | null;
  effectiveAt: string | null;
  publishedAt: string | null;
}

interface Row {
  id: string;
  version: number;
  name: string;
  rules: RetentionRule[];
  summary: string | null;
  effective_at: string | null;
  published_at: string | null;
}

function fromRow(r: Row): RetentionPolicy {
  return {
    id: r.id,
    version: r.version,
    name: r.name,
    rules: r.rules ?? [],
    summary: r.summary,
    effectiveAt: r.effective_at,
    publishedAt: r.published_at,
  };
}

/** The current published retention policy (highest version, status published). */
export async function resolveCurrentRetentionPolicy(db: SupabaseClient): Promise<RetentionPolicy> {
  const { data, error } = await db
    .from("retention_policies")
    .select("id, version, name, rules, summary, effective_at, published_at")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no published retention policy");
  return fromRow(data as Row);
}
