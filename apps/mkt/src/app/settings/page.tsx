"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import { KeyRound, Loader2, Trash2, Check, Coins } from "lucide-react";

interface ProviderConfig {
  id: string;
  provider: string;
  default_model: string | null;
  base_url: string | null;
  is_active: boolean;
  is_default: boolean;
  monthly_limit_usd: number | null;
  has_key: boolean;
}

interface Workspace {
  name: string;
  plan: string;
  credits_used: number;
  credits_limit: number;
}

const PROVIDER_OPTIONS = [
  ["anthropic", "Anthropic (Claude)"],
  ["openai", "OpenAI"],
  ["gemini", "Google Gemini"],
  ["deepseek", "DeepSeek"],
  ["mistral", "Mistral"],
  ["groq", "Groq"],
  ["openrouter", "OpenRouter"],
  ["ollama", "Ollama (self-hosted)"],
] as const;

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "anthropic",
    api_key: "",
    default_model: "",
    base_url: "",
    monthly_limit_usd: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [providersRes, workspaceRes] = await Promise.all([
      fetch("/api/ai-providers"),
      fetch("/api/workspace"),
    ]);
    const providersJson = (await providersRes.json()) as { data?: ProviderConfig[] };
    const workspaceJson = (await workspaceRes.json()) as { data?: Workspace };
    setProviders(providersJson.data ?? []);
    setWorkspace(workspaceJson.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          api_key: form.api_key || undefined,
          default_model: form.default_model || undefined,
          base_url: form.base_url || undefined,
          monthly_limit_usd: form.monthly_limit_usd ? Number(form.monthly_limit_usd) : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar provider");
      setForm({ ...form, api_key: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remover este provider? A chave criptografada será excluída.")) return;
    await fetch(`/api/ai-providers?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <MktShell title="Configurações">
      <div className="max-w-2xl space-y-6">
        {/* Workspace / plan */}
        {workspace && (
          <div className="card-glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">{workspace.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Plano <span className="text-mkt-glow font-semibold">{workspace.plan}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Coins className="w-4 h-4 text-mkt-glow" />
                {workspace.credits_used.toLocaleString("pt-BR")} /{" "}
                {workspace.credits_limit.toLocaleString("pt-BR")} créditos
              </div>
            </div>
          </div>
        )}

        {/* BYOK */}
        <div className="card-glass rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-mkt-glow" /> Provedores de IA (BYOK)
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            Use suas próprias chaves de API. Elas são criptografadas (AES-256) antes de salvar e têm
            prioridade sobre os créditos da plataforma.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              {providers.length > 0 && (
                <div className="space-y-2 mb-5">
                  {providers.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white capitalize">{p.provider}</p>
                        <p className="text-xs text-slate-500">
                          {p.has_key ? "Chave configurada ✓" : "Sem chave"}
                          {p.default_model ? ` · ${p.default_model}` : ""}
                          {p.monthly_limit_usd ? ` · limite US$${p.monthly_limit_usd}/mês` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p.id)}
                        className="p-2 text-slate-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className={inputCls}
                  >
                    {PROVIDER_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    placeholder="API key (será criptografada)"
                    className={inputCls}
                    autoComplete="off"
                  />
                  <input
                    value={form.default_model}
                    onChange={(e) => setForm({ ...form, default_model: e.target.value })}
                    placeholder="Modelo padrão (opcional)"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    min="0"
                    value={form.monthly_limit_usd}
                    onChange={(e) => setForm({ ...form, monthly_limit_usd: e.target.value })}
                    placeholder="Limite mensal US$ (opcional)"
                    className={inputCls}
                  />
                  {(form.provider === "ollama" || form.provider === "openrouter") && (
                    <input
                      value={form.base_url}
                      onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                      placeholder="Base URL"
                      className={`${inputCls} sm:col-span-2`}
                    />
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <Check className="w-4 h-4" />
                    ) : null}
                    {saved ? "Salvo" : "Salvar provider"}
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MktShell>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";
