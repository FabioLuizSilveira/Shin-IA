"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import {
  Library,
  Search,
  Bookmark,
  Trash2,
  Plus,
  Loader2,
  Eye,
  X,
  ExternalLink,
} from "lucide-react";

interface AdEntry {
  id: string;
  platform: string;
  brand_name: string;
  creative_url: string | null;
  creative_type: string;
  headline: string | null;
  body_copy: string | null;
  cta: string | null;
  landing_url: string | null;
  duration_days: number | null;
}

interface SwipeItem {
  id: string;
  title: string | null;
  notes: string | null;
  custom_ad_url: string | null;
  ad: AdEntry | null;
}

interface Competitor {
  id: string;
  brand_name: string;
  brand_domain: string | null;
  platforms: string[];
}

type Tab = "search" | "swipe" | "competitors";

const PLATFORMS = ["meta", "google", "tiktok", "linkedin", "other"] as const;

export default function AdLibraryPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [ads, setAds] = useState<AdEntry[]>([]);
  const [swipe, setSwipe] = useState<SwipeItem[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddAd, setShowAddAd] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [adForm, setAdForm] = useState({
    brand_name: "",
    platform: "meta",
    headline: "",
    body_copy: "",
    cta: "",
    creative_url: "",
    landing_url: "",
  });

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (platform) params.set("platform", platform);
      const res = await fetch(`/api/ad-library?${params}`);
      const json = (await res.json()) as { data?: AdEntry[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro na busca");
      setAds(json.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [q, platform]);

  const loadSwipe = useCallback(async () => {
    const res = await fetch("/api/swipe-file");
    const json = (await res.json()) as { data?: SwipeItem[] };
    setSwipe(json.data ?? []);
  }, []);

  const loadCompetitors = useCallback(async () => {
    const res = await fetch("/api/competitors");
    const json = (await res.json()) as { data?: Competitor[] };
    setCompetitors(json.data ?? []);
  }, []);

  useEffect(() => {
    void search();
    void loadSwipe();
    void loadCompetitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveToSwipe(adId: string) {
    await fetch("/api/swipe-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_library_id: adId }),
    });
    await loadSwipe();
  }

  async function removeFromSwipe(id: string) {
    await fetch(`/api/swipe-file?id=${id}`, { method: "DELETE" });
    await loadSwipe();
  }

  async function addAd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/ad-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adForm),
    });
    if (res.ok) {
      setShowAddAd(false);
      setAdForm({
        brand_name: "",
        platform: "meta",
        headline: "",
        body_copy: "",
        cta: "",
        creative_url: "",
        landing_url: "",
      });
      await search();
    }
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompetitor.trim()) return;
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_name: newCompetitor.trim() }),
    });
    setNewCompetitor("");
    await loadCompetitors();
  }

  async function removeCompetitor(id: string) {
    await fetch(`/api/competitors?id=${id}`, { method: "DELETE" });
    await loadCompetitors();
  }

  const savedAdIds = new Set(swipe.map((s) => s.ad?.id).filter(Boolean));

  return (
    <MktShell title="Ad Library">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/5">
        {(
          [
            ["search", "Buscar anúncios"],
            ["swipe", `Swipe File (${swipe.length})`],
            ["competitors", `Concorrentes (${competitors.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition border-0 bg-transparent cursor-pointer border-b-2",
              tab === id
                ? "text-mkt-glow border-mkt-primary"
                : "text-slate-400 hover:text-white border-transparent",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Search tab ── */}
      {tab === "search" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()}
                placeholder="Buscar por marca, headline ou copy..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40"
              />
            </div>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none"
            >
              <option value="">Todas as plataformas</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void search()}
              className="px-5 py-2.5 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => setShowAddAd(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-white/10 hover:border-white/20 text-white text-sm font-medium rounded-xl transition bg-transparent cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Indexar anúncio
            </button>
          </div>

          {showAddAd && (
            <form
              onSubmit={(e) => void addAd(e)}
              className="card-glass rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div className="sm:col-span-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Indexar anúncio manualmente</h3>
                <button
                  type="button"
                  onClick={() => setShowAddAd(false)}
                  className="p-1 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                required
                value={adForm.brand_name}
                onChange={(e) => setAdForm({ ...adForm, brand_name: e.target.value })}
                placeholder="Marca *"
                className={inputCls}
              />
              <select
                value={adForm.platform}
                onChange={(e) => setAdForm({ ...adForm, platform: e.target.value })}
                className={inputCls}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                value={adForm.headline}
                onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })}
                placeholder="Headline"
                className={inputCls}
              />
              <input
                value={adForm.cta}
                onChange={(e) => setAdForm({ ...adForm, cta: e.target.value })}
                placeholder="CTA (ex: Saiba mais)"
                className={inputCls}
              />
              <input
                value={adForm.creative_url}
                onChange={(e) => setAdForm({ ...adForm, creative_url: e.target.value })}
                placeholder="URL do criativo (imagem/vídeo)"
                className={inputCls}
              />
              <input
                value={adForm.landing_url}
                onChange={(e) => setAdForm({ ...adForm, landing_url: e.target.value })}
                placeholder="URL da landing page"
                className={inputCls}
              />
              <textarea
                rows={2}
                value={adForm.body_copy}
                onChange={(e) => setAdForm({ ...adForm, body_copy: e.target.value })}
                placeholder="Texto do anúncio"
                className={`${inputCls} sm:col-span-2`}
              />
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
                >
                  Indexar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          ) : ads.length === 0 ? (
            <div className="card-glass rounded-2xl p-10 text-center">
              <Library className="w-8 h-8 text-mkt-glow mx-auto mb-3" />
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Nenhum anúncio no índice ainda. Indexe anúncios manualmente ou use a extensão Chrome
                (em breve) para capturar direto do feed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad) => (
                <div key={ad.id} className="card-glass rounded-2xl overflow-hidden flex flex-col">
                  {ad.creative_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ad.creative_url}
                      alt={ad.headline ?? ad.brand_name}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-white/5 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{ad.brand_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                        {ad.platform}
                      </span>
                    </div>
                    {ad.headline && (
                      <p className="text-sm font-semibold text-slate-200 mb-1">{ad.headline}</p>
                    )}
                    {ad.body_copy && (
                      <p className="text-xs text-slate-400 line-clamp-3 mb-2">{ad.body_copy}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      {ad.landing_url ? (
                        <a
                          href={ad.landing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1 no-underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Landing
                        </a>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        disabled={savedAdIds.has(ad.id)}
                        onClick={() => void saveToSwipe(ad.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-mkt-primary/15 text-mkt-glow hover:bg-mkt-primary/25 disabled:opacity-50 transition border-0 cursor-pointer"
                      >
                        <Bookmark className="w-3 h-3" />
                        {savedAdIds.has(ad.id) ? "Salvo" : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Swipe file tab ── */}
      {tab === "swipe" &&
        (swipe.length === 0 ? (
          <div className="card-glass rounded-2xl p-10 text-center">
            <Bookmark className="w-8 h-8 text-mkt-glow mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Seu swipe file está vazio. Salve anúncios vencedores da busca para consultar depois.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {swipe.map((item) => (
              <div key={item.id} className="card-glass rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {item.ad?.headline ?? item.title ?? item.custom_ad_url ?? "Anúncio salvo"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.ad ? `${item.ad.brand_name} · ${item.ad.platform}` : (item.notes ?? "")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeFromSwipe(item.id)}
                  className="p-2 text-slate-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ))}

      {/* ── Competitors tab ── */}
      {tab === "competitors" && (
        <div className="max-w-xl">
          <form onSubmit={(e) => void addCompetitor(e)} className="flex gap-3 mb-6">
            <input
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              placeholder="Nome da marca concorrente"
              className={`${inputCls} flex-1`}
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Monitorar
            </button>
          </form>
          {competitors.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum concorrente monitorado. Adicione marcas para acompanhar os anúncios delas.
            </p>
          ) : (
            <div className="space-y-2">
              {competitors.map((c) => (
                <div key={c.id} className="card-glass rounded-xl p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{c.brand_name}</p>
                    <p className="text-xs text-slate-500">{c.platforms.join(", ")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeCompetitor(c.id)}
                    className="p-2 text-slate-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MktShell>
  );
}

const inputCls =
  "px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";
