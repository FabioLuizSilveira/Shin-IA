"use client";

import { useCallback, useEffect, useState } from "react";
import { MktShell } from "@/components/layout/mkt-shell";
import { Palette, Plus, Trash2, Star, Loader2, Pencil, X } from "lucide-react";

interface BrandColor {
  name: string;
  hex: string;
  role: string;
}

interface BrandKit {
  id: string;
  name: string;
  logo_url: string | null;
  palette: BrandColor[];
  fonts: { heading?: string; body?: string };
  tone_of_voice: string | null;
  tagline: string | null;
  description: string | null;
  website_url: string | null;
  is_default: boolean;
}

const EMPTY_FORM = {
  name: "",
  logo_url: "",
  tagline: "",
  description: "",
  website_url: "",
  tone_of_voice: "",
  heading_font: "",
  body_font: "",
  colors: [{ name: "Primária", hex: "#6366F1", role: "primary" }] as BrandColor[],
};

export default function BrandKitPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brand-kits");
      const json = (await res.json()) as { data?: BrandKit[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar brand kits");
      setKits(json.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(kit: BrandKit) {
    setEditingId(kit.id);
    setForm({
      name: kit.name,
      logo_url: kit.logo_url ?? "",
      tagline: kit.tagline ?? "",
      description: kit.description ?? "",
      website_url: kit.website_url ?? "",
      tone_of_voice: kit.tone_of_voice ?? "",
      heading_font: kit.fonts?.heading ?? "",
      body_font: kit.fonts?.body ?? "",
      colors: kit.palette?.length ? kit.palette : EMPTY_FORM.colors,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      logo_url: form.logo_url || undefined,
      tagline: form.tagline || undefined,
      description: form.description || undefined,
      website_url: form.website_url || undefined,
      tone_of_voice: form.tone_of_voice || undefined,
      fonts: { heading: form.heading_font || undefined, body: form.body_font || undefined },
      palette: form.colors.filter((c) => c.hex),
    };
    try {
      const res = await fetch(editingId ? `/api/brand-kits/${editingId}` : "/api/brand-kits", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este brand kit?")) return;
    await fetch(`/api/brand-kits/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/brand-kits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    await load();
  }

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setForm((f) => ({
      ...f,
      colors: f.colors.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  return (
    <MktShell title="Brand Kit">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A IA usa os dados da marca em todas as gerações de anúncios e copies.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors border-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova marca
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : kits.length === 0 && !showForm ? (
          <div className="card-glass rounded-2xl p-10 text-center">
            <Palette className="w-8 h-8 text-mkt-glow mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma marca cadastrada. Crie o primeiro brand kit para habilitar as gerações com IA.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {kits.map((kit) => (
              <div key={kit.id} className="card-glass rounded-2xl p-5 flex items-center gap-4">
                <div className="flex gap-1 shrink-0">
                  {(kit.palette ?? []).slice(0, 4).map((c, i) => (
                    <span
                      key={i}
                      className="w-6 h-6 rounded-full border border-slate-200 dark:border-white/10"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {kit.name}
                    </h3>
                    {kit.is_default && (
                      <span className="px-2 py-0.5 bg-mkt-primary/15 text-mkt-glow text-[10px] font-semibold rounded-full">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {kit.tagline ?? kit.website_url ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!kit.is_default && (
                    <button
                      type="button"
                      title="Definir como padrão"
                      onClick={() => void handleSetDefault(kit.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/5 transition bg-transparent border-0 cursor-pointer"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => startEdit(kit)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition bg-transparent border-0 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Excluir"
                    onClick={() => void handleDelete(kit.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 transition bg-transparent border-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={(e) => void handleSave(e)} className="card-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingId ? "Editar marca" : "Nova marca"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white bg-transparent border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome da marca *">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                  placeholder="Minha Empresa"
                />
              </Field>
              <Field label="Site">
                <input
                  value={form.website_url}
                  onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  className={inputCls}
                  placeholder="https://minhaempresa.com.br"
                />
              </Field>
              <Field label="URL do logo">
                <input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className={inputCls}
                  placeholder="https://.../logo.png"
                />
              </Field>
              <Field label="Tagline">
                <input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className={inputCls}
                  placeholder="Slogan da marca"
                />
              </Field>
              <Field label="Fonte de títulos">
                <input
                  value={form.heading_font}
                  onChange={(e) => setForm({ ...form, heading_font: e.target.value })}
                  className={inputCls}
                  placeholder="Manrope"
                />
              </Field>
              <Field label="Fonte de corpo">
                <input
                  value={form.body_font}
                  onChange={(e) => setForm({ ...form, body_font: e.target.value })}
                  className={inputCls}
                  placeholder="Inter"
                />
              </Field>
            </div>

            <Field label="Descrição do negócio" className="mt-4">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls}
                placeholder="O que a empresa faz, para quem, diferenciais..."
              />
            </Field>

            <Field label="Tom de voz" className="mt-4">
              <textarea
                rows={2}
                value={form.tone_of_voice}
                onChange={(e) => setForm({ ...form, tone_of_voice: e.target.value })}
                className={inputCls}
                placeholder="Ex: profissional mas acessível, direto, sem jargões..."
              />
            </Field>

            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Paleta de cores
              </p>
              <div className="space-y-2">
                {form.colors.map((color, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(e) => updateColor(i, { hex: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      value={color.name}
                      onChange={(e) => updateColor(i, { name: e.target.value })}
                      className={`${inputCls} flex-1`}
                      placeholder="Nome da cor"
                    />
                    <select
                      value={color.role}
                      onChange={(e) => updateColor(i, { role: e.target.value })}
                      className={`${inputCls} w-36`}
                    >
                      <option value="primary">Primária</option>
                      <option value="secondary">Secundária</option>
                      <option value="accent">Acento</option>
                      <option value="background">Fundo</option>
                      <option value="text">Texto</option>
                    </select>
                    {form.colors.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, colors: f.colors.filter((_, j) => j !== i) }))
                        }
                        className="p-2 text-slate-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    colors: [...f.colors, { name: "", hex: "#8B5CF6", role: "secondary" }],
                  }))
                }
                className="mt-2 text-xs text-mkt-glow hover:text-slate-900 dark:hover:text-white transition bg-transparent border-0 cursor-pointer"
              >
                + Adicionar cor
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition bg-transparent border-0 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition border-0 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Salvar alterações" : "Criar marca"}
              </button>
            </div>
          </form>
        )}
      </div>
    </MktShell>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 transition";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
