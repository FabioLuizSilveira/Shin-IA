"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { CrmLeadDetail } from "@/components/ui/crm-lead-detail";
import { CrmKanbanBoard } from "@/components/ui/crm-kanban-board";
import { Plus, X, List, LayoutGrid } from "lucide-react";
import type { LeadSource, LeadStatus } from "@shina/crm-engine";

interface LeadRow {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  status: LeadStatus;
  source: LeadSource;
  estimated_mrr_cents: number | null;
  created_at: string;
  [key: string]: unknown;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Site",
  referral: "Indicação",
  outbound: "Outbound",
  event: "Evento",
  social: "Redes sociais",
  partner: "Parceiro",
  other: "Outro",
};

function statusToUi(status: LeadStatus): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "won":
      return "active";
    case "lost":
      return "error";
    case "negotiation":
    case "proposal":
      return "warning";
    default:
      return "pending";
  }
}

const FILTERS: { key: string; label: string; status?: LeadStatus }[] = [
  { key: "all", label: "Todos" },
  { key: "new", label: "Novos", status: "new" },
  { key: "contacted", label: "Contatados", status: "contacted" },
  { key: "qualified", label: "Qualificados", status: "qualified" },
  { key: "proposal", label: "Proposta", status: "proposal" },
  { key: "negotiation", label: "Negociação", status: "negotiation" },
  { key: "won", label: "Ganhos", status: "won" },
  { key: "lost", label: "Perdidos", status: "lost" },
];

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PlatformCrmPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");

  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("other");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (filterKey: string) => {
    setLoading(true);
    try {
      const activeFilter = FILTERS.find((f) => f.key === filterKey);
      const qs = activeFilter?.status ? `?status=${activeFilter.status}` : "";
      const res = await fetch(`/api/platform-crm/leads${qs}`);
      const json = (await res.json()) as { data?: LeadRow[] };
      setLeads(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // O kanban precisa enxergar todos os estágios ao mesmo tempo pra
    // desenhar as colunas -- as abas de filtro só fazem sentido na lista.
    void load(view === "kanban" ? "all" : filter);
  }, [filter, view, load]);

  async function handleMove(leadId: string, _from: LeadStatus, to: LeadStatus) {
    const res = await fetch(`/api/platform-crm/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Falha ao mover o lead.");
    await load("all");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/platform-crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          source,
        }),
      });
      const json = (await res.json()) as { error?: string; data?: { id: string } };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar lead.");
      setShowForm(false);
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setSource("other");
      await load(filter);
      if (json.data) setSelectedId(json.data.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  }

  const columns = [
    { key: "company_name", label: "Empresa", render: (row: LeadRow) => row.company_name },
    { key: "contact_name", label: "Contato", render: (row: LeadRow) => row.contact_name },
    {
      key: "source",
      label: "Origem",
      render: (row: LeadRow) => SOURCE_LABEL[row.source] ?? row.source,
    },
    {
      key: "estimated_mrr_cents",
      label: "MRR estimado",
      render: (row: LeadRow) => formatCents(row.estimated_mrr_cents),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LeadRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: LeadRow) => (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
        >
          Ver detalhes
        </button>
      ),
    },
  ];

  return (
    <AppShell title="CRM Comercial">
      <SectionHeader
        title="CRM Comercial"
        description="Funil de captação e evolução de leads comerciais da Shinã."
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                title="Lista"
                className={`p-1.5 rounded-md border-0 cursor-pointer ${
                  view === "list"
                    ? "bg-white dark:bg-slate-800 text-shina-blue shadow-sm"
                    : "bg-transparent text-slate-500"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                title="Kanban"
                className={`p-1.5 rounded-md border-0 cursor-pointer ${
                  view === "kanban"
                    ? "bg-white dark:bg-slate-800 text-shina-blue shadow-sm"
                    : "bg-transparent text-slate-500"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Lead
            </button>
          </div>
        }
      />

      {view === "list" && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border-0 cursor-pointer transition-colors ${
                filter === f.key
                  ? "bg-shina-blue text-white"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {view === "list" ? (
        <>
          <DataTable columns={columns} data={leads} loading={loading} />
          {!loading && leads.length === 0 && (
            <p className="text-sm text-slate-500 mt-4 text-center">Nenhum lead encontrado.</p>
          )}
        </>
      ) : (
        <CrmKanbanBoard leads={leads} onSelect={setSelectedId} onMove={handleMove} />
      )}

      <CrmLeadDetail
        leadId={selectedId}
        onClose={() => setSelectedId(null)}
        onChange={() => void load(filter)}
      />

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Lead
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreate(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Empresa</label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nome do contato
                </label>
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Telefone (opcional)
                </label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Origem</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {creating ? "Criando..." : "Criar lead"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
