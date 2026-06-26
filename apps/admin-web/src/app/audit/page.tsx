"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type AuditRow = {
  id: string;
  tenant: string;
  action: string;
  resource: string;
  status: string;
  time: string;
};

function statusToUi(status: string): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "completed":
    case "active":
    case "paid":
      return "active";
    case "failed":
    case "terminated":
    case "overdue":
      return "error";
    case "cancelled":
    case "suspended":
      return "warning";
    case "pending":
    case "in_progress":
    case "issued":
      return "pending";
    default:
      return "inactive";
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: "Concluído",
    active: "Ativo",
    paid: "Pago",
    failed: "Falhou",
    terminated: "Encerrado",
    overdue: "Vencido",
    cancelled: "Cancelado",
    suspended: "Suspenso",
    pending: "Pendente",
    in_progress: "Em andamento",
    issued: "Emitido",
  };
  return labels[status] ?? status;
}

const COLUMNS = [
  {
    key: "id",
    label: "ID",
    render: (row: AuditRow) => (
      <span className="font-mono text-xs text-slate-500">{row.id.slice(0, 8).toUpperCase()}</span>
    ),
  },
  { key: "tenant", label: "Tenant" },
  {
    key: "action",
    label: "Ação",
    render: (row: AuditRow) => (
      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
        {row.action}
      </code>
    ),
  },
  { key: "resource", label: "Recurso" },
  {
    key: "status",
    label: "Status",
    render: (row: AuditRow) => (
      <StatusBadge status={statusToUi(row.status)} label={statusLabel(row.status)} />
    ),
  },
  { key: "time", label: "Data/Hora" },
];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        const json = (await res.json()) as { data: AuditRow[] };
        setEvents(json.data ?? []);
      }
    } catch {
      // silently keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return (
    <AppShell title="Auditoria">
      <SectionHeader
        title="Log de Auditoria"
        description="Trilha imutável de todos os eventos da plataforma."
      />
      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]["columns"]}
        data={events as Parameters<typeof DataTable>[0]["data"]}
        loading={loading}
      />
    </AppShell>
  );
}
