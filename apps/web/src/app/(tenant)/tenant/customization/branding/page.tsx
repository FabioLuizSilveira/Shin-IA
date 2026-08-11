"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import type { BrandingConfig } from "@shina/studio";
import { Pencil, Loader2, ImageOff } from "lucide-react";

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

interface LogoUploadFieldProps {
  label: string;
  kind: "logo" | "favicon";
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  specs: string;
  previewClassName: string;
}

// Preview box with a pencil button overlaid on the corner — click it to pick
// a file, which uploads immediately via /api/tenant-studio/branding/upload
// and swaps config.logoUrl/faviconUrl to the resulting public URL. The
// upload itself is a side effect outside the draft/publish flow; only the
// resulting URL rides that flow (same field these two used to be free-text
// inputs for).
function LogoUploadField({
  label,
  kind,
  value,
  onChange,
  specs,
  previewClassName,
}: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch("/api/tenant-studio/branding/upload", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao enviar imagem");
      onChange(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-start gap-3">
        <div className={`relative shrink-0 ${previewClassName}`}>
          <div className="w-full h-full rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
            ) : (
              <ImageOff className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            title={`Editar ${label.toLowerCase()}`}
            className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Pencil className="w-3 h-3" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            onChange={(e) => void handleFile(e)}
            className="hidden"
          />
        </div>
        <div className="pt-0.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">{specs}</p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </Field>
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
                <LogoUploadField
                  label="Logo"
                  kind="logo"
                  value={config.logoUrl}
                  onChange={(url) => setConfig({ ...config, logoUrl: url })}
                  specs="PNG, SVG ou WebP com fundo transparente. Recomendado: 240×64px (proporção ~3.75:1). Até 2MB."
                  previewClassName="w-24 h-16"
                />
                <LogoUploadField
                  label="Favicon"
                  kind="favicon"
                  value={config.faviconUrl}
                  onChange={(url) => setConfig({ ...config, faviconUrl: url })}
                  specs="PNG, ICO ou SVG, formato quadrado. Recomendado: 64×64px (mín. 32×32px). Até 2MB."
                  previewClassName="w-16 h-16"
                />
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
