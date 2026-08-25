"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Plus, Lock } from "lucide-react";
import type { InspectionFieldType, HydratedInspectionTemplate } from "@shina/inspection-engine";

interface TemplateRow {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  status: "draft" | "published" | "archived";
  isGlobal: boolean;
}

const FIELD_TYPES: InspectionFieldType[] = [
  "text",
  "textarea",
  "number",
  "boolean",
  "single_select",
  "multi_select",
  "condition",
  "odometer",
  "hour_meter",
  "percentage",
  "signature",
  "photo",
  "multi_photo",
  "video",
  "document",
];

export default function InspectionTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HydratedInspectionTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspection-templates");
      const json = (await res.json()) as { data?: TemplateRow[] };
      setTemplates(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/inspection-templates/${id}`);
    const json = (await res.json()) as { data?: HydratedInspectionTemplate };
    setDetail(json.data ?? null);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/inspection-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, name: newName }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar template.");
      setNewKey("");
      setNewName("");
      await loadList();
      if (json.data) setSelectedId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  }

  async function addSection(title: string) {
    if (!selectedId || !title.trim()) return;
    const key = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    await fetch(`/api/inspection-templates/${selectedId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, title, sortOrder: detail?.sections.length ?? 0 }),
    });
    await loadDetail(selectedId);
  }

  async function addItem(
    sectionId: string,
    label: string,
    fieldType: InspectionFieldType,
    required: boolean,
  ) {
    if (!selectedId || !label.trim()) return;
    const key = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    await fetch(`/api/inspection-templates/${selectedId}/sections/${sectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, fieldType, required, sortOrder: 0 }),
    });
    await loadDetail(selectedId);
  }

  async function publish() {
    if (!selectedId) return;
    await fetch(`/api/inspection-templates/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    await Promise.all([loadList(), loadDetail(selectedId)]);
  }

  const selectedTemplateRow = templates.find((t) => t.id === selectedId);
  const isOwnedByTenant = selectedTemplateRow && !selectedTemplateRow.isGlobal;

  return (
    <AppShell title="Templates de Vistoria">
      <SectionHeader
        title="Templates de Vistoria"
        description="Configure os checklists de vistoria por tipo de ativo — sem precisar alterar código."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <form
            onSubmit={(e) => void createTemplate(e)}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-2"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase">Novo template</p>
            <input
              required
              placeholder="Chave (ex: forklift_v2)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <input
              required
              placeholder="Nome"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-shina-blue text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" /> Criar
            </button>
          </form>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Carregando...</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between bg-transparent border-0 cursor-pointer ${
                    selectedId === t.id
                      ? "bg-shina-blue/5"
                      : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <span>
                    {t.name}
                    <span className="block text-xs text-slate-400">{t.status}</span>
                  </span>
                  {t.isGlobal && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          {!detail ? (
            <p className="text-sm text-slate-500">Selecione um template à esquerda.</p>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {detail.name}
                </h2>
                {isOwnedByTenant && detail.status !== "published" && (
                  <button
                    type="button"
                    onClick={() => void publish()}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
                  >
                    Publicar
                  </button>
                )}
              </div>

              {!isOwnedByTenant && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Template global da plataforma — somente leitura.
                </p>
              )}

              {detail.sections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1 mb-2">
                    {section.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-sm"
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-slate-400">
                          {item.fieldType}
                          {item.required ? " · obrigatório" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {isOwnedByTenant && (
                    <AddItemForm
                      onAdd={(label, fieldType, required) =>
                        void addItem(section.id, label, fieldType, required)
                      }
                    />
                  )}
                </div>
              ))}

              {isOwnedByTenant && <AddSectionForm onAdd={(title) => void addSection(title)} />}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AddSectionForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(title);
        setTitle("");
      }}
      className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700"
    >
      <input
        placeholder="Nova seção"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
      />
      <button
        type="submit"
        className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-xs font-semibold rounded-lg border-0 cursor-pointer"
      >
        Adicionar seção
      </button>
    </form>
  );
}

function AddItemForm({
  onAdd,
}: {
  onAdd: (label: string, fieldType: InspectionFieldType, required: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<InspectionFieldType>("text");
  const [required, setRequired] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(label, fieldType, required);
        setLabel("");
      }}
      className="flex flex-wrap items-center gap-2 mb-3"
    >
      <input
        placeholder="Novo item"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
      />
      <select
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value as InspectionFieldType)}
        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
      >
        {FIELD_TYPES.map((ft) => (
          <option key={ft} value={ft}>
            {ft}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-slate-500">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Obrigatório
      </label>
      <button
        type="submit"
        className="px-2.5 py-1.5 bg-shina-blue text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
      >
        + Item
      </button>
    </form>
  );
}
