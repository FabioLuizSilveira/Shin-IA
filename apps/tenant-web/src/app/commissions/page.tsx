"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Award,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ListChecks,
  FileStack,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommissionPlan {
  id: string;
  name: string;
  description: string | null;
  calculation_type: "flat" | "percentage" | "tiered";
  base_rate: number;
  currency: string;
  status: "active" | "inactive" | "draft";
  resource_count?: number;
}

interface CommissionTransaction {
  id: string;
  resource_id: string;
  resource_name?: string;
  gross_revenue: number;
  commission_amount: number;
  bonus_amount: number;
  total_amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "settled";
  period_date: string;
  created_at: string;
}

interface CommissionSummary {
  pending: number;
  approved: number;
  pendingAmount: number;
  approvedAmount: number;
}

type Tab = "plans" | "transactions" | "approvals";

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-slate-100 text-slate-500",
    draft: "bg-amber-100 text-amber-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    settled: "bg-blue-100 text-blue-700",
  };
  const labels: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    draft: "Rascunho",
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    settled: "Liquidado",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? "bg-slate-100 text-slate-500"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function fmt(amount: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommissionsPage() {
  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    pending: 0,
    approved: 0,
    pendingAmount: 0,
    approvedAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [plansRes, txRes] = await Promise.all([
      fetch("/api/commissions/plans"),
      fetch("/api/commissions/transactions"),
    ]);
    const plansJson = (await plansRes.json()) as { data?: CommissionPlan[] };
    const txJson = (await txRes.json()) as { data?: CommissionTransaction[] };

    const txList = txJson.data ?? [];
    setPlans(plansJson.data ?? []);
    setTransactions(txList);

    setSummary({
      pending: txList.filter((t) => t.status === "pending").length,
      approved: txList.filter((t) => t.status === "approved").length,
      pendingAmount: txList
        .filter((t) => t.status === "pending")
        .reduce((s, t) => s + t.total_amount, 0),
      approvedAmount: txList
        .filter((t) => t.status === "approved")
        .reduce((s, t) => s + t.total_amount, 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleApprove(txId: string, approved: boolean) {
    setApproving(txId);
    await fetch(`/api/commissions/transactions/${txId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    await loadData();
    setApproving(null);
  }

  const TABS = [
    { id: "plans" as const, label: "Planos", icon: ListChecks },
    { id: "transactions" as const, label: "Transações", icon: DollarSign },
    { id: "approvals" as const, label: "Aprovações", icon: FileStack },
  ];

  return (
    <AppShell title="Comissões">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Pendentes",
            value: summary.pending,
            sub: fmt(summary.pendingAmount),
            icon: Clock,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Aprovadas",
            value: summary.approved,
            sub: fmt(summary.approvedAmount),
            icon: CheckCircle2,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Planos ativos",
            value: plans.filter((p) => p.status === "active").length,
            icon: TrendingUp,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Total aprovado",
            value: fmt(summary.approvedAmount),
            icon: Award,
            color: "text-purple-600 bg-purple-50",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div
                className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
              {s.sub && <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              id={`commissions-tab-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Plans */}
          {tab === "plans" && (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <button
                  id="commission-new-plan"
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Novo plano
                </button>
              </div>
              {plans.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Nenhum plano cadastrado"
                  description="Crie planos de comissão para seus recursos."
                />
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                        <StatusBadge status={plan.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {plan.description ?? "Sem descrição"}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-xs text-slate-400">
                          Tipo:{" "}
                          <span className="text-slate-600 font-medium capitalize">
                            {plan.calculation_type}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">
                          Taxa base:{" "}
                          <span className="text-slate-600 font-medium">
                            {plan.calculation_type === "percentage"
                              ? `${(plan.base_rate * 100).toFixed(1)}%`
                              : fmt(plan.base_rate, plan.currency)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transactions */}
          {tab === "transactions" && (
            <div>
              {transactions.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="Nenhuma transação"
                  description="Transações aparecem quando operações concluídas disparam o cálculo de comissão."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {[
                          "Recurso",
                          "Receita",
                          "Comissão",
                          "Bônus",
                          "Total",
                          "Período",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-slate-900 font-medium">
                            {tx.resource_name ?? tx.resource_id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {fmt(tx.gross_revenue, tx.currency)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {fmt(tx.commission_amount, tx.currency)}
                          </td>
                          <td className="py-3 px-4 text-green-600">
                            {fmt(tx.bonus_amount, tx.currency)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {fmt(tx.total_amount, tx.currency)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-xs">
                            {new Date(tx.period_date).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={tx.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Approvals */}
          {tab === "approvals" && (
            <div className="space-y-3">
              {transactions.filter((t) => t.status === "pending").length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nenhuma aprovação pendente"
                  description="Transações pendentes aparecerão aqui para aprovação."
                />
              ) : (
                transactions
                  .filter((t) => t.status === "pending")
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {tx.resource_name ?? tx.resource_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Total:{" "}
                          <span className="font-semibold text-slate-900">
                            {fmt(tx.total_amount, tx.currency)}
                          </span>
                          {" · "}Período: {new Date(tx.period_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          id={`commission-reject-${tx.id}`}
                          type="button"
                          disabled={approving === tx.id}
                          onClick={() => void handleApprove(tx.id, false)}
                          className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rejeitar
                        </button>
                        <button
                          id={`commission-approve-${tx.id}`}
                          type="button"
                          disabled={approving === tx.id}
                          onClick={() => void handleApprove(tx.id, true)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
    </div>
  );
}
