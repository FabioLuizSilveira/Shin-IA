"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InvoiceDetail } from "@/components/ui/invoice-detail";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, Plus, X } from "lucide-react";
import type {
  Invoice,
  BillingAccount,
  Organization,
  InvoiceStatus,
  BillingAccountStatus,
} from "@/types/domain";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  one_time: "Avulso",
};

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  voided: "Anulada",
};

function invoiceStatusToUi(
  status: InvoiceStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "paid":
      return "active";
    case "draft":
    case "issued":
      return "pending";
    case "overdue":
      return "error";
    case "cancelled":
    case "voided":
      return "inactive";
    default:
      return "inactive";
  }
}

function billingStatusToUi(
  status: BillingAccountStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "active":
      return "active";
    case "suspended":
      return "warning";
    case "closed":
      return "inactive";
    default:
      return "inactive";
  }
}

const billingStatusLabel: Record<BillingAccountStatus, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  closed: "Encerrada",
};

type Tab = "invoices" | "billing-accounts";

type InvoiceRow = Invoice & { org_name: string };

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // New invoice form
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    billing_account_id: "",
    total_amount: "",
    total_currency: "BRL",
    due_date: "",
    description: "",
  });
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // New billing account form
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    organization_id: "",
    cycle: "monthly",
    credit_limit_amount: "",
    credit_limit_currency: "BRL",
  });
  const [submittingAccount, setSubmittingAccount] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, baRes, orgRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/billing-accounts"),
        fetch("/api/organizations"),
      ]);
      const [invJson, baJson, orgJson] = await Promise.all([
        invRes.json() as Promise<{ data: Invoice[] }>,
        baRes.json() as Promise<{ data: BillingAccount[] }>,
        orgRes.json() as Promise<{ data: Organization[] }>,
      ]);
      setInvoices(invJson.data ?? []);
      setBillingAccounts(baJson.data ?? []);
      setOrganizations(orgJson.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Metrics
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const totalFaturado = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const aReceber = invoices
    .filter((i) => i.status === "issued")
    .reduce((s, i) => s + Number(i.total_amount), 0);
  const vencidas = invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + Number(i.total_amount), 0);
  const pagasEsteMes = invoices
    .filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= startOfMonth)
    .reduce((s, i) => s + Number(i.total_amount), 0);

  // Invoice table rows
  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    ...inv,
    org_name: inv.billing_accounts?.organizations?.name ?? "—",
  }));

  type InvoiceRowRecord = InvoiceRow & Record<string, unknown>;

  const invoiceColumns = [
    {
      key: "id",
      label: "Nº",
      render: (row: InvoiceRowRecord) => (
        <span className="font-mono text-xs text-slate-500">
          {String(row.id).slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    { key: "org_name", label: "Organização" },
    {
      key: "total_amount",
      label: "Valor",
      render: (row: InvoiceRowRecord) => (
        <span className="font-semibold text-slate-900">{brl(Number(row.total_amount))}</span>
      ),
    },
    {
      key: "due_date",
      label: "Vencimento",
      render: (row: InvoiceRowRecord) => (
        <span className="text-slate-600">
          {new Date(String(row.due_date)).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: InvoiceRowRecord) => (
        <StatusBadge
          status={invoiceStatusToUi(row.status as InvoiceStatus)}
          label={invoiceStatusLabel[row.status as InvoiceStatus]}
        />
      ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (row: InvoiceRowRecord) => (
        <button
          onClick={() => setSelectedInvoiceId(String(row.id))}
          className="text-xs text-shina-blue hover:underline cursor-pointer border-0 bg-transparent"
        >
          Detalhes →
        </button>
      ),
    },
  ];

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingInvoice(true);
    try {
      await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_account_id: newInvoice.billing_account_id,
          total_amount: Number(newInvoice.total_amount),
          total_currency: newInvoice.total_currency,
          due_date: newInvoice.due_date,
          line_items: newInvoice.description
            ? [
                {
                  description: newInvoice.description,
                  quantity: 1,
                  unit_price_amount: Number(newInvoice.total_amount),
                  unit_price_currency: newInvoice.total_currency,
                },
              ]
            : [],
        }),
      });
      setNewInvoice({
        billing_account_id: "",
        total_amount: "",
        total_currency: "BRL",
        due_date: "",
        description: "",
      });
      setShowNewInvoice(false);
      await fetchAll();
    } finally {
      setSubmittingInvoice(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAccount(true);
    try {
      await fetch("/api/billing-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: newAccount.organization_id,
          cycle: newAccount.cycle,
          credit_limit_amount: Number(newAccount.credit_limit_amount),
          credit_limit_currency: newAccount.credit_limit_currency,
        }),
      });
      setNewAccount({
        organization_id: "",
        cycle: "monthly",
        credit_limit_amount: "",
        credit_limit_currency: "BRL",
      });
      setShowNewAccount(false);
      await fetchAll();
    } finally {
      setSubmittingAccount(false);
    }
  }

  return (
    <AppShell title="Financeiro">
      <SectionHeader
        title="Financeiro"
        description="Faturas, contas de cobrança e fluxo de caixa."
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Faturado"
          value={brl(totalFaturado)}
          trend="neutral"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="A Receber"
          value={brl(aReceber)}
          trend="up"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Vencidas"
          value={brl(vencidas)}
          trend={vencidas > 0 ? "down" : "neutral"}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <MetricCard
          title="Pagas este mês"
          value={brl(pagasEsteMes)}
          trend="up"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {(
          [
            { id: "invoices", label: "Faturas" },
            { id: "billing-accounts", label: "Contas de Cobrança" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Faturas tab */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Faturas</h3>
            <button
              onClick={() => setShowNewInvoice(!showNewInvoice)}
              className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors cursor-pointer border-0"
            >
              {showNewInvoice ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showNewInvoice ? "Cancelar" : "Nova Fatura"}
            </button>
          </div>

          {showNewInvoice && (
            <form
              onSubmit={(e) => void handleCreateInvoice(e)}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4"
            >
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Nova Fatura</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Conta de Cobrança
                  </label>
                  <select
                    value={newInvoice.billing_account_id}
                    onChange={(e) =>
                      setNewInvoice((p) => ({ ...p, billing_account_id: e.target.value }))
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  >
                    <option value="">Selecionar…</option>
                    {billingAccounts.map((ba) => (
                      <option key={ba.id} value={ba.id}>
                        {ba.organizations?.name} — {cycleLabels[ba.cycle] ?? ba.cycle}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Valor Total
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={newInvoice.total_currency}
                      onChange={(e) =>
                        setNewInvoice((p) => ({ ...p, total_currency: e.target.value }))
                      }
                      className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                    >
                      <option>BRL</option>
                      <option>USD</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newInvoice.total_amount}
                      onChange={(e) =>
                        setNewInvoice((p) => ({ ...p, total_amount: e.target.value }))
                      }
                      required
                      placeholder="0,00"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice((p) => ({ ...p, due_date: e.target.value }))}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Descrição (linha)
                  </label>
                  <input
                    type="text"
                    value={newInvoice.description}
                    onChange={(e) => setNewInvoice((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Ex: Serviço de logística"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="px-6 py-2.5 bg-shina-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 cursor-pointer border-0"
                >
                  {submittingInvoice ? "Criando…" : "Criar Fatura"}
                </button>
              </div>
            </form>
          )}

          <DataTable
            columns={invoiceColumns as Parameters<typeof DataTable>[0]["columns"]}
            data={invoiceRows as unknown as Record<string, unknown>[]}
            loading={loading}
          />
        </div>
      )}

      {/* Contas de Cobrança tab */}
      {activeTab === "billing-accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Contas de Cobrança</h3>
            <button
              onClick={() => setShowNewAccount(!showNewAccount)}
              className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors cursor-pointer border-0"
            >
              {showNewAccount ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showNewAccount ? "Cancelar" : "Nova Conta"}
            </button>
          </div>

          {showNewAccount && (
            <form
              onSubmit={(e) => void handleCreateAccount(e)}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4"
            >
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Nova Conta de Cobrança</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Organização
                  </label>
                  <select
                    value={newAccount.organization_id}
                    onChange={(e) =>
                      setNewAccount((p) => ({ ...p, organization_id: e.target.value }))
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  >
                    <option value="">Selecionar…</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ciclo</label>
                  <select
                    value={newAccount.cycle}
                    onChange={(e) => setNewAccount((p) => ({ ...p, cycle: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                    <option value="one_time">Avulso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Limite de Crédito
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={newAccount.credit_limit_currency}
                      onChange={(e) =>
                        setNewAccount((p) => ({ ...p, credit_limit_currency: e.target.value }))
                      }
                      className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                    >
                      <option>BRL</option>
                      <option>USD</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAccount.credit_limit_amount}
                      onChange={(e) =>
                        setNewAccount((p) => ({ ...p, credit_limit_amount: e.target.value }))
                      }
                      required
                      placeholder="0,00"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="px-6 py-2.5 bg-shina-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 cursor-pointer border-0"
                >
                  {submittingAccount ? "Criando…" : "Criar Conta"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {billingAccounts.map((ba) => (
                <div
                  key={ba.id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {ba.organizations?.name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ba.organizations?.type ?? ""}
                        {ba.organizations?.type ? " · " : ""}
                        {cycleLabels[ba.cycle] ?? ba.cycle}
                      </p>
                    </div>
                    <StatusBadge
                      status={billingStatusToUi(ba.status)}
                      label={billingStatusLabel[ba.status]}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Saldo utilizado</span>
                      <span>
                        {brl(Number(ba.balance_amount))} / {brl(Number(ba.credit_limit_amount))}
                      </span>
                    </div>
                    <ProgressBar
                      label=""
                      value={Number(ba.balance_amount)}
                      max={Number(ba.credit_limit_amount)}
                      showPercent={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice detail drawer */}
      <InvoiceDetail
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onStatusChange={() => void fetchAll()}
      />
    </AppShell>
  );
}
