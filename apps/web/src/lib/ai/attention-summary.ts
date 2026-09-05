import type { SupabaseClient } from "@supabase/supabase-js";

export interface AttentionItem {
  source: { type: string; id: string };
  reason: string;
  severity: "low" | "medium" | "high";
  recommendedAction: string;
}

// Extracted from tools/intelligence.ts's getAttentionSummaryTool so both
// the read-only agent tool AND Wave 8's daily_summary automation call the
// exact same computation — never two implementations of "what needs
// attention." Fans out to 3 real, cheap, deterministic reads
// (maintenance_insights, contracts expiring soon, signature requests
// stuck pending). Deliberately never calls /api/ai/insights or
// /api/maintenance/auditor/run — those are an LLM call and a
// write/compute action respectively, neither of which this read-only
// summary may silently trigger.
export async function computeAttentionSummary(
  db: SupabaseClient,
  tenantId: string,
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  const { data: insights } = await db
    .from("maintenance_insights")
    .select("id, asset_id, type, severity, message")
    .eq("tenant_id", tenantId)
    .eq("status", "open");
  for (const i of insights ?? []) {
    items.push({
      source: { type: i.asset_id ? "asset" : "fleet", id: i.asset_id ?? i.id },
      reason: i.message,
      severity: i.severity === "high" ? "high" : "medium",
      recommendedAction:
        i.type === "critical_health_asset"
          ? "Revisar plano de manutenção do ativo"
          : i.type === "stale_recommendations"
            ? "Tratar recomendações de manutenção pendentes"
            : "Revisar saúde geral da frota",
    });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 15 * 86_400_000);
  const { data: contracts } = await db
    .from("contracts")
    .select("id, period_ends_at, organizations(name)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .gte("period_ends_at", now.toISOString())
    .lte("period_ends_at", cutoff.toISOString());
  for (const c of contracts ?? []) {
    const org = c.organizations as unknown as { name: string } | null;
    items.push({
      source: { type: "contract", id: c.id },
      reason: `Contrato${org?.name ? ` de ${org.name}` : ""} vence em ${new Date(c.period_ends_at as string).toLocaleDateString("pt-BR")}.`,
      severity: "medium",
      recommendedAction: "Verificar renovação ou encerramento do contrato",
    });
  }

  const staleCutoff = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data: pendingSignatures } = await db
    .from("signature_requests")
    .select(
      "id, contract_id, status, created_at, contracts!inner(id, tenant_id, organizations(name))",
    )
    .eq("contracts.tenant_id", tenantId)
    .in("status", ["sent", "in_progress"])
    .lte("created_at", staleCutoff);
  for (const s of pendingSignatures ?? []) {
    const contract = s.contracts as unknown as {
      id: string;
      organizations: { name: string } | null;
    };
    items.push({
      source: { type: "contract", id: s.contract_id as string },
      reason: `Assinatura do contrato${contract?.organizations?.name ? ` de ${contract.organizations.name}` : ""} está pendente há mais de 3 dias.`,
      severity: "medium",
      recommendedAction: "Cobrar assinatura ou reenviar solicitação",
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return items;
}
