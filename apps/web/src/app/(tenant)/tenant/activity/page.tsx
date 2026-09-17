"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ActivityEntry {
  id: string;
  actor_id: string;
  actor_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Every entity_type actually written by logActivity() across the codebase
// (grep "logActivity(" for the full call-site list) — kept in sync with
// that, not exhaustively enumerated up front. Unmapped values still render
// fine (see the ?? fallback below), just as the raw snake_case string —
// this is a label dictionary, not a whitelist.
const ENTITY_LABEL: Record<string, string> = {
  contract: "Contrato",
  contract_document: "Documento de contrato",
  contract_template: "Modelo de contrato",
  contract_acceptance: "Aceite de contrato",
  operation: "Operação",
  asset: "Ativo",
  commission_transaction: "Comissão",
  inspection: "Vistoria",
  inspection_finding: "Constatação de vistoria",
  inspection_dispute: "Contestação de vistoria",
  inspection_template: "Modelo de vistoria",
  infraction_case: "Infração",
  infraction_deadline: "Prazo de infração",
  infraction_dispute: "Recurso de infração",
  infraction_defense: "Defesa de infração",
  infraction_driver_identification: "Identificação de condutor",
  infraction_provider_sync_run: "Importação de infrações",
  maintenance_order: "Ordem de manutenção",
  maintenance_recommendation: "Recomendação de manutenção",
  blueprint: "Blueprint",
  studio_config: "Configuração do Studio",
  operator: "Operador",
  tenant: "Tenant",
  subscription: "Assinatura",
  impersonation_session: "Sessão de suporte (impersonation)",
  notification: "Notificação",
  resource_location: "Localização de recurso",
  mobile_device: "Dispositivo móvel",
  // Agent Runtime v2/v3 — the entityType values logActivity() actually
  // gets called with from apps/web/src/app/api/ai/agent/* and
  // agent-automations code, none of which had a label before (fell back
  // to the raw snake_case string).
  ai_agent: "Assistente Shinã",
  agent_goal: "Objetivo do assistente",
  agent_action_plan: "Plano de ação do assistente",
  agent_automation: "Automação do assistente",
  financial_entry: "Lançamento financeiro",
};

const ACTION_LABEL: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  deleted: "Excluído",
  status_changed: "Status alterado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  accepted: "Aceito",
  disputed: "Contestado",
  signed: "Assinado",
  compared: "Comparado",
  rematched: "Reavaliado",
  installed: "Instalado",
  uninstalled: "Desinstalado",
  published: "Publicado",
  started: "Iniciada",
  ended: "Encerrada",
  dismissed: "Descartada",
  gate_failures_present: "Falhas de bloqueio identificadas",
  report_generated: "Relatório gerado",
  report_downloaded: "Relatório baixado",
  report_shared: "Relatório compartilhado",
  report_share_revoked: "Compartilhamento revogado",
  report_share_accessed: "Relatório acessado (link compartilhado)",
  converted_to_maintenance: "Convertida em manutenção",
  responsibility_suggested: "Responsabilidade sugerida",
  responsibility_confirmed: "Responsabilidade confirmada",
  responsibility_rejected: "Responsabilidade rejeitada",
  payment_registered: "Pagamento registrado",
  unmatched_reprocessed: "Reprocessada (sem correspondência)",
  driver_identification_registered: "Condutor identificado",
  csv_import_completed: "Importação CSV concluída",
  deadline_overdue: "Prazo vencido",
  deadline_due_soon: "Prazo próximo do vencimento",
  "contract.presented": "Contrato apresentado",
  "contract.accepted": "Contrato aceito",
  "contract.operation_blocked": "Operação bloqueada por contrato",
  "contract.operation_released": "Operação liberada",
  "contract_template.published": "Modelo de contrato publicado",
  "document.approved": "Documento aprovado",
  "document.rejected": "Documento rejeitado",
  "document.uploaded": "Documento enviado",
  "subscription.activated": "Assinatura ativada",
  "plan.upgraded": "Plano promovido (upgrade)",
  "plan.downgraded": "Plano reduzido (downgrade)",
  "checkout.created": "Checkout iniciado",
  "notification.push_delivered": "Notificação push entregue",
  "tracking.viewed": "Localização consultada",
  "tracking.history_viewed": "Histórico de localização consultado",
  "mobile_device.registered": "Dispositivo registrado",
  "mobile_device.disabled": "Dispositivo desativado",
  // Signature Platform (P2) — "Assinatura eletrônica" prefix everywhere to
  // disambiguate from "subscription.activated" above ("Assinatura
  // ativada"), same Portuguese word for a different concept.
  signature_requested: "Assinatura eletrônica solicitada",
  signature_cancelled_by_tenant: "Assinatura eletrônica cancelada pelo tenant",
  signature_request_sent: "Assinatura eletrônica enviada",
  signer_viewed: "Documento visualizado pelo signatário",
  signer_signed: "Signatário assinou",
  signer_refused: "Signatário recusou assinar",
  signature_completed: "Assinatura eletrônica concluída",
  signature_cancelled: "Assinatura eletrônica cancelada",
  signature_expired: "Assinatura eletrônica expirada",
  signature_failed: "Assinatura eletrônica falhou",
  // Agent Runtime v2/v3 (apps/web/src/lib/ai/audit-events.ts) — every
  // constant in AI_AGENT_EVENTS/AI_GOAL_EVENTS/AI_ACTION_EVENTS/
  // AI_CREDIT_EVENTS, none of which had a PT-BR label before (rendered
  // as the raw "AI_AGENT_TOOL_EXECUTED"-style constant value).
  AI_AGENT_REQUEST: "Pergunta enviada à Shinã",
  AI_AGENT_RESPONSE: "Resposta da Shinã",
  AI_AGENT_TOOL_REQUESTED: "Ferramenta solicitada",
  AI_AGENT_TOOL_EXECUTED: "Ferramenta executada",
  AI_AGENT_TOOL_DENIED: "Ferramenta negada",
  AI_AGENT_TOOL_FAILED: "Ferramenta falhou",
  AI_VOICE_TRANSCRIBED: "Áudio transcrito",
  AI_AGENT_ATTACHMENT_PROCESSED: "Anexo processado",
  AI_AGENT_INTENT_CLASSIFIED: "Intenção classificada",
  AI_AGENT_TOOLS_FILTERED: "Ferramentas filtradas",
  AI_AGENT_MODEL_ROUTED: "Modelo de IA selecionado",
  AGENT_ENTITY_RESOLVED: "Entidade identificada",
  AGENT_ENTITY_AMBIGUOUS: "Entidade ambígua",
  AGENT_GOAL_CREATED: "Objetivo criado",
  AGENT_GOAL_RESUMED: "Objetivo retomado",
  AGENT_GOAL_UPDATED: "Objetivo atualizado",
  AGENT_GOAL_COMPLETED: "Objetivo concluído",
  AGENT_GOAL_CANCELLED: "Objetivo cancelado",
  AGENT_NEXT_ACTION_SELECTED: "Próxima ação definida",
  AGENT_WORKFLOW_STARTED: "Fluxo iniciado",
  AGENT_WORKFLOW_RESUMED: "Fluxo retomado",
  AGENT_WORKFLOW_STEP_COMPLETED: "Etapa do fluxo concluída",
  AI_ACTION_PROPOSED: "Ação proposta",
  AI_ACTION_CONFIRMED: "Ação confirmada",
  AI_ACTION_EXECUTED: "Ação executada",
  AI_ACTION_EXECUTION_FAILED: "Execução da ação falhou",
  AI_ACTION_CANCELLED: "Ação cancelada",
  AI_ACTION_DENIED: "Ação negada",
  AI_CREDIT_RESERVED: "Créditos reservados",
  AI_CREDIT_USAGE: "Créditos utilizados",
  AI_CREDIT_SETTLED: "Créditos liquidados",
  AI_CREDIT_DENIED: "Créditos insuficientes",
  AI_CREDIT_PURCHASED: "Créditos comprados",
  AI_CREDIT_GRANTED: "Créditos concedidos",
};

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeMetadata(entry: ActivityEntry): string {
  const m = entry.metadata;
  if (entry.action === "status_changed" && m.from && m.to) {
    return `${m.from} → ${m.to}`;
  }
  if (entry.entity_type === "contract" && entry.action === "created" && m.type) {
    return String(m.type);
  }
  if (entry.entity_type === "asset" && entry.action === "created" && m.name) {
    return String(m.name);
  }
  return "";
}

export default function TenantActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant-activity");
      const json = (await res.json()) as { data?: ActivityEntry[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar atividade");
      setEntries(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell title="Atividade">
      <SectionHeader
        title="Atividade da Equipe"
        description="O que a equipe fez recentemente — criação de contratos, mudanças de status, aprovações."
      />

      <div className="flex items-center justify-end mb-4">
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="h-64 animate-pulse bg-slate-50 dark:bg-slate-800" />
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Quem</th>
                <th className="px-6 py-3 text-left font-medium">Entidade</th>
                <th className="px-6 py-3 text-left font-medium">Ação</th>
                <th className="px-6 py-3 text-left font-medium">Detalhe</th>
                <th className="px-6 py-3 text-left font-medium">Quando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {entry.actor_name ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                    {ENTITY_LABEL[entry.entity_type] ?? entry.entity_type}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {describeMetadata(entry)}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
