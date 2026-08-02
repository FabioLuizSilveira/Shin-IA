"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X } from "lucide-react";
import type { IntegrationStudioConfig } from "@shina/studio";

const EMPTY: IntegrationStudioConfig = {
  enabledProviders: [],
  providerTestConfigs: [],
  webhookSubscriptions: [],
  alertOnFailureChannels: [],
};

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function IntegrationStudioPage() {
  const studio = useStudioConfig<IntegrationStudioConfig>("integration", EMPTY);
  const { config, setConfig } = studio;
  const [providerInput, setProviderInput] = useState("");
  const [eventType, setEventType] = useState("");
  const [webhookId, setWebhookId] = useState("");

  function addProvider() {
    if (!providerInput.trim() || config.enabledProviders.includes(providerInput.trim())) return;
    setConfig({ ...config, enabledProviders: [...config.enabledProviders, providerInput.trim()] });
    setProviderInput("");
  }

  function removeProvider(id: string) {
    setConfig({ ...config, enabledProviders: config.enabledProviders.filter((p) => p !== id) });
  }

  function addWebhook() {
    if (!eventType.trim() || !webhookId.trim()) return;
    setConfig({
      ...config,
      webhookSubscriptions: [
        ...config.webhookSubscriptions,
        { eventType: eventType.trim(), webhookId: webhookId.trim(), enabled: true },
      ],
    });
    setEventType("");
    setWebhookId("");
  }

  function removeWebhook(index: number) {
    setConfig({
      ...config,
      webhookSubscriptions: config.webhookSubscriptions.filter((_, i) => i !== index),
    });
  }

  return (
    <AppShell title="Integrações">
      <StudioAreaShell
        title="Integrações"
        description="Providers habilitados e assinaturas de webhook."
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
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Providers habilitados
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  placeholder="ID do provider"
                  value={providerInput}
                  onChange={(e) => setProviderInput(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addProvider}
                  className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {config.enabledProviders.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">
                  Nenhum provider habilitado.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {config.enabledProviders.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => removeProvider(p)}
                        className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Assinaturas de webhook
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  placeholder="Tipo de evento"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className={inputClass}
                />
                <input
                  placeholder="ID do webhook"
                  value={webhookId}
                  onChange={(e) => setWebhookId(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addWebhook}
                  className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {config.webhookSubscriptions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">Nenhuma assinatura ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.webhookSubscriptions.map((sub, i) => (
                    <li key={i} className="py-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {sub.eventType} → {sub.webhookId}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeWebhook(i)}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Limite de chamadas por hora (opcional)
              </label>
              <input
                type="number"
                value={config.throttlePerHour ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    throttlePerHour: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className={`${inputClass} max-w-xs`}
              />
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
