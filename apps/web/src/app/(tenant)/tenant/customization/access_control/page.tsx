"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X } from "lucide-react";
import type { AccessControlConfig, PolicyEffect, PolicyScope } from "@shina/studio";

const EFFECTS: PolicyEffect[] = ["allow", "deny"];
const SCOPES: PolicyScope[] = ["tenant", "branch", "asset", "user", "global"];

const EMPTY: AccessControlConfig = {
  policies: [],
  roleOverrides: [],
  defaultDenyAll: false,
  mfaRequiredForRoles: [],
};

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function AccessControlStudioPage() {
  const studio = useStudioConfig<AccessControlConfig>("access_control", EMPTY);
  const { config, setConfig } = studio;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [effect, setEffect] = useState<PolicyEffect>("allow");
  const [scope, setScope] = useState<PolicyScope>("tenant");

  function addPolicy() {
    if (!name.trim() || !resource.trim() || !action.trim()) return;
    setConfig({
      ...config,
      policies: [
        ...config.policies,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          resource: resource.trim(),
          action: action.trim(),
          effect,
          scope,
          conditions: [],
          priority: config.policies.length,
        },
      ],
    });
    setName("");
    setResource("");
    setAction("");
    setShowForm(false);
  }

  function removePolicy(id: string) {
    setConfig({ ...config, policies: config.policies.filter((p) => p.id !== id) });
  }

  return (
    <AppShell title="Controle de Acesso">
      <StudioAreaShell
        title="Controle de Acesso"
        description="Políticas por recurso/ação e overrides de permissão por papel."
        publishedVersion={studio.publishedVersion}
        saving={studio.saving}
        publishing={studio.publishing}
        saved={studio.saved}
        error={studio.error}
        onSaveDraft={() => void studio.saveDraft(config)}
        onPublish={() => void studio.publish()}
      >
        {studio.loading ? (
          <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.defaultDenyAll}
                  onChange={(e) => setConfig({ ...config, defaultDenyAll: e.target.checked })}
                />
                Negar tudo por padrão (só o que está permitido explicitamente é liberado)
              </label>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Políticas
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {showForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                  <input
                    placeholder="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Recurso"
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Ação"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={effect}
                    onChange={(e) => setEffect(e.target.value as PolicyEffect)}
                    className={inputClass}
                  >
                    {EFFECTS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as PolicyScope)}
                    className={inputClass}
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addPolicy}
                    className="col-span-2 sm:col-span-1 px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              )}

              {config.policies.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma política ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.policies.map((policy) => (
                    <li key={policy.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {policy.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {policy.resource}.{policy.action} · {policy.effect} · {policy.scope}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePolicy(policy.id)}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
