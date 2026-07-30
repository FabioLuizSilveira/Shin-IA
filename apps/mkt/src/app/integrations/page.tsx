"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MktShell } from "@/components/layout/mkt-shell";
import {
  Plug,
  Loader2,
  RefreshCw,
  Unlink,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Integration {
  platform: string;
  label: string;
  configured: boolean;
  missingEnv: string[];
  status: "not_configured" | "disconnected" | "pending" | "connected" | "error";
  accountName: string | null;
  lastSyncedAt: string | null;
  metrics: { impressions: number; clicks: number; spend: number; currency: string } | null;
}

const STATUS_LABELS: Record<Integration["status"], [string, string]> = {
  not_configured: ["Configuração pendente", "bg-slate-500/15 text-slate-400"],
  disconnected: ["Desconectado", "bg-slate-500/15 text-slate-400"],
  pending: ["Conectando...", "bg-amber-500/15 text-amber-400"],
  connected: ["Conectado", "bg-emerald-500/15 text-emerald-400"],
  error: ["Erro", "bg-red-500/15 text-red-400"],
};

export default function IntegrationsPage() {
  return (
    <MktShell title="Integrações">
      <Suspense fallback={null}>
        <IntegrationsContent />
      </Suspense>
    </MktShell>
  );
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/integrations");
    const json = (await res.json()) as { data?: Integration[] };
    setIntegrations(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setBanner({ kind: "success", text: `${connected} conectado com sucesso.` });
    } else if (error) {
      const platform = searchParams.get("platform");
      setBanner({
        kind: "error",
        text:
          error === "not_configured"
            ? `Cadastre o app OAuth de ${platform ?? "essa plataforma"} nas variáveis de ambiente antes de conectar.`
            : "Não foi possível conectar. Tente novamente.",
      });
    }
  }, [searchParams]);

  async function handleSync(platform: string) {
    setSyncing(platform);
    try {
      const res = await fetch(`/api/integrations/${platform}/sync`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao sincronizar");
      await load();
    } catch (e) {
      setBanner({ kind: "error", text: e instanceof Error ? e.message : "Falha ao sincronizar" });
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(platform: string) {
    if (!window.confirm("Desconectar esta integração? O token salvo será removido.")) return;
    await fetch(`/api/integrations/${platform}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card-glass rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <Plug className="w-4 h-4 text-mkt-glow" /> Integrações de Ads
        </h2>
        <p className="text-xs text-slate-500">
          Conecte Meta Ads, Google Ads, TikTok Ads e LinkedIn Ads via OAuth para ler performance e,
          no futuro, publicar campanhas aprovadas.
        </p>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs ${
            banner.kind === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {banner.kind === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          {banner.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const [statusLabel, statusCls] = STATUS_LABELS[integration.status];
            return (
              <div key={integration.platform} className="card-glass rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{integration.label}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCls}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {integration.status === "connected" && (
                      <p className="text-xs text-slate-500 mt-1">
                        {integration.accountName ?? "Conta vinculada"}
                        {integration.lastSyncedAt
                          ? ` · sincronizado ${new Date(integration.lastSyncedAt).toLocaleString("pt-BR")}`
                          : " · ainda não sincronizado"}
                      </p>
                    )}
                    {!integration.configured && (
                      <p className="text-xs text-slate-600 mt-1">
                        Faltam: {integration.missingEnv.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {integration.status === "connected" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSync(integration.platform)}
                          disabled={syncing === integration.platform}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition border-0 cursor-pointer"
                        >
                          {syncing === integration.platform ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Sincronizar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(integration.platform)}
                          className="p-2 text-slate-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <a
                        href={
                          integration.configured
                            ? `/api/integrations/${integration.platform}/connect`
                            : undefined
                        }
                        aria-disabled={!integration.configured}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          integration.configured
                            ? "bg-mkt-primary hover:bg-indigo-500 text-white cursor-pointer"
                            : "bg-white/5 text-slate-500 cursor-not-allowed pointer-events-none"
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Conectar
                      </a>
                    )}
                  </div>
                </div>

                {integration.status === "connected" && integration.metrics && (
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                    <Metric
                      label="Impressões"
                      value={integration.metrics.impressions.toLocaleString("pt-BR")}
                    />
                    <Metric
                      label="Cliques"
                      value={integration.metrics.clicks.toLocaleString("pt-BR")}
                    />
                    <Metric
                      label="Gasto"
                      value={`${integration.metrics.currency} ${integration.metrics.spend.toLocaleString("pt-BR")}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
