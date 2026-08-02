"use client";

import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import type { BrandingConfig } from "@shina/studio";

const EMPTY: BrandingConfig = {
  companyName: "",
  colorPalette: {
    primary: "#2563EB",
    secondary: "#0EA5E9",
    accent: "#8B5CF6",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#0F172A",
    textSecondary: "#64748B",
    border: "#E2E8F0",
    error: "#DC2626",
    warning: "#D97706",
    success: "#059669",
    info: "#2563EB",
  },
  typography: { fontFamily: "Inter", baseSizeRem: 1, scaleRatio: 1.25 },
  whiteLabel: false,
  poweredByVisible: true,
};

const COLOR_LABELS: Record<keyof BrandingConfig["colorPalette"], string> = {
  primary: "Primária",
  secondary: "Secundária",
  accent: "Destaque",
  background: "Fundo",
  surface: "Superfície",
  text: "Texto",
  textSecondary: "Texto secundário",
  border: "Borda",
  error: "Erro",
  warning: "Aviso",
  success: "Sucesso",
  info: "Informação",
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

export default function BrandingStudioPage() {
  const studio = useStudioConfig<BrandingConfig>("branding", EMPTY);
  const { config, setConfig } = studio;

  return (
    <AppShell title="Marca">
      <StudioAreaShell
        title="Marca"
        description="Cores, tipografia, logo e domínio customizado."
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <Field label="Nome da empresa">
                <input
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Logo (URL)">
                  <input
                    value={config.logoUrl ?? ""}
                    onChange={(e) => setConfig({ ...config, logoUrl: e.target.value || undefined })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Favicon (URL)">
                  <input
                    value={config.faviconUrl ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, faviconUrl: e.target.value || undefined })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Domínio customizado">
                <input
                  value={config.customDomain ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, customDomain: e.target.value || undefined })
                  }
                  placeholder="app.suaempresa.com"
                  className={inputClass}
                />
              </Field>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.whiteLabel}
                    onChange={(e) => setConfig({ ...config, whiteLabel: e.target.checked })}
                  />
                  White label
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.poweredByVisible}
                    onChange={(e) => setConfig({ ...config, poweredByVisible: e.target.checked })}
                  />
                  Mostrar &quot;powered by Shinã&quot;
                </label>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Paleta de cores
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(
                  Object.keys(config.colorPalette) as Array<keyof BrandingConfig["colorPalette"]>
                ).map((key) => (
                  <Field key={key} label={COLOR_LABELS[key]}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.colorPalette[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            colorPalette: { ...config.colorPalette, [key]: e.target.value },
                          })
                        }
                        className="w-9 h-9 rounded border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        value={config.colorPalette[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            colorPalette: { ...config.colorPalette, [key]: e.target.value },
                          })
                        }
                        className={`${inputClass} font-mono text-xs`}
                      />
                    </div>
                  </Field>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Tipografia
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fonte">
                  <input
                    value={config.typography.fontFamily}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        typography: { ...config.typography, fontFamily: e.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Fonte de títulos (opcional)">
                  <input
                    value={config.typography.headingFontFamily ?? ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        typography: {
                          ...config.typography,
                          headingFontFamily: e.target.value || undefined,
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Tamanho base (rem)">
                  <input
                    type="number"
                    step="0.1"
                    value={config.typography.baseSizeRem}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        typography: { ...config.typography, baseSizeRem: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Escala">
                  <input
                    type="number"
                    step="0.05"
                    value={config.typography.scaleRatio}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        typography: { ...config.typography, scaleRatio: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
