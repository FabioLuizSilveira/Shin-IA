import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "./hash.js";

// WAVE 3 — Contract composition + validation + freeze.
//
// The LEGAL body is the published contract_versions.content, used UNCHANGED.
// This module renders the per-tenant "ANEXO — CONDIÇÕES COMERCIAIS" from a
// versioned template ({{token}} slots) filled from the BusinessProfile +
// CommercialConfiguration + pricing, then:
//   1. detects residual placeholders ([PREENCHER], {{token}}, ___),
//   2. gates readiness (no residuals + every required_var present),
//   3. freezes: SHA-256 content hash, immutable row (DB trigger enforces it).
//
// STOP conditions honored: incomplete-contract-to-signature (freeze refuses
// when not ready), ContractSnapshot-mutable (frozen row is trigger-locked),
// hash-mismatch-ignored (hash recomputed and checked on freeze).

export type ContractExecutionMode = "click_accept" | "electronic_signature";

const PLACEHOLDER_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: "PREENCHER", re: /\[PREENCHER[^\]]*\]/g },
  { code: "MUSTACHE", re: /\{\{\s*[\w.]+\s*\}\}/g },
  { code: "BLANK_LINE", re: /_{3,}/g },
];

export interface PlaceholderHit {
  code: string;
  token: string;
  count: number;
}

/** Every unresolved placeholder token found in `content`, grouped. */
export function detectPlaceholders(content: string): PlaceholderHit[] {
  const hits = new Map<string, PlaceholderHit>();
  for (const { code, re } of PLACEHOLDER_PATTERNS) {
    for (const m of content.matchAll(re)) {
      const token = m[0];
      const key = `${code}:${token}`;
      const existing = hits.get(key);
      if (existing) existing.count += 1;
      else hits.set(key, { code, token, count: 1 });
    }
  }
  return [...hits.values()];
}

/** Fill {{token}} slots. Unknown / missing vars are left as-is so
 *  detectPlaceholders can flag them; never silently blanked. */
export function renderAnnex(templateBody: string, vars: Record<string, string | number>): string {
  return templateBody.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined || value === null || value === "" ? whole : String(value);
  });
}

export interface ComposeInput {
  tenantId: string;
  commercialConfigurationId: string;
  businessProfileId?: string | null;
  contractVersionId: string;
  compositionTemplateKey: string;
  executionMode?: ContractExecutionMode;
  pricingVersion?: number | null;
  pricing?: Record<string, unknown>;
  vars: Record<string, string | number>;
  createdBy: string;
}

export interface ComposedContract {
  legalBody: string;
  annex: string;
  composedContent: string;
  contentHash: string;
  contractVersionId: string;
  compositionTemplateId: string;
  requiredVars: string[];
  missingVars: string[];
  residualPlaceholders: PlaceholderHit[];
  readiness: ContractReadiness;
}

export interface ContractReadiness {
  ready: boolean;
  issues: Array<{ code: string; message: string }>;
}

export function validateContractReadiness(
  missingVars: string[],
  residualPlaceholders: PlaceholderHit[],
): ContractReadiness {
  const issues: ContractReadiness["issues"] = [];
  if (missingVars.length > 0) {
    issues.push({
      code: "MISSING_VARS",
      message: `Variáveis obrigatórias não preenchidas: ${missingVars.join(", ")}.`,
    });
  }
  if (residualPlaceholders.length > 0) {
    issues.push({
      code: "RESIDUAL_PLACEHOLDERS",
      message: `Placeholders não resolvidos: ${residualPlaceholders
        .map((p) => `${p.token} (${p.count}x)`)
        .join(", ")}.`,
    });
  }
  return { ready: issues.length === 0, issues };
}

/** Compose (but do NOT persist) the full contract document. */
export async function composeOnboardingContract(
  db: SupabaseClient,
  input: ComposeInput,
): Promise<ComposedContract> {
  const { data: contractVersion, error: cvError } = await db
    .from("contract_versions")
    .select("id, content, status")
    .eq("id", input.contractVersionId)
    .maybeSingle();
  if (cvError) throw cvError;
  if (!contractVersion) throw new Error(`contract version not found: ${input.contractVersionId}`);
  if (contractVersion.status !== "published") {
    throw new Error(`contract version ${input.contractVersionId} is not published`);
  }

  const { data: template, error: tError } = await db
    .from("contract_composition_templates")
    .select("id, body, required_vars")
    .eq("key", input.compositionTemplateKey)
    .eq("active", true)
    .maybeSingle();
  if (tError) throw tError;
  if (!template) {
    throw new Error(`no active composition template for key "${input.compositionTemplateKey}"`);
  }

  const legalBody: string = contractVersion.content;
  const annex = renderAnnex(template.body as string, input.vars);
  const composedContent = `${legalBody}\n\n${annex}`;
  const contentHash = await hashContent(composedContent);

  const requiredVars: string[] = template.required_vars ?? [];
  const missingVars = requiredVars.filter((k) => {
    const v = input.vars[k];
    return v === undefined || v === null || v === "";
  });
  // Only placeholders inside the ANNEX are the onboarding flow's
  // responsibility — residuals in the legal body are a template-authoring
  // defect surfaced separately (see freezeOnboardingContract).
  const residualPlaceholders = detectPlaceholders(annex);
  const readiness = validateContractReadiness(missingVars, residualPlaceholders);

  return {
    legalBody,
    annex,
    composedContent,
    contentHash,
    contractVersionId: input.contractVersionId,
    compositionTemplateId: template.id as string,
    requiredVars,
    missingVars,
    residualPlaceholders,
    readiness,
  };
}

export interface FreezeResult {
  id: string;
  contentHash: string;
  status: "frozen";
}

/**
 * Freeze the composed contract into an immutable onboarding_contract_snapshots
 * row. Refuses when:
 *  - readiness gate fails (missing vars / residual annex placeholders),
 *  - the legal body still contains placeholders and
 *    `allowTemplatePlaceholders` is not explicitly set,
 *  - a frozen snapshot already exists for this commercial configuration.
 */
export async function freezeOnboardingContract(
  db: SupabaseClient,
  input: ComposeInput & { allowTemplatePlaceholders?: boolean },
): Promise<FreezeResult> {
  const composed = await composeOnboardingContract(db, input);

  if (!composed.readiness.ready) {
    throw new Error(
      `contract not ready to freeze: ${composed.readiness.issues.map((i) => i.message).join(" ")}`,
    );
  }

  const legalPlaceholders = detectPlaceholders(composed.legalBody);
  if (legalPlaceholders.length > 0 && !input.allowTemplatePlaceholders) {
    throw new Error(
      `contract template still has ${legalPlaceholders.length} unresolved placeholder(s) in the legal body — ` +
        `pass allowTemplatePlaceholders:true only if legal has signed off on the [PREENCHER] fields`,
    );
  }

  const { data: existing } = await db
    .from("onboarding_contract_snapshots")
    .select("id")
    .eq("commercial_configuration_id", input.commercialConfigurationId)
    .eq("status", "frozen")
    .maybeSingle();
  if (existing) {
    throw new Error(
      `a frozen contract snapshot already exists for commercial configuration ${input.commercialConfigurationId} — supersede it first`,
    );
  }

  const { data, error } = await db
    .from("onboarding_contract_snapshots")
    .insert({
      tenant_id: input.tenantId,
      commercial_configuration_id: input.commercialConfigurationId,
      business_profile_id: input.businessProfileId ?? null,
      contract_version_id: composed.contractVersionId,
      composition_template_id: composed.compositionTemplateId,
      execution_mode: input.executionMode ?? "click_accept",
      pricing_version: input.pricingVersion ?? null,
      pricing: input.pricing ?? {},
      vars: input.vars,
      composed_content: composed.composedContent,
      content_hash: composed.contentHash,
      readiness: composed.readiness,
      status: "frozen",
      created_by: input.createdBy,
      frozen_at: new Date().toISOString(),
    })
    .select("id, content_hash")
    .single();
  if (error || !data) throw error ?? new Error("failed to freeze onboarding contract");

  return { id: data.id as string, contentHash: data.content_hash as string, status: "frozen" };
}

/** Verify a stored snapshot's hash still matches its content (STOP condition:
 *  hash-mismatch-ignored). Throws on mismatch. */
export async function verifyFrozenContractHash(
  db: SupabaseClient,
  snapshotId: string,
): Promise<{ valid: true }> {
  const { data, error } = await db
    .from("onboarding_contract_snapshots")
    .select("composed_content, content_hash")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`onboarding contract snapshot not found: ${snapshotId}`);
  const recomputed = await hashContent(data.composed_content as string);
  if (recomputed !== data.content_hash) {
    throw new Error(
      `hash mismatch for onboarding contract snapshot ${snapshotId}: stored ${data.content_hash}, recomputed ${recomputed}`,
    );
  }
  return { valid: true };
}

/** The signed-contract path is required for a long commitment (more than the
 *  standard 12-month term) or a material contract change; a simple
 *  click-accept covers the standard case. */
export function resolveContractExecutionMode(config: {
  commitmentPeriodMonths?: number | null;
  materialChange?: boolean;
}): ContractExecutionMode {
  if ((config.commitmentPeriodMonths ?? 0) > 12 || config.materialChange) {
    return "electronic_signature";
  }
  return "click_accept";
}
