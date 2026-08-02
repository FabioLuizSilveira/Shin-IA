"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X, ChevronRight } from "lucide-react";
import type { FormsConfig, FieldType } from "@shina/studio";

const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "email",
  "phone",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "file",
];

const EMPTY: FormsConfig = { forms: [] };

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function FormsStudioPage() {
  const studio = useStudioConfig<FormsConfig>("forms", EMPTY);
  const { config, setConfig } = studio;
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [showFormForm, setShowFormForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [entityType, setEntityType] = useState("");

  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");

  function addForm() {
    if (!formName.trim() || !entityType.trim()) return;
    setConfig({
      ...config,
      forms: [
        ...config.forms,
        {
          name: formName.trim(),
          entityType: entityType.trim(),
          fields: [],
          submitActions: [],
          allowDraft: false,
        },
      ],
    });
    setSelectedForm(formName.trim());
    setFormName("");
    setEntityType("");
    setShowFormForm(false);
  }

  function removeForm(name: string) {
    setConfig({ ...config, forms: config.forms.filter((f) => f.name !== name) });
    if (selectedForm === name) setSelectedForm(null);
  }

  const active = config.forms.find((f) => f.name === selectedForm);

  function addField() {
    if (!active || !fieldLabel.trim() || !fieldName.trim()) return;
    const updatedForm = {
      ...active,
      fields: [
        ...active.fields,
        {
          id: crypto.randomUUID(),
          type: fieldType,
          name: fieldName.trim(),
          label: fieldLabel.trim(),
          order: active.fields.length,
        },
      ],
    };
    setConfig({
      ...config,
      forms: config.forms.map((f) => (f.name === active.name ? updatedForm : f)),
    });
    setFieldLabel("");
    setFieldName("");
    setShowFieldForm(false);
  }

  function removeField(id: string) {
    if (!active) return;
    const updatedForm = { ...active, fields: active.fields.filter((f) => f.id !== id) };
    setConfig({
      ...config,
      forms: config.forms.map((f) => (f.name === active.name ? updatedForm : f)),
    });
  }

  return (
    <AppShell title="Formulários">
      <StudioAreaShell
        title="Formulários"
        description="Campos customizados por entidade."
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
          <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Formulários
                </p>
                <button
                  type="button"
                  onClick={() => setShowFormForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo
                </button>
              </div>

              {showFormForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                  <input
                    placeholder="Nome do formulário"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Entidade (ex: contracts)"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addForm}
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Criar
                  </button>
                </div>
              )}

              {config.forms.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum formulário ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.forms.map((form) => (
                    <li
                      key={form.name}
                      onClick={() => setSelectedForm(form.name)}
                      className={`py-2.5 flex items-center justify-between gap-2 cursor-pointer ${
                        selectedForm === form.name ? "opacity-100" : "opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {form.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {form.entityType} · {form.fields.length} campo(s)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeForm(form.name);
                        }}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              {!active ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Selecione um formulário pra editar os campos.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Campos de &quot;{active.name}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowFieldForm(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Campo
                    </button>
                  </div>

                  {showFieldForm && (
                    <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 grid grid-cols-3 gap-2">
                      <input
                        placeholder="Label"
                        value={fieldLabel}
                        onChange={(e) => setFieldLabel(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        placeholder="name"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        className={inputClass}
                      />
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value as FieldType)}
                        className={inputClass}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addField}
                        className="col-span-3 px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                      >
                        Adicionar campo
                      </button>
                    </div>
                  )}

                  {active.fields.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum campo ainda.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {active.fields.map((field) => (
                        <li key={field.id} className="py-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-slate-800 dark:text-slate-200">
                              {field.label}
                            </p>
                            <p className="text-xs text-slate-400">
                              {field.name} · {field.type}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
