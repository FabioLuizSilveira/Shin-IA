"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarChart } from "@/components/ui/bar-chart";
import { Building2, Users, DollarSign, TrendingDown, Plus } from "lucide-react";
import type { Tenant, TenantPlan, TenantStatus } from "@/types/domain";

interface AdminAnalyticsData {
  total: number;
  byStatus: {
    active: number;
    trialing: number;
    suspended: number;
    cancelled: number;
  };
  byPlan: {
    starter: number;
    professional: number;
    enterprise: number;
  };
}

function tenantStatusToUi(status: TenantStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "pending";
    case "suspended":
      return "warning";
    case "cancelled":
      return "inactive";
    default:
      return "inactive";
  }
}

function planLabel(plan: TenantPlan): string {
  switch (plan) {
    case "starter":
      return "Starter";
    case "professional":
      return "Professional";
    case "enterprise":
      return "Enterprise";
    default:
      return plan;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type TenantRow = Tenant & {
  uiStatus: "active" | "inactive" | "pending" | "warning";
};

const COLUMNS = [
  { key: "name", label: "Empresa" },
  {
    key: "plan",
    label: "Plano",
    render: (row: TenantRow) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-shina-blue/10 text-shina-blue">
        {planLabel(row.plan)}
      </span>
    ),
  },
  {
    key: "uiStatus",
    label: "Status",
    render: (row: TenantRow) => <StatusBadge status={row.uiStatus} />,
  },
  { key: "slug", label: "Slug" },
  {
    key: "created_at",
    label: "Cliente desde",
    render: (row: TenantRow) =>
      new Date(row.created_at).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
  },
  {
    key: "actions",
    label: "",
    render: (row: TenantRow) => (
      <Link
        href={`/platform/tenants/${row.id}`}
        className="text-xs text-shina-blue hover:text-blue-700 font-medium no-underline"
      >
        Ver detalhes →
      </Link>
    ),
  },
];

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formPlan, setFormPlan] = useState<TenantPlan>("starter");
  const [formAdminEmail, setFormAdminEmail] = useState("");
  const [formAdminFullName, setFormAdminFullName] = useState("");
  const [formAdminPassword, setFormAdminPassword] = useState("");

  async function fetchAll() {
    setLoading(true);
    setFetchError(null);
    try {
      const [tenantsRes, analyticsRes] = await Promise.all([
        fetch("/api/tenants"),
        fetch("/api/analytics"),
      ]);
      if (!tenantsRes.ok) throw new Error("Falha ao carregar tenants");
      const json = (await tenantsRes.json()) as { data: Tenant[] };
      setTenants(json.data ?? []);
      if (analyticsRes.ok) {
        const aJson = (await analyticsRes.json()) as { data: AdminAnalyticsData };
        setAnalytics(aJson.data);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  function handleNameChange(name: string) {
    setFormName(name);
    setFormSlug(slugify(name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          plan: formPlan,
          adminEmail: formAdminEmail,
          adminFullName: formAdminFullName,
          adminPassword: formAdminPassword,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar tenant");
      }
      setShowForm(false);
      setFormName("");
      setFormSlug("");
      setFormPlan("starter");
      setFormAdminEmail("");
      setFormAdminFullName("");
      setFormAdminPassword("");
      await fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar tenant");
    } finally {
      setSubmitting(false);
    }
  }

  const tableData: TenantRow[] = tenants.map((t) => ({
    ...t,
    uiStatus: tenantStatusToUi(t.status),
  }));

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const trialingCount = tenants.filter((t) => t.status === "trialing").length;
  const cancelledCount = tenants.filter((t) => t.status === "cancelled").length;

  return (
    <AppShell title="Tenants">
      <SectionHeader
        title="Tenants"
        description="Gerencie empresas, planos e ciclo de vida na plataforma."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
            >
              <Plus className="w-4 h-4" />
              Novo Tenant
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Novo Tenant
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Acme Logística"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="Ex: acme-logistica"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Plano
              </label>
              <select
                value={formPlan}
                onChange={(e) => setFormPlan(e.target.value as TenantPlan)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nome do Administrador <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formAdminFullName}
                onChange={(e) => setFormAdminFullName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                E-mail do Administrador <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formAdminEmail}
                onChange={(e) => setFormAdminEmail(e.target.value)}
                placeholder="Ex: joao@empresa.com"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Senha do Administrador <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={formAdminPassword}
                onChange={(e) => setFormAdminPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
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
              className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Tenants"
          value={String(tenants.length)}
          trend="up"
          icon={<Building2 className="w-5 h-5" />}
        />
        <MetricCard
          title="Ativos"
          value={String(activeCount)}
          trend="up"
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Em Trial"
          value={String(trialingCount)}
          trend="neutral"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Cancelados"
          value={String(cancelledCount)}
          trend="down"
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      {/* Analytics charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Tenants por Status
          </h3>
          {analytics ? (
            <DonutChart
              data={[
                { label: "Ativos", value: analytics.byStatus.active, color: "#10B981" },
                { label: "Em Trial", value: analytics.byStatus.trialing, color: "#2563EB" },
                { label: "Suspensos", value: analytics.byStatus.suspended, color: "#F59E0B" },
                { label: "Cancelados", value: analytics.byStatus.cancelled, color: "#94A3B8" },
              ].filter((d) => d.value > 0)}
              centerValue={analytics.total}
              centerLabel="Total"
            />
          ) : (
            <div className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse" />
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Tenants por Plano
          </h3>
          {analytics ? (
            <BarChart
              data={[
                { label: "Starter", value: analytics.byPlan.starter, color: "#06B6D4" },
                { label: "Pro", value: analytics.byPlan.professional, color: "#2563EB" },
                { label: "Enterprise", value: analytics.byPlan.enterprise, color: "#7C3AED" },
              ]}
            />
          ) : (
            <div className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse" />
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {fetchError}
        </div>
      )}

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]["columns"]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={tableData as any}
        loading={loading}
      />
    </AppShell>
  );
}
