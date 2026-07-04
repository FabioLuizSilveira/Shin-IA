"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import {
  Megaphone,
  Plus,
  Loader2,
  X,
  ShieldCheck,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Strategy {
  target_audience?: string;
  key_message?: string;
  channels?: { channel: string; rationale: string }[];
  funnel?: { stage: string; tactic: string }[];
  differentiators?: string[];
  expected_kpis?: { metric: string; target: string }[];
  next_steps?: string[];
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  objective: string | null;
  budget_daily: number | null;
  status: string;
  start_date: string | null;
  created_at: string;
  ai_strategy: Strategy | null;
}

interface BrandKit {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, [string, string]> = {
  draft: ["Rascunho", "bg-slate-500/15 text-slate-400"],
  pending_approval: ["Aguardando aprovação", "bg-amber-500/15 text-amber-400"],
  approved: ["Aprovada", "bg-emerald-500/15 text-emerald-400"],
  active: ["Ativa", "bg-emerald-500/15 text-emerald-400"],
  paused: ["Pausada", "bg-orange-500/15 text-orange-400"],
  completed: ["Concluída", "bg-slate-500/15 text-slate-400"],
  archived: ["Arquivada", "bg-slate-500/15 text-slate-500"],
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState(0);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    platform: "meta",
    objective: "",
    budget_daily: "",
    start_date: "",
    brand_kit_id: "",
  });
  const [strategyFor, setStrategyFor] = useState<string | null>(null);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  async function generateStrategy(campaignId: string) {
    setStrategyFor(campaignId);
    setError(null);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar estratégia");
      setExpandedStrategy(campaignId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setStrategyFor(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [campaignsRes, draftsRes, kitsRes] = await Promise.all([
      fetch("/api/campaigns"),
      fetch("/api/drafts?status=pending"),
      fetch("/api/brand-kits"),
    ]);
    const campaignsJson = (await campaignsRes.json()) as { data?: Campaign[] };
    const draftsJson = (await draftsRes.json()) as { data?: unknown[] };
    const kitsJson = (await kitsRes.json()) as { data?: BrandKit[] };
    setCampaigns(campaignsJson.data ?? []);
    setPendingDrafts(draftsJson.data?.length ?? 0);
    setKits(kitsJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          platform: form.platform,
          objective: form.objective || undefined,
          budget_daily: form.budget_daily ? Number(form.budget_daily) : undefined,
          start_date: form.start_date || undefined,
          brand_kit_id: form.brand_kit_id || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao criar campanha");
      setShowForm(false);
      setForm({
        name: "",
        platform: "meta",
        objective: "",
        budget_daily: "",
        start_date: "",
        brand_kit_id: "",
      });
      setNotice(
        "Rascunho de campanha criado. Ele precisa ser aprovado na Central de Aprovações antes de qualquer publicação.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MktShell title="Campanhas">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-400">
            Toda campanha nasce como rascunho e exige aprovação humana antes de ir ao ar.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Nova campanha
          </button>
        </div>

        {pendingDrafts > 0 && (
          <a
            href="/approvals"
            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm no-underline hover:bg-amber-500/15 transition"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {pendingDrafts} rascunho{pendingDrafts > 1 ? "s" : ""} aguardando aprovação — clique
            para revisar
          </a>
        )}

        {notice && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-0.5 text-emerald-400/60 hover:text-emerald-400 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={(e) => void handleCreate(e)} className="card-glass rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Nova campanha (rascunho)</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da campanha *"
                className={inputCls}
              />
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={inputCls}
              >
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Ads</option>
                <option value="linkedin">LinkedIn Ads</option>
              </select>
              <input
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                placeholder="Objetivo (ex: conversões)"
                className={inputCls}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget_daily}
                onChange={(e) => setForm({ ...form, budget_daily: e.target.value })}
                placeholder="Orçamento diário (R$)"
                className={inputCls}
              />
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputCls}
              />
              <select
                value={form.brand_kit_id}
                onChange={(e) => setForm({ ...form, brand_kit_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Sem brand kit</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar rascunho
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card-glass rounded-2xl p-10 text-center">
            <Megaphone className="w-8 h-8 text-mkt-glow mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Nenhuma campanha aprovada ainda. Crie um rascunho e aprove na Central de Aprovações.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const [label, cls] = STATUS_LABELS[c.status] ?? [
                c.status,
                "bg-white/5 text-slate-400",
              ];
              const s = c.ai_strategy;
              const expanded = expandedStrategy === c.id;
              return (
                <div key={c.id} className="card-glass rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {c.platform} {c.objective ? `· ${c.objective}` : ""}{" "}
                        {c.budget_daily ? `· R$${c.budget_daily}/dia` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={strategyFor === c.id}
                      onClick={() =>
                        s
                          ? setExpandedStrategy(expanded ? null : c.id)
                          : void generateStrategy(c.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mkt-primary/15 text-mkt-glow hover:bg-mkt-primary/25 text-xs font-semibold transition border-0 cursor-pointer"
                    >
                      {strategyFor === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Brain className="w-3.5 h-3.5" />
                      )}
                      {s ? "Estratégia" : "Gerar estratégia IA"}
                      {s &&
                        (expanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cls}`}>
                      {label}
                    </span>
                  </div>

                  {s && expanded && (
                    <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {s.target_audience && (
                        <div>
                          <p className="font-semibold text-slate-400 mb-1">Público-alvo</p>
                          <p className="text-slate-300">{s.target_audience}</p>
                        </div>
                      )}
                      {s.key_message && (
                        <div>
                          <p className="font-semibold text-slate-400 mb-1">Mensagem-chave</p>
                          <p className="text-slate-300">{s.key_message}</p>
                        </div>
                      )}
                      {s.funnel && s.funnel.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-400 mb-1">Funil</p>
                          {s.funnel.map((f, i) => (
                            <p key={i} className="text-slate-300">
                              <span className="text-mkt-glow font-semibold">{f.stage}:</span>{" "}
                              {f.tactic}
                            </p>
                          ))}
                        </div>
                      )}
                      {s.expected_kpis && s.expected_kpis.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-400 mb-1">KPIs esperados</p>
                          {s.expected_kpis.map((k, i) => (
                            <p key={i} className="text-slate-300">
                              {k.metric}: <span className="text-white">{k.target}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {s.next_steps && s.next_steps.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className="font-semibold text-slate-400 mb-1">Próximos passos</p>
                          <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                            {s.next_steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MktShell>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";
