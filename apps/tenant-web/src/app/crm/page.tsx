"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Plus, MapPin, Mail, Building2 } from "lucide-react";
import type { Organization, OrganizationType } from "@/types/domain";

const typeLabels: Record<OrganizationType, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  partner: "Parceiro",
  internal: "Interno",
};

const typeColors: Record<OrganizationType, string> = {
  customer: "bg-blue-100 text-blue-700",
  supplier: "bg-purple-100 text-purple-700",
  partner: "bg-green-100 text-green-700",
  internal: "bg-slate-100 text-slate-700",
};

type FilterTab = "all" | OrganizationType;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "customer", label: "Clientes" },
  { key: "supplier", label: "Fornecedores" },
  { key: "partner", label: "Parceiros" },
];

export default function CrmPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDocument, setFormDocument] = useState("");
  const [formType, setFormType] = useState<OrganizationType>("customer");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Falha ao carregar organizações");
      const json = (await res.json()) as { data: Organization[] };
      setOrganizations(json.data ?? []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          document: formDocument,
          type: formType,
          email: formEmail || undefined,
          address_city: formCity,
          address_state: formState.toUpperCase().slice(0, 2),
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar organização");
      }
      setShowForm(false);
      setFormName("");
      setFormDocument("");
      setFormType("customer");
      setFormEmail("");
      setFormCity("");
      setFormState("");
      await fetchOrganizations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar organização");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered =
    activeTab === "all" ? organizations : organizations.filter((o) => o.type === activeTab);

  return (
    <AppShell title="Clientes & Parceiros">
      <SectionHeader
        title="Clientes & Parceiros"
        description="Gerencie clientes, fornecedores e parceiros de negócio."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
            >
              <Plus className="w-4 h-4" />
              Nova Organização
            </button>
          ) : undefined
        }
      />

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-slate-900 mb-4">Nova Organização</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Acme Ltda"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                CNPJ / Documento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formDocument}
                onChange={(e) => setFormDocument(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formType}
                onChange={(e) => setFormType(e.target.value as OrganizationType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="customer">Cliente</option>
                <option value="supplier">Fornecedor</option>
                <option value="partner">Parceiro</option>
                <option value="internal">Interno</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cidade <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Estado (UF) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={formState}
                onChange={(e) => setFormState(e.target.value.toUpperCase())}
                placeholder="Ex: SP"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue uppercase"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-shina-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer border-0"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-0 ${
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Building2 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Nenhuma organização encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((org) => (
            <div
              key={org.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{org.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{org.document}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[org.type]}`}
                >
                  {typeLabels[org.type]}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5">
                {org.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{org.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {org.address_city}, {org.address_state}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    org.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {org.active ? "Ativa" : "Inativa"}
                </span>
                <button
                  onClick={() => router.push(`/contracts?org=${org.id}`)}
                  className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer"
                >
                  Ver contratos →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
