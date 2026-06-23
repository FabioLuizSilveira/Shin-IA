import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const AUDIT_EVENTS = [
  {
    id: "EVT-001",
    user: "admin@shina.com.br",
    action: "tenant.create",
    resource: "Transportes Silva Ltda",
    ip: "187.22.4.12",
    time: "22/06/2026 14:32",
  },
  {
    id: "EVT-002",
    user: "admin@shina.com.br",
    action: "billing.invoice.send",
    resource: "INV-001",
    ip: "187.22.4.12",
    time: "22/06/2026 14:15",
  },
  {
    id: "EVT-003",
    user: "sistema",
    action: "auth.login.failed",
    resource: "abc123@empresa.com",
    ip: "200.100.50.8",
    time: "22/06/2026 13:47",
  },
  {
    id: "EVT-004",
    user: "admin@shina.com.br",
    action: "tenant.plan.upgrade",
    resource: "Norte Transportes",
    ip: "187.22.4.12",
    time: "22/06/2026 12:00",
  },
  {
    id: "EVT-005",
    user: "sistema",
    action: "backup.completed",
    resource: "db-primary-20260622",
    ip: "10.0.0.1",
    time: "22/06/2026 10:00",
  },
  {
    id: "EVT-006",
    user: "admin@shina.com.br",
    action: "user.permission.grant",
    resource: "joao@frota.com.br",
    ip: "187.22.4.12",
    time: "22/06/2026 09:30",
  },
];

type AuditRow = (typeof AUDIT_EVENTS)[number];

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "user", label: "Usuário" },
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
  { key: "ip", label: "IP" },
  { key: "time", label: "Data/Hora" },
  {
    key: "status",
    label: "Resultado",
    render: (_row: AuditRow) => (
      <StatusBadge
        status={_row.action.includes("failed") ? "error" : "active"}
        label={_row.action.includes("failed") ? "Falhou" : "Sucesso"}
      />
    ),
  },
];

export default function AuditPage() {
  return (
    <AppShell title="Auditoria">
      <SectionHeader
        title="Log de Auditoria"
        description="Trilha imutável de todos os eventos da plataforma."
      />
      <DataTable columns={COLUMNS} data={AUDIT_EVENTS} />
    </AppShell>
  );
}
