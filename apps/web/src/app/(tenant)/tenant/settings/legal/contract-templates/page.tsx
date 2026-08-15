"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { FileStack, CheckCircle2, Circle, Upload } from "lucide-react";

interface Template {
  id: string;
  tenant_id: string | null;
  key: string;
  party_type: "customer" | "operator";
  name: string;
  status: string;
}

interface Clause {
  is_mandatory: boolean;
  condition: unknown;
  sort_order: number;
  tenant_contract_clauses: { key: string; category: string; title: string } | null;
}

interface Version {
  id: string;
  version: number;
  status: string;
  effective_at: string;
  content_hash: string | null;
}

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contract-templates");
      const json = (await res.json()) as { data?: Template[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar templates");
      setTemplates(json.data ?? []);
      if (json.data && json.data.length > 0 && !selectedId) setSelectedId(json.data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/contract-templates/${id}`);
    const json = (await res.json()) as {
      data?: { clauses: Clause[]; versions: Version[] };
      error?: string;
    };
    if (res.ok && json.data) {
      setClauses(json.data.clauses);
      setVersions(json.data.versions);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function handlePublish() {
    if (!selectedId) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/contract-templates/${selectedId}/publish`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao publicar versão");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setPublishing(false);
    }
  }

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <AppShell title="Templates de Contrato">
      <SectionHeader
        title="Templates de Contrato"
        description="Cláusulas mandatórias e condicionais por template (Tenant×Cliente e Tenant×Operador) e versionamento imutável — publicar cria uma nova versão, nunca altera uma já aceita."
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                  selectedId === t.id
                    ? "border-shina-blue bg-shina-blue/5"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <FileStack className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {t.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.party_type === "customer" ? "Tenant × Cliente" : "Tenant × Operador"}
                    {t.tenant_id ? " · seu template" : " · base da plataforma"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          {selected && (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Cláusulas</p>
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => void handlePublish()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-shina-blue hover:bg-blue-600 text-white cursor-pointer border-0 disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Publicar nova versão
                  </button>
                </div>
                <div className="space-y-1.5">
                  {clauses.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {c.is_mandatory ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      )}
                      <span className="text-slate-700 dark:text-slate-300">
                        {c.tenant_contract_clauses?.title ?? c.tenant_contract_clauses?.key}
                      </span>
                      {!c.is_mandatory && (
                        <span className="text-xs text-slate-400">(condicional)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Versões</p>
                <div className="space-y-1.5">
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">v{v.version}</span>
                      <span
                        className={`text-xs font-medium ${
                          v.status === "published" ? "text-green-600" : "text-slate-400"
                        }`}
                      >
                        {v.status === "published" ? "publicada" : v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
