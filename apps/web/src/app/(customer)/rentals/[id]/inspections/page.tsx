"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ClipboardCheck, Plus } from "lucide-react";

interface InspectionListItem {
  id: string;
  type: string;
  status: string;
  created_at: string;
}

interface InspectionAsset {
  id: string;
  name: string;
  category: string | null;
}

interface InspectionConfig {
  enabled: boolean;
  assets: InspectionAsset[];
}

const TYPE_LABEL: Record<string, string> = {
  pre_delivery: "Pré-entrega",
  check_in: "Check-in",
  check_out: "Check-out",
  return: "Retorno",
  periodic: "Periódica",
  maintenance: "Manutenção",
  damage: "Avaria",
  custom: "Personalizada",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho — continue preenchendo",
  in_progress: "Em andamento — continue preenchendo",
  pending_review: "Aguardando sua revisão",
  completed: "Concluída",
  rejected: "Reprovada",
  abandoned: "Abandonada",
};

const FILLABLE_STATUSES = new Set(["draft", "in_progress"]);

// Customer-side entry point for item 3 of the spec (P0), extended with
// self-service creation (per-tenant opt-in, tenants.customer_
// self_inspection_enabled). Inspections are fetched scoped by
// contractId + the customer's own customer_id (server-enforced, never
// trusted from this page).
export default function RentalInspectionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contractId = params.id;

  const [inspections, setInspections] = useState<InspectionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<InspectionConfig | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");
  const [newType, setNewType] = useState<"check_in" | "check_out">("check_in");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/mobile/customer/inspections?contractId=${contractId}`)
      .then((r) => r.json())
      .then((j: { data: InspectionListItem[] }) => setInspections(j.data ?? []))
      .catch((err: Error) => setError(err.message));
  }, [contractId]);

  useEffect(() => {
    load();
    fetch(`/api/mobile/customer/contracts/${contractId}/inspection-config`)
      .then((r) => r.json())
      .then((j: { data?: InspectionConfig }) => {
        setConfig(j.data ?? { enabled: false, assets: [] });
        if (j.data?.assets?.[0]) setNewAssetId(j.data.assets[0].id);
      })
      .catch(() => setConfig({ enabled: false, assets: [] }));
  }, [contractId, load]);

  async function handleCreate() {
    if (!newAssetId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/mobile/customer/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          assetId: newAssetId,
          type: newType,
          purpose: newType,
        }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao iniciar vistoria.");
      if (json.data?.id) {
        router.push(`/rentals/${contractId}/inspections/${json.data.id}/fill`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar vistoria.");
    } finally {
      setCreating(false);
    }
  }

  function openInspection(insp: InspectionListItem) {
    if (FILLABLE_STATUSES.has(insp.status)) {
      router.push(`/rentals/${contractId}/inspections/${insp.id}/fill`);
    } else {
      router.push(`/rentals/${contractId}/inspections/${insp.id}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${contractId}`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Vistorias</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-3">
        {config?.enabled && config.assets.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            {!showNewForm ? (
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Iniciar vistoria
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Nova vistoria
                </p>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ativo</label>
                  <select
                    value={newAssetId}
                    onChange={(e) => setNewAssetId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {config.assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewType("check_in")}
                      className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border cursor-pointer ${newType === "check_in" ? "bg-shina-blue text-white border-shina-blue" : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                    >
                      Check-in
                    </button>
                    <button
                      onClick={() => setNewType("check_out")}
                      className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border cursor-pointer ${newType === "check_out" ? "bg-shina-blue text-white border-shina-blue" : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                    >
                      Check-out
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={creating || !newAssetId}
                    onClick={() => void handleCreate()}
                    className="flex-1 px-4 py-2.5 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer disabled:opacity-60"
                  >
                    {creating ? "Iniciando…" : "Começar"}
                  </button>
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl border-0 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {inspections === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : inspections.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            Nenhuma vistoria disponível para este contrato.
          </p>
        ) : (
          inspections.map((insp) => (
            <button
              key={insp.id}
              onClick={() => openInspection(insp)}
              className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 cursor-pointer"
            >
              <ClipboardCheck className="w-5 h-5 text-shina-blue shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {TYPE_LABEL[insp.type] ?? insp.type}
                </p>
                <p className="text-xs text-slate-500">
                  {STATUS_LABEL[insp.status] ?? insp.status} ·{" "}
                  {new Date(insp.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
