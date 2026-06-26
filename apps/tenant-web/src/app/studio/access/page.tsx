"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Shield,
  Users,
  GitBranch,
  FileText,
  Plus,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_system: boolean;
  user_count?: number;
}

interface DelegatedAccess {
  id: string;
  grantee_id: string;
  grantee_name: string;
  permission: string;
  expires_at: string | null;
  is_active: boolean;
}

// ── Access Control Studio ──────────────────────────────────────────────────────

export default function AccessControlStudioPage() {
  const [tab, setTab] = useState<"roles" | "delegations" | "audit">("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [delegations, setDelegations] = useState<DelegatedAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [rolesRes, delegRes] = await Promise.all([
        fetch("/api/iam/roles"),
        fetch("/api/iam/delegations"),
      ]);
      const rolesJson = (await rolesRes.json()) as { data?: Role[] };
      const delegJson = (await delegRes.json()) as { data?: DelegatedAccess[] };
      setRoles(rolesJson.data ?? []);
      setDelegations(delegJson.data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const TABS = [
    { id: "roles" as const, label: "Papéis & Permissões", icon: Shield },
    { id: "delegations" as const, label: "Delegações", icon: Users },
    { id: "audit" as const, label: "Auditoria", icon: FileText },
  ];

  return (
    <AppShell title="Controle de Acesso">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              id={`access-tab-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Roles tab */}
          {tab === "roles" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Papéis do tenant</h2>
                  <p className="text-sm text-slate-500">
                    Gerencie papéis e visualize as permissões associadas.
                  </p>
                </div>
                <button
                  id="access-new-role"
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Novo papel
                </button>
              </div>

              {roles.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="Nenhum papel configurado"
                  description="Os papéis padrão do sistema são configurados automaticamente."
                />
              ) : (
                roles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-blue-300 transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{role.display_name}</p>
                        {role.is_system && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                            Sistema
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{role.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {role.user_count !== undefined && (
                        <span className="text-xs text-slate-400">{role.user_count} usuários</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                ))
              )}

              {/* Org structure */}
              <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Hierarquia de filiais</h3>
                </div>
                <p className="text-xs text-slate-500">
                  A hierarquia de filiais define o escopo de acesso de cada usuário. Usuários herdam
                  permissões da filial pai. Gerencie filiais em{" "}
                  <a href="/settings" className="text-blue-600 hover:underline">
                    Configurações → Organização
                  </a>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Delegations tab */}
          {tab === "delegations" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Delegações ativas</h2>
                  <p className="text-sm text-slate-500">
                    Permissões temporariamente delegadas a outros usuários.
                  </p>
                </div>
                <a
                  href="/settings/access"
                  id="access-new-delegation"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition no-underline"
                >
                  <Plus className="w-4 h-4" /> Nova delegação
                </a>
              </div>

              {delegations.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhuma delegação ativa"
                  description="Delegue permissões temporárias em Configurações → Acesso."
                />
              ) : (
                <div className="space-y-3">
                  {delegations.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          d.is_active ? "bg-green-50" : "bg-slate-50"
                        }`}
                      >
                        {d.is_active ? (
                          <Unlock className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{d.grantee_name}</p>
                        <p className="text-xs text-slate-500">
                          Permissão: <code className="text-blue-600">{d.permission}</code>
                          {d.expires_at && (
                            <> · expira {new Date(d.expires_at).toLocaleDateString("pt-BR")}</>
                          )}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          d.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {d.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audit tab */}
          {tab === "audit" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Log de auditoria</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Em desenvolvimento</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    O log de auditoria completo estará disponível no M6. Por enquanto, os eventos de
                    auth e modificações de IAM são registrados no Supabase Auth logs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
    </div>
  );
}
