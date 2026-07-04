"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MktShell } from "@/components/layout/mkt-shell";
import {
  Megaphone,
  Wand2,
  ShieldCheck,
  Coins,
  Library,
  Copy,
  Palette,
  Bookmark,
  Loader2,
} from "lucide-react";

interface Metrics {
  campaigns: number;
  generated_ads: number;
  cloned_ads: number;
  pending_drafts: number;
  competitors: number;
  swipe_items: number;
  brand_kits: number;
  tokens_used: number;
  credits_limit: number;
  plan: string;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/metrics");
        const json = (await res.json()) as { data?: Metrics };
        setMetrics(json.data ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = metrics
    ? [
        {
          label: "Campanhas",
          value: String(metrics.campaigns),
          icon: Megaphone,
          href: "/campaigns",
        },
        {
          label: "Anúncios gerados",
          value: String(metrics.generated_ads),
          icon: Wand2,
          href: "/generator",
        },
        { label: "Clonagens", value: String(metrics.cloned_ads), icon: Copy, href: "/cloner" },
        {
          label: "Drafts pendentes",
          value: String(metrics.pending_drafts),
          icon: ShieldCheck,
          href: "/approvals",
          alert: metrics.pending_drafts > 0,
        },
        {
          label: "Concorrentes monitorados",
          value: String(metrics.competitors),
          icon: Library,
          href: "/ad-library",
        },
        {
          label: "Swipe file",
          value: String(metrics.swipe_items),
          icon: Bookmark,
          href: "/ad-library",
        },
        {
          label: "Brand kits",
          value: String(metrics.brand_kits),
          icon: Palette,
          href: "/brand-kit",
        },
        {
          label: `Tokens IA (plano ${metrics.plan})`,
          value:
            metrics.credits_limit > 0
              ? `${metrics.tokens_used.toLocaleString("pt-BR")} / ${metrics.credits_limit.toLocaleString("pt-BR")}`
              : metrics.tokens_used.toLocaleString("pt-BR"),
          icon: Coins,
          href: "/settings",
        },
      ]
    : [];

  return (
    <MktShell title="Dashboard">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando métricas...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Link
                  key={kpi.label}
                  href={kpi.href}
                  className={[
                    "card-glass rounded-2xl p-5 no-underline hover:bg-white/[0.06] transition",
                    "alert" in kpi && kpi.alert ? "ring-1 ring-amber-500/40" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                    <Icon className="w-4 h-4 text-mkt-glow" />
                  </div>
                  <p className="text-2xl font-black text-white">{kpi.value}</p>
                </Link>
              );
            })}
          </div>

          {metrics && metrics.brand_kits === 0 && (
            <div className="card-glass rounded-2xl p-8 text-center">
              <h2 className="text-lg font-bold text-white mb-2">Comece pelo seu Brand Kit</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
                Cadastre logo, cores, tipografia e tom de voz da sua marca. A IA usará esses dados
                em todas as gerações de anúncios.
              </p>
              <Link
                href="/brand-kit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors no-underline"
              >
                Configurar Brand Kit
              </Link>
            </div>
          )}
        </>
      )}
    </MktShell>
  );
}
