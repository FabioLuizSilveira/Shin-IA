"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  Building2,
  Users,
  Zap,
  FileText,
  DollarSign,
  Settings,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  MapPin,
  Calendar,
  TrendingUp,
  Shield,
  X,
} from "lucide-react";
import type { TenantStatus, TenantPlan, OperationStatus, ContractStatus } from "@/types/domain";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface TenantUser {
  id: string;
  full_name: string;
  email: string;
  status: string;
  last_login_at?: string;
  created_at: string;
}

interface TenantOperation {
  id: string;
  type: string;
  status: OperationStatus;
  scheduled_starts_at: string;
}

interface TenantContract {
  id: string;
  type: string;
  status: ContractStatus;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
}

interface TenantMetrics {
  totalUsers: number;
  activeUsers: number;
  totalBranches: number;
  totalContracts: number;
  activeContractCount: number;
  totalContractValue: number;
  totalOperations: number;
  completedOperations: number;
  openOperations: number;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface TenantDetailData {
  tenant: TenantDetail;
  metrics: TenantMetrics;
  branches: Branch[];
  users: TenantUser[];
  operations: TenantOperation[];
  contracts: TenantContract[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_TO_UI: Record<TenantStatus, "active" | "inactive" | "pending" | "warning"> = {
  active: "active",
  trialing: "pending",
  suspended: "warning",
  cancelled: "inactive",
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: "Ativo",
  trialing: "Em trial",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

const PLAN_COLORS: Record<TenantPlan, string> = {
  starter: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  professional: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const OP_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

const OP_STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  suspended: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function formatDate(dt: string | undefined | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

// ── Tab components ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: TenantDetailData }) {
  const { tenant, metrics } = data;
  const meta = tenant.metadata ?? {};

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Usuários ativos",
            value: `${metrics.activeUsers}/${metrics.totalUsers}`,
            icon: <Users className="w-4 h-4" />,
            color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40",
          },
          {
            label: "Operações abertas",
            value: String(metrics.openOperations),
            icon: <Zap className="w-4 h-4" />,
            color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
          },
          {
            label: "Contratos ativos",
            value: String(metrics.activeContractCount),
            icon: <FileText className="w-4 h-4" />,
            color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/40",
          },
          {
            label: "Receita total",
            value: formatCurrency(metrics.totalContractValue),
            icon: <DollarSign className="w-4 h-4" />,
            color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/40",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
          >
            <div className={`w-8 h-8 rounded-lg ${m.color} flex items-center justify-center mb-3`}>
              {m.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{m.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Tenant info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Informações do Tenant
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: "Nome", value: tenant.name },
            { label: "Slug", value: tenant.slug, mono: true },
            { label: "Plano", value: tenant.plan },
            { label: "Status", value: STATUS_LABELS[tenant.status] },
            { label: "CNPJ", value: (meta.cnpj as string) ?? "—" },
            { label: "Segmento", value: (meta.segment as string) ?? "—" },
            { label: "Blueprint", value: (meta.blueprint as string) ?? "—" },
            { label: "Membro desde", value: formatDate(tenant.created_at) },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{row.label}</p>
              <p
                className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${row.mono ? "font-mono" : ""}`}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users }: { users: TenantUser[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {users.length} usuário(s)
        </h3>
      </div>
      {users.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Nenhum usuário encontrado
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Nome</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Último acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {users.map((u) => (
              <tr
                key={u.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {u.full_name}
                </td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.status === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : u.status === "suspended"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {u.status === "active"
                      ? "Ativo"
                      : u.status === "suspended"
                        ? "Suspenso"
                        : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                  {formatDate(u.last_login_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OperationsTab({ operations }: { operations: TenantOperation[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Últimas {operations.length} operação(ões)
        </h3>
      </div>
      {operations.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Nenhuma operação encontrada
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">ID</th>
              <th className="px-6 py-3 text-left font-medium">Tipo</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {operations.map((op) => (
              <tr
                key={op.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {op.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100 capitalize">
                  {op.type}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${OP_STATUS_COLOR[op.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {OP_STATUS_LABEL[op.status] ?? op.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                  {formatDate(op.scheduled_starts_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ContractsTab({ contracts }: { contracts: TenantContract[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {contracts.length} contrato(s)
        </h3>
      </div>
      {contracts.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Nenhum contrato encontrado
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Tipo</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Valor</th>
              <th className="px-6 py-3 text-left font-medium">Vigência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {contracts.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100 capitalize">
                  {c.type}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${CONTRACT_STATUS_COLOR[c.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-3 font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(c.value_amount, c.value_currency)}
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs">
                  {formatDate(c.period_starts_at)} → {formatDate(c.period_ends_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BranchesTab({ branches }: { branches: Branch[] }) {
  return (
    <div className="space-y-3">
      {branches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
          Nenhuma filial encontrada
        </div>
      ) : (
        branches.map((b) => (
          <div
            key={b.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{b.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.code}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}
            >
              {b.active ? "Ativa" : "Inativa"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function SettingsTab({
  tenant,
  onStatusChange,
  onPlanChange,
  saving,
}: {
  tenant: TenantDetail;
  onStatusChange: (status: TenantStatus) => void;
  onPlanChange: (plan: TenantPlan) => void;
  saving: boolean;
}) {
  const isSuspended = tenant.status === "suspended";

  return (
    <div className="space-y-6">
      {/* Status control */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Controle de Acesso
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Suspender um tenant bloqueia imediatamente todos os usuários.
        </p>
        <div className="flex gap-3">
          {isSuspended ? (
            <button
              id="tenant-reactivate"
              type="button"
              onClick={() => onStatusChange("active")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 cursor-pointer border-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? "Reativando..." : "Reativar tenant"}
            </button>
          ) : (
            <button
              id="tenant-suspend"
              type="button"
              onClick={() => onStatusChange("suspended")}
              disabled={saving || tenant.status === "cancelled"}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 cursor-pointer border-0"
            >
              <AlertOctagon className="w-4 h-4" />
              {saving ? "Suspendendo..." : "Suspender tenant"}
            </button>
          )}
        </div>
      </div>

      {/* Plan change */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Plano</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Plano atual: <strong className="text-slate-700 dark:text-slate-300">{tenant.plan}</strong>
        </p>
        <div className="flex gap-2">
          {(["starter", "professional", "enterprise"] as TenantPlan[]).map((plan) => (
            <button
              key={plan}
              id={`plan-${plan}`}
              type="button"
              onClick={() => onPlanChange(plan)}
              disabled={saving || tenant.plan === plan}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-0 ${
                tenant.plan === plan
                  ? `${PLAN_COLORS[plan]} ring-2 ring-offset-1 ring-current cursor-default`
                  : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 disabled:opacity-50"
              }`}
            >
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImpersonateModal({
  tenantName,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  tenantName: string;
  onClose: () => void;
  onConfirm: (reason: string, accessMode: "full" | "read_only") => void;
  submitting: boolean;
  error: string | null;
}) {
  const [reason, setReason] = useState("");
  const [accessMode, setAccessMode] = useState<"full" | "read_only">("full");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Acessar como suporte — {tenantName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Motivo (obrigatório)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: investigar chamado de suporte #123"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Modo de acesso
            </label>
            <div className="flex gap-2">
              {(["full", "read_only"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAccessMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border ${
                    accessMode === mode
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {mode === "full" ? "Completo (4h)" : "Somente leitura (2h)"}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-transparent border-0 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason, accessMode)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 cursor-pointer border-0"
          >
            {submitting ? "Iniciando..." : "Acessar tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Visão Geral", icon: TrendingUp },
  { key: "users", label: "Usuários", icon: Users },
  { key: "operations", label: "Operações", icon: Zap },
  { key: "contracts", label: "Contratos", icon: FileText },
  { key: "branches", label: "Filiais", icon: Building2 },
  { key: "settings", label: "Configurações", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface PageProps {
  params: { id: string };
}

export default function TenantDetailPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [data, setData] = useState<TenantDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  async function handleImpersonate(reason: string, accessMode: "full" | "read_only") {
    setImpersonating(true);
    setImpersonateError(null);
    try {
      const res = await fetch("/api/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: id, reason, access_mode: accessMode }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao iniciar personificação");
      }
      router.push("/tenant/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setImpersonateError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setImpersonating(false);
    }
  }

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${id}`);
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao carregar tenant");
      }
      const json = (await res.json()) as { data: TenantDetailData };
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  async function handleStatusChange(status: TenantStatus) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao atualizar status");
      }
      await fetchDetail();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlanChange(plan: TenantPlan) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao atualizar plano");
      }
      await fetchDetail();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  const tenant = data?.tenant;

  return (
    <AppShell title="Detalhes do Tenant">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 no-underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Tenants
        </Link>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-48" />
          <div className="flex gap-2 mt-6">
            {TABS.map((t) => (
              <div key={t.key} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg w-24" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400">
          <AlertOctagon className="w-5 h-5 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => void fetchDetail()}
            className="ml-auto flex items-center gap-1 text-xs underline bg-transparent border-0 cursor-pointer text-current"
          >
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Content */}
      {data && tenant && !loading && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  {tenant.name}
                </h1>
                <StatusBadge
                  status={STATUS_TO_UI[tenant.status]}
                  label={STATUS_LABELS[tenant.status]}
                />
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[tenant.plan]}`}
                >
                  {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">{tenant.slug}</span>
                <span>·</span>
                <Calendar className="w-3 h-3" />
                <span>Desde {formatDate(tenant.created_at)}</span>
                <span>·</span>
                <ChevronRight className="w-3 h-3" />
                <span>{data.metrics.totalBranches} filial(is)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowImpersonate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 text-sm font-semibold rounded-xl transition-colors cursor-pointer border-0"
            >
              <Shield className="w-4 h-4" />
              Acessar como suporte
            </button>
          </div>

          {showImpersonate && (
            <ImpersonateModal
              tenantName={tenant.name}
              onClose={() => {
                setShowImpersonate(false);
                setImpersonateError(null);
              }}
              onConfirm={(reason, accessMode) => void handleImpersonate(reason, accessMode)}
              submitting={impersonating}
              error={impersonateError}
            />
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-0 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-transparent"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 bg-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          {activeTab === "overview" && <OverviewTab data={data} />}
          {activeTab === "users" && <UsersTab users={data.users} />}
          {activeTab === "operations" && <OperationsTab operations={data.operations} />}
          {activeTab === "contracts" && <ContractsTab contracts={data.contracts} />}
          {activeTab === "branches" && <BranchesTab branches={data.branches} />}
          {activeTab === "settings" && (
            <SettingsTab
              tenant={tenant}
              onStatusChange={(s) => void handleStatusChange(s)}
              onPlanChange={(p) => void handlePlanChange(p)}
              saving={saving}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
