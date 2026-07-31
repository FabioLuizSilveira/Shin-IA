"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, X, DollarSign, Check, XCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  description: string | null;
  calculation_type: "flat" | "percentage" | "tiered";
  base_rate: number;
  currency: string;
  period: string;
  status: "active" | "inactive" | "archived";
}

interface Rule {
  id: string;
  plan_id: string;
  name: string;
  priority: number;
  condition_type: string;
  rate_override: number | null;
  bonus_amount: number | null;
  is_active: boolean;
}

interface Campaign {
  id: string;
  plan_id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  bonus_rate: number;
  commission_plans: { name: string } | null;
}

interface Target {
  id: string;
  branch_id: string;
  plan_id: string;
  period_start: string;
  period_end: string;
  target_revenue: number;
  achieved_revenue: number;
  status: string;
  branches: { name: string } | null;
  commission_plans: { name: string } | null;
}

interface Transaction {
  id: string;
  branch_id: string;
  plan_id: string;
  gross_revenue: number;
  commission_rate: number;
  total_amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  branches: { name: string } | null;
  commission_plans: { name: string } | null;
}

interface Settlement {
  id: string;
  branch_id: string;
  transaction_ids: string[];
  total_amount: number;
  currency: string;
  status: string;
  scheduled_at: string;
  branches: { name: string } | null;
}

interface Branch {
  id: string;
  name: string;
}

const TABS = [
  { key: "plans", label: "Planos" },
  { key: "campaigns", label: "Campanhas" },
  { key: "targets", label: "Metas" },
  { key: "transactions", label: "Transações" },
  { key: "settlements", label: "Settlements" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

const STATUS_MAP: Record<string, "active" | "inactive" | "pending" | "error" | "warning"> = {
  active: "active",
  inactive: "inactive",
  archived: "inactive",
  draft: "pending",
  paused: "warning",
  completed: "active",
  cancelled: "inactive",
  pending: "pending",
  achieved: "active",
  partial: "warning",
  missed: "error",
  approved: "active",
  rejected: "error",
  paid: "active",
  processing: "pending",
  failed: "error",
};

// ── Modal shell (hand-rolled — no shared Modal component in this codebase) ────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function CommissionPage() {
  const [tab, setTab] = useState<TabKey>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rulesByPlan, setRulesByPlan] = useState<Record<string, Rule[]>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const [modal, setModal] = useState<
    "plan" | "rule" | "campaign" | "target" | "transaction" | "settlement" | null
  >(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ruleForPlan, setRuleForPlan] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, campaignsRes, targetsRes, txRes, settlementsRes, branchesRes] =
        await Promise.all([
          fetch("/api/commissions/plans"),
          fetch("/api/commissions/campaigns"),
          fetch("/api/commissions/targets"),
          fetch("/api/commissions/transactions"),
          fetch("/api/commissions/settlements"),
          fetch("/api/branches"),
        ]);
      setPlans(((await plansRes.json()) as { data?: Plan[] }).data ?? []);
      setCampaigns(((await campaignsRes.json()) as { data?: Campaign[] }).data ?? []);
      setTargets(((await targetsRes.json()) as { data?: Target[] }).data ?? []);
      setTransactions(((await txRes.json()) as { data?: Transaction[] }).data ?? []);
      setSettlements(((await settlementsRes.json()) as { data?: Settlement[] }).data ?? []);
      setBranches(((await branchesRes.json()) as { data?: Branch[] }).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function loadRules(planId: string) {
    const res = await fetch(`/api/commissions/plans/${planId}/rules`);
    const json = (await res.json()) as { data?: Rule[] };
    setRulesByPlan((prev) => ({ ...prev, [planId]: json.data ?? [] }));
  }

  function togglePlan(planId: string) {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(planId);
      if (!rulesByPlan[planId]) void loadRules(planId);
    }
  }

  async function submitJson(url: string, method: string, body: unknown) {
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha na operação");
      setModal(null);
      await loadAll();
      if (ruleForPlan) await loadRules(ruleForPlan);
      return true;
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Requests approval and reviews it in the same click — the API models
  // request/review as two distinct steps (a separate approver in a real
  // org), but a single admin driving both from one table row is the
  // realistic v1 flow for a small tenant team.
  async function decide(txId: string, decision: "approve" | "reject") {
    await fetch(`/api/commissions/transactions/${txId}/approval`, { method: "POST" });
    await fetch(`/api/commissions/transactions/${txId}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await loadAll();
  }
  async function markSettlementPaid(id: string) {
    await fetch(`/api/commissions/settlements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await loadAll();
  }

  return (
    <AppShell title="Comissões">
      <SectionHeader
        title="Gestão de Comissões"
        description="Planos, regras, campanhas de bônus, metas e liquidação de comissões por filial."
        action={
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setModal(
                tab === "plans"
                  ? "plan"
                  : tab === "campaigns"
                    ? "campaign"
                    : tab === "targets"
                      ? "target"
                      : tab === "transactions"
                        ? "transaction"
                        : "settlement",
              );
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {tab === "plans" && "Novo Plano"}
            {tab === "campaigns" && "Nova Campanha"}
            {tab === "targets" && "Nova Meta"}
            {tab === "transactions" && "Lançar Comissão"}
            {tab === "settlements" && "Criar Settlement"}
          </button>
        }
      />

      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer bg-transparent ${
              tab === t.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {tab === "plans" &&
            (plans.length === 0 ? (
              <Empty text="Nenhum plano de comissão cadastrado." />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {plans.map((p) => (
                  <div key={p.id}>
                    <button
                      type="button"
                      onClick={() => togglePlan(p.id)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left bg-transparent border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                          {p.calculation_type} · taxa base {(p.base_rate * 100).toFixed(1)}% ·{" "}
                          {p.period}
                        </p>
                      </div>
                      <StatusBadge status={STATUS_MAP[p.status] ?? "inactive"} label={p.status} />
                    </button>
                    {expandedPlan === p.id && (
                      <div className="px-6 pb-4 bg-slate-50 dark:bg-slate-950/40">
                        <div className="flex items-center justify-between mb-2 pt-2">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Regras
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setRuleForPlan(p.id);
                              setModalError(null);
                              setModal("rule");
                            }}
                            className="text-xs font-medium text-shina-blue bg-transparent border-0 cursor-pointer"
                          >
                            + Nova regra
                          </button>
                        </div>
                        {(rulesByPlan[p.id] ?? []).length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">Nenhuma regra.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {rulesByPlan[p.id]!.map((r) => (
                              <li
                                key={r.id}
                                className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800"
                              >
                                <span className="text-slate-700 dark:text-slate-300">
                                  {r.name} — {r.condition_type}
                                  {r.rate_override !== null &&
                                    ` (taxa ${(r.rate_override * 100).toFixed(1)}%)`}
                                  {r.bonus_amount !== null &&
                                    ` (+${formatCurrency(r.bonus_amount)})`}
                                </span>
                                <span className={r.is_active ? "text-green-600" : "text-slate-400"}>
                                  {r.is_active ? "ativa" : "inativa"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {tab === "campaigns" &&
            (campaigns.length === 0 ? (
              <Empty text="Nenhuma campanha de bônus cadastrada." />
            ) : (
              <Table
                head={["Campanha", "Plano", "Período", "Bônus", "Status"]}
                rows={campaigns.map((c) => [
                  c.name,
                  c.commission_plans?.name ?? "—",
                  `${formatDate(c.start_date)} → ${formatDate(c.end_date)}`,
                  `${(c.bonus_rate * 100).toFixed(1)}%`,
                  <StatusBadge
                    key="s"
                    status={STATUS_MAP[c.status] ?? "inactive"}
                    label={c.status}
                  />,
                ])}
              />
            ))}

          {tab === "targets" &&
            (targets.length === 0 ? (
              <Empty text="Nenhuma meta cadastrada." />
            ) : (
              <Table
                head={["Filial", "Plano", "Período", "Meta", "Alcançado", "Status"]}
                rows={targets.map((t) => [
                  t.branches?.name ?? "—",
                  t.commission_plans?.name ?? "—",
                  `${formatDate(t.period_start)} → ${formatDate(t.period_end)}`,
                  formatCurrency(t.target_revenue),
                  formatCurrency(t.achieved_revenue),
                  <StatusBadge
                    key="s"
                    status={STATUS_MAP[t.status] ?? "pending"}
                    label={t.status}
                  />,
                ])}
              />
            ))}

          {tab === "transactions" &&
            (transactions.length === 0 ? (
              <Empty text="Nenhuma transação de comissão lançada." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Filial</th>
                    <th className="px-6 py-3 text-left font-medium">Plano</th>
                    <th className="px-6 py-3 text-left font-medium">Receita bruta</th>
                    <th className="px-6 py-3 text-left font-medium">Comissão</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {t.branches?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {t.commission_plans?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {formatCurrency(t.gross_revenue, t.currency)}
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(t.total_amount, t.currency)}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={STATUS_MAP[t.status] ?? "pending"} label={t.status} />
                      </td>
                      <td className="px-6 py-3">
                        {t.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void decide(t.id, "approve")}
                              className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-transparent border-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => void decide(t.id, "reject")}
                              className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-transparent border-0 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === "settlements" &&
            (settlements.length === 0 ? (
              <Empty text="Nenhum settlement criado." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Filial</th>
                    <th className="px-6 py-3 text-left font-medium">Transações</th>
                    <th className="px-6 py-3 text-left font-medium">Total</th>
                    <th className="px-6 py-3 text-left font-medium">Agendado</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {s.branches?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {s.transaction_ids.length}
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(s.total_amount, s.currency)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(s.scheduled_at)}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={STATUS_MAP[s.status] ?? "pending"} label={s.status} />
                      </td>
                      <td className="px-6 py-3">
                        {s.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => void markSettlementPaid(s.id)}
                            className="text-xs font-semibold text-green-600 bg-transparent border-0 cursor-pointer"
                          >
                            Marcar como pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      )}

      {modal === "plan" && (
        <PlanModal
          onClose={() => setModal(null)}
          onSubmit={(body) => submitJson("/api/commissions/plans", "POST", body)}
          submitting={submitting}
          error={modalError}
        />
      )}
      {modal === "rule" && ruleForPlan && (
        <RuleModal
          onClose={() => {
            setModal(null);
            setRuleForPlan(null);
          }}
          onSubmit={(body) =>
            submitJson(`/api/commissions/plans/${ruleForPlan}/rules`, "POST", body)
          }
          submitting={submitting}
          error={modalError}
        />
      )}
      {modal === "campaign" && (
        <CampaignModal
          plans={plans}
          onClose={() => setModal(null)}
          onSubmit={(body) => submitJson("/api/commissions/campaigns", "POST", body)}
          submitting={submitting}
          error={modalError}
        />
      )}
      {modal === "target" && (
        <TargetModal
          plans={plans}
          branches={branches}
          onClose={() => setModal(null)}
          onSubmit={(body) => submitJson("/api/commissions/targets", "POST", body)}
          submitting={submitting}
          error={modalError}
        />
      )}
      {modal === "transaction" && (
        <TransactionModal
          plans={plans.filter((p) => p.status === "active")}
          branches={branches}
          onClose={() => setModal(null)}
          onSubmit={(body) => submitJson("/api/commissions/transactions", "POST", body)}
          submitting={submitting}
          error={modalError}
        />
      )}
      {modal === "settlement" && (
        <SettlementModal
          branches={branches}
          approvedTransactions={transactions.filter((t) => t.status === "approved")}
          onClose={() => setModal(null)}
          onSubmit={(body) => submitJson("/api/commissions/settlements", "POST", body)}
          submitting={submitting}
          error={modalError}
        />
      )}
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{text}</div>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-6 py-3 text-left font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
            {row.map((cell, j) => (
              <td key={j} className="px-6 py-3 text-slate-700 dark:text-slate-300">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────────

function PlanModal({
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [calculationType, setCalculationType] = useState("percentage");
  const [baseRate, setBaseRate] = useState("10");
  const [period, setPeriod] = useState("monthly");

  return (
    <ModalShell title="Novo Plano de Comissão" onClose={onClose}>
      <Field label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Tipo de cálculo">
        <select
          value={calculationType}
          onChange={(e) => setCalculationType(e.target.value)}
          className={inputCls}
        >
          <option value="percentage">Percentual</option>
          <option value="flat">Fixo</option>
          <option value="tiered">Escalonado</option>
        </select>
      </Field>
      <Field label="Taxa base (%)">
        <input
          type="number"
          step="0.1"
          value={baseRate}
          onChange={(e) => setBaseRate(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Período">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>
          <option value="monthly">Mensal</option>
          <option value="weekly">Semanal</option>
          <option value="quarterly">Trimestral</option>
          <option value="annual">Anual</option>
        </select>
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={submitting || !name.trim()}
        onClick={() =>
          void onSubmit({
            name,
            calculation_type: calculationType,
            base_rate: Number(baseRate) / 100,
            period,
          })
        }
        className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
      >
        {submitting ? "Criando..." : "Criar plano"}
      </button>
    </ModalShell>
  );
}

function RuleModal({
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState("always");
  const [rateOverride, setRateOverride] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");

  return (
    <ModalShell title="Nova Regra" onClose={onClose}>
      <Field label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Condição">
        <select
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value)}
          className={inputCls}
        >
          <option value="always">Sempre</option>
          <option value="revenue_threshold">Acima de receita</option>
          <option value="operation_count">Acima de nº de operações</option>
          <option value="resource_type">Tipo de recurso</option>
          <option value="branch">Filial específica</option>
        </select>
      </Field>
      <Field label="Taxa substituta (%, opcional)">
        <input
          type="number"
          step="0.1"
          value={rateOverride}
          onChange={(e) => setRateOverride(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Bônus fixo (R$, opcional)">
        <input
          type="number"
          step="0.01"
          value={bonusAmount}
          onChange={(e) => setBonusAmount(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={submitting || !name.trim()}
        onClick={() =>
          void onSubmit({
            name,
            condition_type: conditionType,
            rate_override: rateOverride ? Number(rateOverride) / 100 : undefined,
            bonus_amount: bonusAmount ? Number(bonusAmount) : undefined,
          })
        }
        className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
      >
        {submitting ? "Criando..." : "Criar regra"}
      </button>
    </ModalShell>
  );
}

function CampaignModal({
  plans,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  plans: Plan[];
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bonusRate, setBonusRate] = useState("10");

  return (
    <ModalShell title="Nova Campanha de Bônus" onClose={onClose}>
      <Field label="Plano">
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Fim">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Bônus adicional (%)">
        <input
          type="number"
          step="0.1"
          value={bonusRate}
          onChange={(e) => setBonusRate(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={submitting || !name.trim() || !planId || !startDate || !endDate}
        onClick={() =>
          void onSubmit({
            plan_id: planId,
            name,
            start_date: startDate,
            end_date: endDate,
            bonus_rate: Number(bonusRate) / 100,
          })
        }
        className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
      >
        {submitting ? "Criando..." : "Criar campanha"}
      </button>
    </ModalShell>
  );
}

function TargetModal({
  plans,
  branches,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  plans: Plan[];
  branches: Branch[];
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [targetRevenue, setTargetRevenue] = useState("");

  return (
    <ModalShell title="Nova Meta" onClose={onClose}>
      <Field label="Filial">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Plano">
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início do período">
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Fim do período">
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Meta de receita (R$)">
        <input
          type="number"
          step="0.01"
          value={targetRevenue}
          onChange={(e) => setTargetRevenue(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={
          submitting || !planId || !branchId || !periodStart || !periodEnd || !targetRevenue
        }
        onClick={() =>
          void onSubmit({
            plan_id: planId,
            branch_id: branchId,
            period_start: periodStart,
            period_end: periodEnd,
            target_revenue: Number(targetRevenue),
          })
        }
        className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
      >
        {submitting ? "Criando..." : "Criar meta"}
      </button>
    </ModalShell>
  );
}

function TransactionModal({
  plans,
  branches,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  plans: Plan[];
  branches: Branch[];
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [grossRevenue, setGrossRevenue] = useState("");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(monthEnd);

  return (
    <ModalShell title="Lançar Comissão" onClose={onClose}>
      {plans.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum plano ativo. Crie um plano de comissão primeiro.
        </p>
      ) : (
        <>
          <Field label="Filial">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={inputCls}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plano">
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Receita bruta (R$)">
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                step="0.01"
                value={grossRevenue}
                onChange={(e) => setGrossRevenue(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início do período">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Fim do período">
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            disabled={submitting || !planId || !branchId || !grossRevenue}
            onClick={() =>
              void onSubmit({
                plan_id: planId,
                branch_id: branchId,
                gross_revenue: Number(grossRevenue),
                period_start: periodStart,
                period_end: periodEnd,
              })
            }
            className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
          >
            {submitting ? "Calculando..." : "Lançar comissão"}
          </button>
        </>
      )}
    </ModalShell>
  );
}

function SettlementModal({
  branches,
  approvedTransactions,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  branches: Branch[];
  approvedTransactions: Transaction[];
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const branchTx = approvedTransactions.filter((t) => t.branch_id === branchId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ModalShell title="Criar Settlement" onClose={onClose}>
      <Field label="Filial">
        <select
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setSelected(new Set());
          }}
          className={inputCls}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Transações aprovadas">
        {branchTx.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma transação aprovada para esta filial.</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {branchTx.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  {formatCurrency(t.total_amount, t.currency)} — {t.commission_plans?.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </Field>
      <Field label="Data agendada">
        <input
          type="date"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={submitting || !branchId || selected.size === 0 || !scheduledAt}
        onClick={() =>
          void onSubmit({
            branch_id: branchId,
            transaction_ids: Array.from(selected),
            scheduled_at: scheduledAt,
          })
        }
        className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
      >
        {submitting ? "Criando..." : "Criar settlement"}
      </button>
    </ModalShell>
  );
}
