"use client";

import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import type { NotificationChannelConfig, NotificationStudioConfig } from "@shina/studio";

const CHANNELS: NotificationChannelConfig["channel"][] = [
  "email",
  "sms",
  "push",
  "in_app",
  "webhook",
];
const CHANNEL_LABEL: Record<NotificationChannelConfig["channel"], string> = {
  email: "E-mail",
  sms: "SMS",
  push: "Push",
  in_app: "No app",
  webhook: "Webhook",
};

const EMPTY: NotificationStudioConfig = {
  channels: CHANNELS.map((channel) => ({ channel, enabled: channel === "in_app" })),
  templateOverrides: [],
  unsubscribeFooterEnabled: true,
};

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function NotificationStudioPage() {
  const studio = useStudioConfig<NotificationStudioConfig>("notification", EMPTY);
  const { config, setConfig } = studio;

  function updateChannel(
    channel: NotificationChannelConfig["channel"],
    patch: Partial<NotificationChannelConfig>,
  ) {
    setConfig({
      ...config,
      channels: config.channels.map((c) => (c.channel === channel ? { ...c, ...patch } : c)),
    });
  }

  return (
    <AppShell title="Notificações">
      <StudioAreaShell
        title="Notificações"
        description="Canais habilitados, horário de silêncio e remetente padrão."
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {CHANNELS.map((channel) => {
                const c = config.channels.find((ch) => ch.channel === channel);
                const enabled = c?.enabled ?? false;
                return (
                  <div key={channel} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {CHANNEL_LABEL[channel]}
                      </p>
                      {enabled && (
                        <input
                          value={c?.defaultFrom ?? ""}
                          onChange={(e) =>
                            updateChannel(channel, { defaultFrom: e.target.value || undefined })
                          }
                          placeholder="Remetente padrão (opcional)"
                          className="mt-1.5 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-56"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChannel(channel, { enabled: !enabled })}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border-0 cursor-pointer ${
                        enabled
                          ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {enabled ? "Ativo" : "Inativo"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Horário de silêncio
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Início">
                  <input
                    type="time"
                    value={config.globalQuietHours?.start ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        globalQuietHours: {
                          start: e.target.value,
                          end: config.globalQuietHours?.end ?? "07:00",
                          timezone: config.globalQuietHours?.timezone ?? "America/Sao_Paulo",
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Fim">
                  <input
                    type="time"
                    value={config.globalQuietHours?.end ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        globalQuietHours: {
                          start: config.globalQuietHours?.start ?? "22:00",
                          end: e.target.value,
                          timezone: config.globalQuietHours?.timezone ?? "America/Sao_Paulo",
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Fuso horário">
                  <input
                    value={config.globalQuietHours?.timezone ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        globalQuietHours: {
                          start: config.globalQuietHours?.start ?? "22:00",
                          end: config.globalQuietHours?.end ?? "07:00",
                          timezone: e.target.value,
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.unsubscribeFooterEnabled}
                  onChange={(e) =>
                    setConfig({ ...config, unsubscribeFooterEnabled: e.target.checked })
                  }
                />
                Incluir rodapé de descadastro nos e-mails
              </label>
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
