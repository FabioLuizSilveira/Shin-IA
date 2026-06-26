"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Users } from "lucide-react";
import type { AdminUserProfile, UserProfileStatus } from "@/types/domain";

function statusToUi(status: UserProfileStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "active":
      return "active";
    case "inactive":
      return "inactive";
    case "suspended":
      return "warning";
    default:
      return "inactive";
  }
}

function formatLogin(dt: string | undefined): string {
  if (!dt) return "Nunca";
  return new Date(dt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type UserRow = AdminUserProfile & { uiStatus: "active" | "inactive" | "pending" | "warning" };

const COLUMNS = [
  { key: "full_name", label: "Nome" },
  { key: "email", label: "Email" },
  {
    key: "tenant",
    label: "Tenant",
    render: (row: UserRow) => (
      <span className="text-sm text-slate-600">{row.tenants?.name ?? "—"}</span>
    ),
  },
  {
    key: "uiStatus",
    label: "Status",
    render: (row: UserRow) => <StatusBadge status={row.uiStatus} />,
  },
  {
    key: "last_login_at",
    label: "Último login",
    render: (row: UserRow) => (
      <span className="text-sm text-slate-500">{formatLogin(row.last_login_at)}</span>
    ),
  },
  {
    key: "created_at",
    label: "Criado em",
    render: (row: UserRow) =>
      new Date(row.created_at).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch("/api/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao carregar usuários");
        const json = (await res.json()) as { data: AdminUserProfile[] };
        setUsers(json.data ?? []);
      })
      .catch((e: unknown) => {
        setFetchError(e instanceof Error ? e.message : "Erro desconhecido");
      })
      .finally(() => setLoading(false));
  }, []);

  const tableData: UserRow[] = users.map((u) => ({
    ...u,
    uiStatus: statusToUi(u.status),
  }));

  const activeCount = users.filter((u) => u.status === "active").length;
  const inactiveCount = users.filter((u) => u.status === "inactive").length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;

  return (
    <AppShell title="Usuários">
      <SectionHeader
        title="Usuários"
        description="Visão geral de todos os usuários cadastrados na plataforma."
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: users.length, color: "text-slate-900" },
          { label: "Ativos", value: activeCount, color: "text-green-600" },
          { label: "Inativos", value: inactiveCount, color: "text-slate-500" },
          { label: "Suspensos", value: suspendedCount, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
