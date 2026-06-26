// Edge Function: calculate-commission
// Triggered by operation.completed event or called directly from API
// Evaluates commission rules and records a transaction in commission_transactions

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CalculateRequest {
  operationId: string;
  tenantId: string;
  resourceId: string;
  branchId: string;
  grossRevenue: number;
  operationCount?: number;
  resourceType?: string;
  date: string;
}

interface CommissionPlanRow {
  id: string;
  name: string;
  calculation_type: string;
  base_rate: number;
  currency: string;
  tiers: Array<{ min_amount: number; max_amount: number | null; rate: number }>;
}

interface CommissionRuleRow {
  id: string;
  priority: number;
  condition_type: string;
  condition_value: unknown;
  rate_override: number | null;
  bonus_amount: number | null;
  is_active: boolean;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: CalculateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    operationId,
    tenantId,
    resourceId,
    branchId,
    grossRevenue,
    operationCount = 1,
    resourceType,
    date,
  } = body;

  if (!operationId || !tenantId || !resourceId || !grossRevenue) {
    return Response.json({ error: "Missing required fields" }, { status: 422 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Check for duplicate (idempotency)
  const { data: existing } = await admin
    .from("commission_transactions")
    .select("id")
    .eq("source_operation_id", operationId)
    .maybeSingle();

  if (existing) {
    console.log(`[calculate-commission] already calculated for operation ${operationId}`);
    return Response.json({ skipped: true, reason: "already_calculated" });
  }

  // Find active commission plan for this resource/branch
  const { data: planRow, error: planError } = await admin
    .from("commission_plans")
    .select("id, name, calculation_type, base_rate, currency, tiers")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .or(`resource_id.eq.${resourceId},resource_id.is.null`)
    .order("resource_id", { ascending: false }) // specific resource first
    .limit(1)
    .maybeSingle();

  if (planError || !planRow) {
    console.log(`[calculate-commission] no active plan for resource ${resourceId}`);
    return Response.json({ skipped: true, reason: "no_active_plan" });
  }

  const plan = planRow as CommissionPlanRow;

  // Get rules for this plan
  const { data: rules } = await admin
    .from("commission_rules")
    .select("id, priority, condition_type, condition_value, rate_override, bonus_amount, is_active")
    .eq("plan_id", plan.id)
    .eq("is_active", true)
    .order("priority");

  // Calculate using inline logic (mirrors CommissionCalculator package)
  let commissionAmount = 0;
  const appliedRules: string[] = [];
  let rateOverride: number | null = null;
  let bonusAmount = 0;

  for (const rule of (rules ?? []) as CommissionRuleRow[]) {
    let conditionMet = false;
    switch (rule.condition_type) {
      case "always":
        conditionMet = true;
        break;
      case "revenue_threshold":
        conditionMet = grossRevenue >= (rule.condition_value as number);
        break;
      case "operation_count":
        conditionMet = operationCount >= (rule.condition_value as number);
        break;
      case "resource_type":
        conditionMet = resourceType === rule.condition_value;
        break;
      case "branch":
        conditionMet = branchId === rule.condition_value;
        break;
    }
    if (!conditionMet) continue;
    appliedRules.push(rule.id);
    if (rule.rate_override !== null) rateOverride = rule.rate_override;
    if (rule.bonus_amount !== null) bonusAmount += rule.bonus_amount;
  }

  const effectiveRate = rateOverride ?? plan.base_rate;

  if (plan.calculation_type === "flat") {
    commissionAmount = effectiveRate;
  } else if (plan.calculation_type === "percentage") {
    commissionAmount = grossRevenue * effectiveRate;
  } else if (plan.calculation_type === "tiered") {
    const tiers = (plan.tiers ?? []).sort((a, b) => a.min_amount - b.min_amount);
    let remaining = grossRevenue;
    for (const tier of tiers) {
      if (remaining <= 0 || grossRevenue < tier.min_amount) break;
      const tierMax = tier.max_amount ?? Infinity;
      const applicable = Math.min(remaining, tierMax - tier.min_amount);
      if (applicable <= 0) continue;
      commissionAmount += applicable * tier.rate;
      remaining -= applicable;
    }
  }

  const totalAmount = commissionAmount + bonusAmount;

  // Insert transaction
  const transactionId = crypto.randomUUID();
  const { error: insertError } = await admin.from("commission_transactions").insert({
    id: transactionId,
    tenant_id: tenantId,
    plan_id: plan.id,
    resource_id: resourceId,
    branch_id: branchId,
    source_operation_id: operationId,
    gross_revenue: grossRevenue,
    commission_rate: effectiveRate,
    commission_amount: commissionAmount,
    bonus_amount: bonusAmount,
    total_amount: totalAmount,
    currency: plan.currency,
    applied_rules: appliedRules,
    status: "pending",
    period_date: date,
  });

  if (insertError) {
    console.error("[calculate-commission] insert error:", insertError.message);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  console.log(
    `[calculate-commission] ok transaction=${transactionId} total=${totalAmount} ${plan.currency}`,
  );
  return Response.json({ success: true, transactionId, totalAmount, currency: plan.currency });
});
