"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import { Wand2, Loader2, Sparkles, Copy as CopyIcon, Check } from "lucide-react";

interface BrandKit {
  id: string;
  name: string;
  is_default: boolean;
}

interface Variation {
  headline: string;
  body_copy: string;
  cta: string;
}

interface GeneratedAd {
  id: string;
  platform: string | null;
  format: string;
  headline: string | null;
  body_copy: string | null;
  cta: string | null;
  image_prompt: string | null;
  variations: Variation[];
  model_used: string | null;
  created_at: string;
}

const PLATFORMS = [
  ["meta", "Meta (Facebook/Instagram)"],
  ["google", "Google Ads"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
] as const;

const FORMATS = ["1080x1080", "1080x1920", "1920x1080", "1200x628"] as const;

export default function GeneratorPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [history, setHistory] = useState<GeneratedAd[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedAd | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand_kit_id: "",
    platform: "meta",
    format: "1080x1080",
    objective: "",
    brief: "",
  });

  const load = useCallback(async () => {
    const [kitsRes, historyRes] = await Promise.all([
      fetch("/api/brand-kits"),
      fetch("/api/generate"),
    ]);
    const kitsJson = (await kitsRes.json()) as { data?: BrandKit[] };
    const historyJson = (await historyRes.json()) as { data?: GeneratedAd[] };
    const loadedKits = kitsJson.data ?? [];
    setKits(loadedKits);
    setHistory(historyJson.data ?? []);
    const defaultKit = loadedKits.find((k) => k.is_default) ?? loadedKits[0];
    if (defaultKit) {
      setForm((f) => (f.brand_kit_id ? f : { ...f, brand_kit_id: defaultKit.id }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, brand_kit_id: form.brand_kit_id || undefined }),
      });
      const json = (await res.json()) as { data?: GeneratedAd; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro na geração");
      setResult(json.data ?? null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setGenerating(false);
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <MktShell title="Gerador IA">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <form
          onSubmit={(e) => void handleGenerate(e)}
          className="lg:col-span-2 card-glass rounded-2xl p-5 h-fit"
        >
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-mkt-glow" /> Novo anúncio
          </h2>

          <label className="block text-xs font-medium text-slate-400 mb-1.5">Marca</label>
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

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Plataforma</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={inputCls}
              >
                {PLATFORMS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Formato</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className={inputCls}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="block text-xs font-medium text-slate-400 mb-1.5 mt-3">
            Objetivo (opcional)
          </label>
          <input
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder="Ex: gerar leads para trial gratuito"
            className={inputCls}
          />

          <label className="block text-xs font-medium text-slate-400 mb-1.5 mt-3">
            Briefing do anúncio *
          </label>
          <textarea
            required
            rows={5}
            value={form.brief}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
            placeholder="Descreva o produto/serviço, público-alvo, oferta e o que o anúncio deve comunicar..."
            className={inputCls}
          />

          <button
            type="submit"
            disabled={generating || !form.brief.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition border-0 cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Gerar anúncio
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}
        </form>

        {/* Result + history */}
        <div className="lg:col-span-3 space-y-4">
          {result && (
            <div className="card-glass rounded-2xl p-5 ring-1 ring-mkt-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-mkt-glow">Anúncio gerado</h3>
                <span className="text-[10px] text-slate-500">{result.model_used}</span>
              </div>
              <AdCard ad={result} onCopy={copyText} copied={copied} highlight />
              {result.variations?.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-400">Variações</p>
                  {result.variations.map((v, i) => (
                    <div key={i} className="rounded-xl bg-white/5 p-3">
                      <p className="text-sm font-semibold text-white">{v.headline}</p>
                      <p className="text-xs text-slate-400 mt-1">{v.body_copy}</p>
                      <p className="text-[11px] text-mkt-glow mt-1.5 font-semibold">{v.cta}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.image_prompt && (
                <div className="mt-4 rounded-xl bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">
                      Prompt de imagem (use no seu gerador preferido)
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyText("img", result.image_prompt ?? "")}
                      className="p-1 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer"
                    >
                      {copied === "img" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <CopyIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-mono">{result.image_prompt}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Histórico ({history.length})
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum anúncio gerado ainda.</p>
            ) : (
              <div className="space-y-3">
                {history.map((ad) => (
                  <div key={ad.id} className="card-glass rounded-xl p-4">
                    <AdCard ad={ad} onCopy={copyText} copied={copied} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MktShell>
  );
}

function AdCard({
  ad,
  onCopy,
  copied,
  highlight,
}: {
  ad: GeneratedAd;
  onCopy: (id: string, text: string) => Promise<void>;
  copied: string | null;
  highlight?: boolean;
}) {
  const fullText = [ad.headline, ad.body_copy, ad.cta].filter(Boolean).join("\n\n");
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-bold ${highlight ? "text-lg text-white" : "text-sm text-white"}`}>
            {ad.headline}
          </p>
          <p className="text-sm text-slate-300 mt-1">{ad.body_copy}</p>
          <p className="text-xs text-mkt-glow font-semibold mt-2">{ad.cta}</p>
        </div>
        <button
          type="button"
          title="Copiar texto"
          onClick={() => void onCopy(ad.id, fullText)}
          className="p-1.5 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer shrink-0"
        >
          {copied === ad.id ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <CopyIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
          {ad.platform}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
          {ad.format}
        </span>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";
