"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Plus, Shield, X } from "lucide-react";

interface PlatformRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_count: number;
}

interface PlatformPermission {
  id: string;
  key: string;
  resource: string;
  action: string;
  name: string;
  description: string | null;
  scope: string;
  is_system: boolean;
}

export default function PlatformSettingsPage() {
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showPermForm, setShowPermForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [roleKey, setRoleKey] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");

  const [permResource, setPermResource] = useState("");
  const [permAction, setPermAction] = useState("");
  const [permName, setPermName] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch("/api/platform-settings/roles"),
        fetch("/api/platform-settings/permissions"),
      ]);
      const rolesJson = (await rolesRes.json()) as { data?: PlatformRole[] };
      const permsJson = (await permsRes.json()) as { data?: PlatformPermission[] };
      const loadedRoles = rolesJson.data ?? [];
      setRoles(loadedRoles);
      setPermissions(permsJson.data ?? []);
      setSelectedRoleId((current) => current ?? loadedRoles[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadGranted = useCallback(async (roleId: string) => {
    const res = await fetch(`/api/platform-settings/roles/${roleId}/permissions`);
    const json = (await res.json()) as { data?: string[] };
    setGrantedIds(new Set(json.data ?? []));
  }, []);

  useEffect(() => {
    if (selectedRoleId) void loadGranted(selectedRoleId);
  }, [selectedRoleId, loadGranted]);

  async function handleTogglePermission(permissionId: string, grant: boolean) {
    if (!selectedRoleId) return;
    setTogglingId(permissionId);
    try {
      await fetch(`/api/platform-settings/roles/${selectedRoleId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission_id: permissionId, grant }),
      });
      setGrantedIds((prev) => {
        const next = new Set(prev);
        if (grant) next.add(permissionId);
        else next.delete(permissionId);
        return next;
      });
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRoleId
            ? { ...r, permission_count: r.permission_count + (grant ? 1 : -1) }
            : r,
        ),
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/platform-settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: roleKey,
          name: roleName,
          description: roleDescription || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar papel");
      setShowRoleForm(false);
      setRoleKey("");
      setRoleName("");
      setRoleDescription("");
      await loadAll();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePermission(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/platform-settings/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: permResource, action: permAction, name: permName }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar permissão");
      setShowPermForm(false);
      setPermResource("");
      setPermAction("");
      setPermName("");
      await loadAll();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = permissions.reduce<Record<string, PlatformPermission[]>>((acc, p) => {
    (acc[p.resource] ??= []).push(p);
    return acc;
  }, {});

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  return (
    <AppShell title="Configurações">
      <SectionHeader
        title="Configurações Globais"
        description="Papéis e permissões de acesso da plataforma."
      />

      {loading ? (
        <div className="h-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Papéis</h3>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowRoleForm(true);
                }}
                className="p-1.5 text-shina-blue hover:bg-shina-blue/10 rounded-lg border-0 bg-transparent cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full text-left px-4 py-3 border-0 cursor-pointer ${
                      selectedRoleId === role.id
                        ? "bg-shina-blue/10"
                        : "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-shina-blue shrink-0" />
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                        {role.name}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {role.permission_count} permissões
                      {role.is_system && " · sistema"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {selectedRole ? `Permissões de ${selectedRole.name}` : "Selecione um papel"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowPermForm(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-shina-blue hover:bg-shina-blue/10 rounded-lg border-0 bg-transparent cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova permissão
              </button>
            </div>

            {permissions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Nenhuma permissão cadastrada ainda.
              </p>
            ) : !selectedRole ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Selecione um papel para ver e editar as permissões.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {Object.entries(grouped).map(([resource, perms]) => (
                  <div key={resource} className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      {resource}
                    </p>
                    <div className="space-y-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-3 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={grantedIds.has(perm.id)}
                            disabled={togglingId === perm.id}
                            onChange={(e) => void handleTogglePermission(perm.id, e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span className="text-slate-700 dark:text-slate-200">{perm.name}</span>
                          <span className="text-xs text-slate-400">({perm.action})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRoleForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowRoleForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Papel
              </h2>
              <button
                type="button"
                onClick={() => setShowRoleForm(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => void handleCreateRole(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Chave (ex: platform_support)
                </label>
                <input
                  required
                  value={roleKey}
                  onChange={(e) => setRoleKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                <input
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Descrição (opcional)
                </label>
                <input
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
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
                {submitting ? "Criando..." : "Criar papel"}
              </button>
            </form>
          </div>
        </>
      )}

      {showPermForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowPermForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Nova Permissão
              </h2>
              <button
                type="button"
                onClick={() => setShowPermForm(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => void handleCreatePermission(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Recurso (ex: tenants)
                </label>
                <input
                  required
                  value={permResource}
                  onChange={(e) => setPermResource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Ação (ex: read, write, delete)
                </label>
                <input
                  required
                  value={permAction}
                  onChange={(e) => setPermAction(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                <input
                  required
                  value={permName}
                  onChange={(e) => setPermName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
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
                {submitting ? "Criando..." : "Criar permissão"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
