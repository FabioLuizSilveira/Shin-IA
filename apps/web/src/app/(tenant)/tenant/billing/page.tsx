"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { InvoiceDetail } from "@/components/ui/invoice-detail";
import { ExportButton } from "@/components/ui/export-button";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@shina/design-system";
import type { Invoice, InvoiceStatus } from "@/types/domain";

interface FinancialEntry {
  id: string;
  type: "expense" | "revenue";
  description: string;
  category: string | null;
  amount_cents: number;
  currency: string;
  entry_date: string;
  notes: string | null;
  organization_id: string | null;
  organizations: { id: string; name: string } | null;
  created_at: string;
}

interface OrganizationOption {
  id: string;
  name: string;
}

const ENTRY_TYPE_LABEL: Record<FinancialEntry["type"], string> = {
  revenue: "Receita",
  expense: "Despesa",
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function invoiceStatusToUi(
  status: InvoiceStatus,
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "paid":
      return "active";
    case "overdue":
      return "error";
    case "cancelled":
    case "voided":
      return "inactive";
    default:
      return "pending";
  }
}

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  voided: "Anulada",
};

type InvoiceRow = Invoice & Record<string, unknown>;

export default function TenantBillingPage() {
  const { show } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryType, setEntryType] = useState<FinancialEntry["type"]>("expense");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryCategory, setEntryCategory] = useState("");
  const [entryOrganizationId, setEntryOrganizationId] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryNotes, setEntryNotes] = useState("");
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  // Filters (spec: "filtrar por cliente, categoria, valor, etc") — all
  // optional and combinable, applied server-side by loadEntries below.
  const [filterType, setFilterType] = useState<"" | FinancialEntry["type"]>("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterOrganizationId, setFilterOrganizationId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      const json = (await res.json()) as { data?: Invoice[] };
      setInvoices(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterType) qs.set("type", filterType);
      if (filterCategory.trim()) qs.set("category", filterCategory.trim());
      if (filterOrganizationId) qs.set("organization_id", filterOrganizationId);
      if (filterFrom) qs.set("from", filterFrom);
      if (filterTo) qs.set("to", filterTo);
      if (filterMinAmount) qs.set("min_amount", filterMinAmount);
      if (filterMaxAmount) qs.set("max_amount", filterMaxAmount);
      const res = await fetch(`/api/financial-entries?${qs.toString()}`);
      const json = (await res.json()) as { data?: FinancialEntry[] };
      setEntries(json.data ?? []);
    } finally {
      setEntriesLoading(false);
    }
  }, [
    filterType,
    filterCategory,
    filterOrganizationId,
    filterFrom,
    filterTo,
    filterMinAmount,
    filterMaxAmount,
  ]);

  const loadOrganizations = useCallback(async () => {
    const res = await fetch("/api/organizations");
    const json = (await res.json()) as { data?: OrganizationOption[] };
    setOrganizations(json.data ?? []);
  }, []);

  useEffect(() => {
    void load();
    void loadOrganizations();
  }, [load, loadOrganizations]);

  // Separate effect (not the mount-only one above) so changing any filter
  // re-queries automatically, same "controlled input drives the fetch"
  // pattern as assets/crm's own search filters.
  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function resetEntryForm() {
    setEntryType("expense");
    setEntryDescription("");
    setEntryCategory("");
    setEntryOrganizationId("");
    setEntryAmount("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryNotes("");
    setEntryFormError(null);
  }

  function clearFilters() {
    setFilterType("");
    setFilterCategory("");
    setFilterOrganizationId("");
    setFilterFrom("");
    setFilterTo("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
  }

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    setEntrySubmitting(true);
    setEntryFormError(null);
    try {
      const amount = Number(entryAmount.replace(",", "."));
      const res = await fetch("/api/financial-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entryType,
          description: entryDescription,
          category: entryCategory || undefined,
          organization_id: entryOrganizationId || undefined,
          amount,
          entry_date: entryDate,
          notes: entryNotes || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao adicionar lançamento");
      setShowEntryForm(false);
      resetEntryForm();
      await loadEntries();
      show({ message: "Lançamento adicionado.", variant: "success" });
    } catch (e) {
      setEntryFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setEntrySubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    setDeletingEntryId(id);
    try {
      const res = await fetch(`/api/financial-entries/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao excluir lançamento");
      await loadEntries();
      show({ message: "Lançamento excluído.", variant: "success" });
    } catch (e) {
      show({
        message: e instanceof Error ? e.message : "Erro inesperado",
        variant: "danger",
      });
    } finally {
      setDeletingEntryId(null);
    }
  }

  // These invoices are issued BY this tenant TO one of ITS OWN customers
  // (organizations) — the checkout route builds the Asaas charge using
  // the ORGANIZATION's own document/email/phone (api/invoices/[id]/checkout),
  // never the tenant staff member's. Redirecting the staff's own browser
  // there (the previous behavior) put them on a checkout page addressed
  // to their customer — confusing, and not something staff should "pay"
  // themselves. The real action here is generating the payment link and
  // handing it to the customer (WhatsApp, e-mail, etc.), so this now
  // creates the charge, copies the real link, and stays on this page —
  // same "create a link, copy it, tell the user" pattern already
  // established by inspection-detail.tsx's createShareLink().
  async function handleGeneratePaymentLink(id: string) {
    setPayingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}/checkout`, { method: "POST" });
      const json = (await res.json()) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data?.url)
        throw new Error(json.error ?? "Falha ao gerar link de pagamento");
      await navigator.clipboard.writeText(json.data.url).catch(() => {});
      show({
        message: "Link de pagamento copiado! Envie para o cliente para que ele possa pagar.",
        variant: "success",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      setError(message);
      show({ message, variant: "danger" });
    } finally {
      setPayingId(null);
    }
  }

  const columns = [
    {
      key: "id",
      label: "Fatura",
      render: (row: InvoiceRow) => (
        <span className="font-mono text-xs">{row.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: "organization",
      label: "Organização",
      render: (row: InvoiceRow) => row.billing_accounts?.organizations?.name ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: InvoiceRow) => (
        <StatusBadge
          status={invoiceStatusToUi(row.status)}
          label={invoiceStatusLabel[row.status]}
        />
      ),
    },
    {
      key: "due_date",
      label: "Vencimento",
      render: (row: InvoiceRow) => new Date(row.due_date).toLocaleDateString("pt-BR"),
    },
    {
      key: "total_amount",
      label: "Total",
      render: (row: InvoiceRow) => (
        <span className="font-semibold">{brl(Number(row.total_amount))}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: InvoiceRow) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(row.id)}
            className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
          >
            Ver detalhes
          </button>
          {(row.status === "issued" || row.status === "overdue") && (
            <button
              type="button"
              onClick={() => void handleGeneratePaymentLink(row.id)}
              disabled={payingId === row.id}
              title="Gera o link de pagamento do cliente e copia para a área de transferência"
              className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-1 rounded-lg font-medium border-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              {payingId === row.id ? "Gerando link..." : "Copiar link de pagamento"}
            </button>
          )}
        </div>
      ),
    },
  ];

  type EntryRow = FinancialEntry & Record<string, unknown>;

  const entryColumns = [
    {
      key: "type",
      label: "Tipo",
      render: (row: EntryRow) => (
        <StatusBadge
          status={row.type === "revenue" ? "active" : "error"}
          label={ENTRY_TYPE_LABEL[row.type]}
        />
      ),
    },
    { key: "description", label: "Descrição", render: (row: EntryRow) => row.description },
    {
      key: "category",
      label: "Categoria",
      render: (row: EntryRow) => row.category ?? "—",
    },
    {
      key: "organization",
      label: "Cliente",
      render: (row: EntryRow) => row.organizations?.name ?? "—",
    },
    {
      key: "entry_date",
      label: "Data",
      render: (row: EntryRow) => new Date(`${row.entry_date}T00:00:00`).toLocaleDateString("pt-BR"),
    },
    {
      key: "amount_cents",
      label: "Valor",
      render: (row: EntryRow) => (
        <span
          className={`font-semibold ${row.type === "revenue" ? "text-emerald-600" : "text-red-600"}`}
        >
          {row.type === "revenue" ? "+" : "-"} {brl(row.amount_cents / 100)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: EntryRow) => (
        <button
          type="button"
          onClick={() => void handleDeleteEntry(row.id)}
          disabled={deletingEntryId === row.id}
          title="Excluir lançamento"
          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60 border-0 bg-transparent cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Faturamento">
      <SectionHeader
        title="Faturas"
        description="Faturas emitidas para as organizações vinculadas à sua conta."
        action={<ExportButton entity="invoices" />}
      />

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={invoices as InvoiceRow[]} loading={loading} />

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma fatura ainda.</p>
      )}

      <div className="mt-8">
        <SectionHeader
          title="Lançamentos"
          description="Despesas e receitas registradas manualmente."
          action={
            <button
              type="button"
              onClick={() => setShowEntryForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-shina-blue text-white hover:bg-blue-600 transition border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo cadastro
            </button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 mb-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "" | FinancialEntry["type"])}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os tipos</option>
            <option value="revenue">Receita</option>
            <option value="expense">Despesa</option>
          </select>
          <input
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            placeholder="Categoria"
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          />
          <select
            value={filterOrganizationId}
            onChange={(e) => setFilterOrganizationId(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os clientes</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            title="De"
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            title="Até"
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          />
          <input
            inputMode="decimal"
            value={filterMinAmount}
            onChange={(e) => setFilterMinAmount(e.target.value)}
            placeholder="Valor mín."
            className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
          />
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={filterMaxAmount}
              onChange={(e) => setFilterMaxAmount(e.target.value)}
              placeholder="Valor máx."
              className="min-w-0 flex-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={clearFilters}
              title="Limpar filtros"
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer shrink-0"
            >
              Limpar
            </button>
          </div>
        </div>

        <DataTable columns={entryColumns} data={entries as EntryRow[]} loading={entriesLoading} />

        {!entriesLoading && entries.length === 0 && (
          <p className="text-sm text-slate-500 mt-4 text-center">Nenhum lançamento encontrado.</p>
        )}
      </div>

      <InvoiceDetail
        invoiceId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChange={() => void load()}
      />

      {showEntryForm && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => {
              setShowEntryForm(false);
              resetEntryForm();
            }}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo cadastro
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowEntryForm(false);
                  resetEntryForm();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateEntry(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType("expense")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer ${
                      entryType === "expense"
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("revenue")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer ${
                      entryType === "revenue"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                <input
                  required
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Categoria (opcional)
                </label>
                <input
                  value={entryCategory}
                  onChange={(e) => setEntryCategory(e.target.value)}
                  placeholder="Combustível, Aluguel, Salários..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Cliente (opcional)
                </label>
                <select
                  value={entryOrganizationId}
                  onChange={(e) => setEntryOrganizationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Nenhum</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    required
                    inputMode="decimal"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                  <input
                    required
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  rows={2}
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              {entryFormError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {entryFormError}
                </div>
              )}

              <button
                type="submit"
                disabled={entrySubmitting}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {entrySubmitting ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
