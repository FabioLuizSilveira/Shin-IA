"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import { Copy as CopyIcon, Loader2, Sparkles, Check, Layers } from "lucide-react";

interface BrandKit {
  id: string;
  name: string;
  is_default: boolean;
}

interface ClonedAd {
  id: string;
  source_url: string | null;
  detected_layout: {
    structure?: string;
    visual_style?: string;
    text_elements?: string[];
    color_scheme?: string;
  };
  adapted_headline: string | null;
  adapted_body: string | null;
  adapted_cta: string | null;
  image_prompt: string | null;
  notes: string | null;
  model_used: string | null;
  created_at: string;
}

export default function ClonerPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [history, setHistory] = useState<ClonedAd[]>([]);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClonedAd | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    source_url: "",
    brand_kit_id: "",
    product_description: "",
  });

  const load = useCallback(async () => {
    const [kitsRes, historyRes] = await Promise.all([
      fetch("/api/brand-kits"),
      fetch("/api/clone"),
    ]);
    const kitsJson = (await kitsRes.json()) as { data?: BrandKit[] };
    const historyJson = (await historyRes.json()) as { data?: ClonedAd[] };
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

  async function handleClone(e: React.FormEvent) {
    e.preventDefault();
    setCloning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: form.source_url,
          brand_kit_id: form.brand_kit_id || undefined,
          product_description: form.product_description || undefined,
        }),
      });
      const json = (await res.json()) as { data?: ClonedAd; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro na clonagem");
      setResult(json.data ?? null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCloning(false);
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <MktShell title="Ad Cloner">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <form
          onSubmit={(e) => void handleClone(e)}
          className="lg:col-span-2 card-glass rounded-2xl p-5 h-fit"
        >
          <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-mkt-glow" /> Clonar anúncio de referência
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            A IA analisa a estrutura do anúncio e adapta textos, cores e produto para a sua marca.
          </p>

          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            URL da imagem do anúncio *
          </label>
          <input
            required
            type="url"
            value={form.source_url}
            onChange={(e) => setForm({ ...form, source_url: e.target.value })}
            placeholder="https://.../anuncio-referencia.png"
            className={inputCls}
          />

          <label className="block text-xs font-medium text-slate-400 mb-1.5 mt-3">Marca</label>
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

          <label className="block text-xs font-medium text-slate-400 mb-1.5 mt-3">
            Produto/oferta a promover
          </label>
          <textarea
            rows={3}
            value={form.product_description}
            onChange={(e) => setForm({ ...form, product_description: e.target.value })}
            placeholder="O que o anúncio adaptado deve vender..."
            className={inputCls}
          />

          <button
            type="submit"
            disabled={cloning || !form.source_url.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition border-0 cursor-pointer"
          >
            {cloning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analisando e adaptando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Clonar para minha marca
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
                <h3 className="text-sm font-bold text-mkt-glow">Adaptação gerada</h3>
                <span className="text-[10px] text-slate-500">{result.model_used}</span>
              </div>

              <p className="text-lg font-bold text-white">{result.adapted_headline}</p>
              <p className="text-sm text-slate-300 mt-1">{result.adapted_body}</p>
              <p className="text-xs text-mkt-glow font-semibold mt-2">{result.adapted_cta}</p>

              {result.detected_layout?.structure && (
                <div className="mt-4 rounded-xl bg-white/5 p-3">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Layout detectado</p>
                  <p className="text-xs text-slate-300">{result.detected_layout.structure}</p>
                  {result.detected_layout.visual_style && (
                    <p className="text-xs text-slate-500 mt-1">
                      Estilo: {result.detected_layout.visual_style}
                    </p>
                  )}
                </div>
              )}

              {result.notes && (
                <div className="mt-3 rounded-xl bg-white/5 p-3">
                  <p className="text-xs font-semibold text-slate-400 mb-1">
                    Por que este anúncio funciona
                  </p>
                  <p className="text-xs text-slate-300">{result.notes}</p>
                </div>
              )}

              {result.image_prompt && (
                <div className="mt-3 rounded-xl bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">Prompt de imagem</p>
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
              <p className="text-sm text-slate-500">Nenhuma clonagem ainda.</p>
            ) : (
              <div className="space-y-3">
                {history.map((clone) => (
                  <div key={clone.id} className="card-glass rounded-xl p-4">
                    <p className="text-sm font-bold text-white">{clone.adapted_headline}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{clone.adapted_body}</p>
                    <p className="text-[11px] text-mkt-glow font-semibold mt-1.5">
                      {clone.adapted_cta}
                    </p>
                    {clone.source_url && (
                      <a
                        href={clone.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-500 hover:text-white mt-2 inline-block no-underline"
                      >
                        Ver referência original ↗
                      </a>
                    )}
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

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";
