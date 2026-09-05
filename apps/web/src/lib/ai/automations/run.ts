import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAttentionSummary } from "../attention-summary";
import { createNotification } from "@/lib/notifications/create-notification";

interface AutomationRow {
  id: string;
  tenant_id: string;
  automation_type: "daily_summary" | "contract_expiry_alert";
  conditions: Record<string, unknown>;
  last_run_state: Record<string, unknown>;
}

export interface AutomationRunResult {
  automationId: string;
  status: "ok" | "error" | "skipped_no_items";
  error?: string;
}

// Wave 8's execution loop — called only from the CRON_SECRET-guarded
// cron route, never from a user request. Only two automation_types exist
// (schema-constrained, see the Wave 8 migration) and neither ever
// mutates tenant business data or proposes an ActionPlan — both are
// notify-only, matching the spec's LOW_RISK/REVERSIBLE restriction for
// this wave structurally, not just by convention.
export async function runDueAutomations(admin: SupabaseClient): Promise<AutomationRunResult[]> {
  // Platform-level circuit breaker: a tenant's automations only ever run
  // if BOTH this tenant-wide flag AND the individual automation's own
  // `enabled` are true — two independent gates, neither sufficient alone
  // (same defense-in-depth posture as every prior wave's permission +
  // feature-flag double-check).
  const { data: enabledFlags } = await admin
    .from("tenant_feature_flags")
    .select("tenant_id")
    .eq("flag_key", "agent.automation.enabled")
    .eq("enabled", true);
  const enabledTenantIds = (enabledFlags ?? []).map((f) => f.tenant_id as string);
  if (enabledTenantIds.length === 0) return [];

  const { data: automations } = await admin
    .from("agent_automations")
    .select("id, tenant_id, automation_type, conditions, last_run_state")
    .in("tenant_id", enabledTenantIds)
    .eq("enabled", true)
    .eq("frequency", "daily");

  const results: AutomationRunResult[] = [];
  for (const row of (automations ?? []) as unknown as AutomationRow[]) {
    try {
      const result = await runOne(admin, row);
      results.push({
        automationId: result.automationId,
        status: result.status,
        error: result.error,
      });
      await admin
        .from("agent_automations")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: result.status,
          last_run_state:
            result.status === "error"
              ? row.last_run_state
              : ((result as { newState?: Record<string, unknown> }).newState ?? row.last_run_state),
        })
        .eq("id", row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ automationId: row.id, status: "error", error: message });
      await admin
        .from("agent_automations")
        .update({ last_run_at: new Date().toISOString(), last_run_status: "error" })
        .eq("id", row.id);
    }
  }
  return results;
}

async function runOne(
  admin: SupabaseClient,
  row: AutomationRow,
): Promise<AutomationRunResult & { newState?: Record<string, unknown> }> {
  if (row.automation_type === "daily_summary") {
    const items = await computeAttentionSummary(admin, row.tenant_id);
    if (items.length === 0) return { automationId: row.id, status: "skipped_no_items" };

    const top = items.slice(0, 5);
    const body = top.map((i) => `• ${i.reason} (${i.recommendedAction})`).join("\n");
    await createNotification({
      tenantId: row.tenant_id,
      subject: `Bom dia! ${items.length} situação(ões) merecem sua atenção.`,
      body,
      priority: "normal",
    });
    return { automationId: row.id, status: "ok" };
  }

  // contract_expiry_alert
  const withinDays = typeof row.conditions.withinDays === "number" ? row.conditions.withinDays : 7;
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 86_400_000);
  const { data: contracts } = await admin
    .from("contracts")
    .select("id, period_ends_at, organizations(name)")
    .eq("tenant_id", row.tenant_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .gte("period_ends_at", now.toISOString())
    .lte("period_ends_at", cutoff.toISOString());

  // Dedup: only notify about a contract id once — simplification (see
  // Wave 8 migration comment on last_run_state), a contract's expiry date
  // never moves further out once set, so "already notified" never needs
  // to be un-set. A tenant that wants a fresh reminder as the deadline
  // gets closer would need a richer per-threshold model — same idea as
  // infraction-deadlines.ts's alerted_thresholds, deliberately not built
  // this round.
  const alreadyNotified = new Set((row.last_run_state.notifiedContractIds as string[]) ?? []);
  const fresh = (contracts ?? []).filter((c) => !alreadyNotified.has(c.id as string));
  if (fresh.length === 0) return { automationId: row.id, status: "skipped_no_items" };

  const body = fresh
    .map((c) => {
      const org = c.organizations as unknown as { name: string } | null;
      return `• Contrato${org?.name ? ` de ${org.name}` : ""} vence em ${new Date(c.period_ends_at as string).toLocaleDateString("pt-BR")}.`;
    })
    .join("\n");
  await createNotification({
    tenantId: row.tenant_id,
    subject: `${fresh.length} contrato(s) vencendo em breve`,
    body,
    priority: "normal",
  });

  const newState = {
    notifiedContractIds: [...alreadyNotified, ...fresh.map((c) => c.id as string)],
  };
  return { automationId: row.id, status: "ok", newState };
}
