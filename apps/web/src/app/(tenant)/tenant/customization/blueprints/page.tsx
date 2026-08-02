"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import type { BlueprintManifest } from "@shina/blueprint-runtime";

interface InstalledInstance {
  id: string;
  blueprintId: string;
  blueprintVersion: string;
  status: string;
  installedAt: string;
  manifest: BlueprintManifest | null;
}

export default function BlueprintsPage() {
  const [available, setAvailable] = useState<BlueprintManifest[]>([]);
  const [installed, setInstalled] = useState<InstalledInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [availRes, instRes] = await Promise.all([
      fetch("/api/blueprints"),
      fetch("/api/blueprints/installed"),
    ]);
    const availJson = await availRes.json();
    const instJson = await instRes.json();
    setAvailable(availJson.data ?? []);
    setInstalled(instJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const installedIds = new Set(installed.map((i) => i.blueprintId));

  async function install(blueprintId: string) {
    setBusyId(blueprintId);
    setError(null);
    const res = await fetch("/api/blueprints/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, config: {} }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Falha ao instalar");
    } else {
      await load();
    }
    setBusyId(null);
  }

  async function uninstall(blueprintId: string) {
    setBusyId(blueprintId);
    setError(null);
    const res = await fetch(`/api/blueprints/${blueprintId}/uninstall`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Falha ao desinstalar");
    } else {
      await load();
    }
    setBusyId(null);
  }

  return (
    <AppShell title="Blueprints">
      <Link
        href="/tenant/customization"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Customização
      </Link>

      <SectionHeader
        title="Blueprints"
        description="Templates prontos de tipo de ativo. Instalar cria um tipo de ativo com os campos do template."
      />

      {error && (
        <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {available.map((bp) => {
            const isInstalled = installedIds.has(bp.id);
            const isBusy = busyId === bp.id;
            return (
              <div
                key={bp.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {bp.displayName}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {isInstalled && (
                      <span className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400">
                        <Check className="w-3 h-3" /> Instalado
                      </span>
                    )}
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {bp.category}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{bp.description}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {bp.customFields.length} campo{bp.customFields.length === 1 ? "" : "s"} (
                  {bp.customFields
                    .filter((f) => f.required)
                    .map((f) => f.label)
                    .join(", ") || "nenhum obrigatório"}
                  )
                </p>

                {isInstalled ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => uninstall(bp.id)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 rounded-lg border-0 cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" /> Desinstalar
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => install(bp.id)}
                    className="mt-3 w-full px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? "Instalando..." : "Instalar"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
