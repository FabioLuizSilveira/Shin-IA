"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { Plus, X } from "lucide-react";
import type { Organization, OrganizationType } from "@/types/domain";

type OrganizationRow = Organization & Record<string, unknown>;

const TYPE_LABEL: Record<OrganizationType, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  partner: "Parceiro",
  internal: "Interno",
};

export default function TenantCrmPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formTradeName, setFormTradeName] = useState("");
  const [formDocument, setFormDocument] = useState("");
  const [formType, setFormType] = useState<OrganizationType>("customer");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      const json = (await res.json()) as { data?: Organization[] };
      setOrganizations(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          trade_name: formTradeName || undefined,
          document: formDocument,
          type: formType,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          address_city: formCity,
          address_state: formState,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar organização");
      setShowForm(false);
      setFormName("");
      setFormTradeName("");
      setFormDocument("");
      setFormEmail("");
      setFormPhone("");
      setFormCity("");
      setFormState("");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(org: Organization) {
    setToggling(org.id);
    try {
      await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !org.active }),
      });
      await load();
    } finally {
      setToggling(null);
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    {
      key: "type",
      label: "Tipo",
      render: (row: OrganizationRow) => TYPE_LABEL[row.type],
    },
    { key: "document", label: "Documento" },
    {
      key: "contact",
      label: "Contato",
      render: (row: OrganizationRow) => row.email ?? row.phone ?? "—",
    },
    {
      key: "location",
      label: "Localização",
      render: (row: OrganizationRow) => `${row.address_city}/${row.address_state}`,
    },
    {
      key: "active",
      label: "Status",
      render: (row: OrganizationRow) => (
        <StatusBadge
          status={row.active ? "active" : "inactive"}
          label={row.active ? "Ativo" : "Inativo"}
        />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: OrganizationRow) => (
        <button
          type="button"
          disabled={toggling === row.id}
          onClick={() => void handleToggleActive(row)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0 disabled:opacity-60"
        >
          {row.active ? "Desativar" : "Reativar"}
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Clientes & Parceiros">
      <SectionHeader
        title="Clientes & Parceiros"
        description="Organizações clientes, fornecedoras e parceiras do tenant."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="organizations" />
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Organização
            </button>
          </div>
        }
      />

      <DataTable columns={columns} data={organizations as OrganizationRow[]} loading={loading} />

      {!loading && organizations.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhuma organização ainda.</p>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Nova Organização
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nome fantasia (opcional)
                </label>
                <input
                  value={formTradeName}
                  onChange={(e) => setFormTradeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Documento (CPF/CNPJ)
                </label>
                <input
                  required
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as OrganizationType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Telefone (opcional)
                </label>
                <input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cidade</label>
                  <input
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">UF</label>
                  <input
                    required
                    maxLength={2}
                    value={formState}
                    onChange={(e) => setFormState(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              {formError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {submitting ? "Criando..." : "Criar organização"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
