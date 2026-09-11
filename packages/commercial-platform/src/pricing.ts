import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 3 — DETERMINISTIC pricing. Same inputs + same pricing_version =>
// identical line items and totals. Never recalculated after acceptance: the
// frozen onboarding_contract_snapshot carries the computed `pricing` verbatim
// (STOP condition: Pricing-recalculated).

interface PricingRules {
  currency: string;
  extensionPriceCents: Record<string, number>;
  commitmentDiscountPct: Array<{ minMonths: number; pct: number }>;
  yearlyPrepayDiscountPct: number;
  volumeDiscountPctByAssetCount: Array<{ minAssets: number; pct: number }>;
}

export interface PricingInput {
  basePlanPriceCents: number;
  billingCycle: "monthly" | "yearly";
  extensions: string[];
  commitmentPeriodMonths?: number | null;
  assetQuantity?: number | null;
}

export interface PricingLineItem {
  code: string;
  label: string;
  amountCents: number;
}

export interface PricingResult {
  pricingVersion: number;
  currency: string;
  lineItems: PricingLineItem[];
  subtotalCents: number;
  discountCents: number;
  totalMonthlyCents: number;
  totalYearlyCents: number;
  appliedDiscounts: Array<{ code: string; pct: number; label: string }>;
}

export async function loadActivePricingRules(
  db: SupabaseClient,
): Promise<{ ruleVersion: number; rules: PricingRules }> {
  const { data, error } = await db
    .from("pricing_rules")
    .select("rule_version, rules")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no active pricing_rules");
  return { ruleVersion: data.rule_version as number, rules: data.rules as PricingRules };
}

export async function computePricing(
  db: SupabaseClient,
  input: PricingInput,
): Promise<PricingResult> {
  const { ruleVersion, rules } = await loadActivePricingRules(db);
  return computePricingWithRules(input, ruleVersion, rules);
}

export function computePricingWithRules(
  input: PricingInput,
  pricingVersion: number,
  rules: PricingRules,
): PricingResult {
  const lineItems: PricingLineItem[] = [
    { code: "base_plan", label: "Plano base", amountCents: input.basePlanPriceCents },
  ];

  for (const ext of [...input.extensions].sort()) {
    const price = rules.extensionPriceCents[ext];
    if (price !== undefined) {
      lineItems.push({ code: `ext:${ext}`, label: `Extensão: ${ext}`, amountCents: price });
    }
  }

  const subtotalCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  const appliedDiscounts: PricingResult["appliedDiscounts"] = [];

  // commitment discount — highest matching tier
  const months = input.commitmentPeriodMonths ?? 0;
  const commitTier = [...rules.commitmentDiscountPct]
    .sort((a, b) => b.minMonths - a.minMonths)
    .find((t) => months >= t.minMonths);
  if (commitTier) {
    appliedDiscounts.push({
      code: "commitment",
      pct: commitTier.pct,
      label: `Compromisso de ${months} meses`,
    });
  }

  // volume discount — highest matching tier
  const assets = input.assetQuantity ?? 0;
  const volTier = [...rules.volumeDiscountPctByAssetCount]
    .sort((a, b) => b.minAssets - a.minAssets)
    .find((t) => assets >= t.minAssets);
  if (volTier) {
    appliedDiscounts.push({
      code: "volume",
      pct: volTier.pct,
      label: `Volume: ${assets} ativos`,
    });
  }

  // annual prepay discount
  if (input.billingCycle === "yearly" && rules.yearlyPrepayDiscountPct > 0) {
    appliedDiscounts.push({
      code: "yearly_prepay",
      pct: rules.yearlyPrepayDiscountPct,
      label: "Pagamento anual antecipado",
    });
  }

  // Discounts stack additively on the subtotal (deterministic, no compounding
  // ambiguity), capped at 100%.
  const totalPct = Math.min(
    100,
    appliedDiscounts.reduce((sum, d) => sum + d.pct, 0),
  );
  const discountCents = Math.round((subtotalCents * totalPct) / 100);
  const totalMonthlyCents = subtotalCents - discountCents;
  const totalYearlyCents = totalMonthlyCents * 12;

  return {
    pricingVersion,
    currency: rules.currency,
    lineItems,
    subtotalCents,
    discountCents,
    totalMonthlyCents,
    totalYearlyCents,
    appliedDiscounts,
  };
}
