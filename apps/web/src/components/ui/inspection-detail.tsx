"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Camera, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import type {
  HydratedInspectionTemplate,
  InspectionFindingStatus,
  InspectionStatus,
} from "@shina/inspection-engine";

interface InspectionRow {
  id: string;
  asset_id: string;
  type: string;
  status: InspectionStatus;
  linked_inspection_id: string | null;
  contract_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ResponseRow {
  id: string;
  item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: { value: string; label: string; severity?: string } | null;
  notes: string | null;
}

interface MediaRow {
  id: string;
  item_id: string | null;
  finding_id: string | null;
}

interface FindingRow {
  id: string;
  item_id: string | null;
  description: string;
  severity: string;
  status: InspectionFindingStatus;
  ai_suggested: boolean;
}

interface DetailPayload {
  inspection: InspectionRow;
  template: HydratedInspectionTemplate | null;
  responses: ResponseRow[];
  media: MediaRow[];
  findings: FindingRow[];
}

interface ComparisonRow {
  itemId: string;
  itemKey: string;
  beforeValue: unknown;
  afterValue: unknown;
  differs: boolean;
}

const STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando revisão",
  completed: "Concluída",
  rejected: "Reprovada",
  abandoned: "Abandonada",
};

const FINDING_STATUS_LABEL: Record<InspectionFindingStatus, string> = {
  detected: "Detectada",
  under_review: "Em revisão",
  confirmed: "Confirmada",
  rejected: "Rejeitada",
  chargeable: "Cobrável",
  waived: "Perdoada",
  resolved: "Resolvida",
};

function formatResponseValue(response: ResponseRow | undefined): string {
  if (!response) return "—";
  if (response.value_boolean !== null) return response.value_boolean ? "Sim" : "Não";
  if (response.value_number !== null) return String(response.value_number);
  if (response.value_json) return response.value_json.label;
  return response.value_text ?? "—";
}

export function InspectionDetail({
  inspectionId,
  onClose,
  onChange,
}: {
  inspectionId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comparisons, setComparisons] = useState<ComparisonRow[] | null>(null);

  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    setError(null);
    setComparisons(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`);
      const json = (await res.json()) as { data?: DetailPayload; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar vistoria.");
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(status: InspectionStatus) {
    if (!inspectionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as {
        error?: string;
        missingRequiredItems?: { itemKey: string }[];
      };
      if (!res.ok) {
        const missing = json.missingRequiredItems?.map((m) => m.itemKey).join(", ");
        throw new Error(
          missing
            ? `Itens obrigatórios faltando: ${missing}`
            : (json.error ?? "Falha ao mudar status."),
        );
      }
      await load();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function runCompare() {
    if (!inspectionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/compare`, { method: "POST" });
      const json = (await res.json()) as {
        data?: { comparisons: ComparisonRow[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Falha ao comparar.");
      setComparisons(json.data?.comparisons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewFinding(findingId: string, status: InspectionFindingStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao revisar constatação.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (!inspectionId) return null;

  const responseByItemId = new Map((data?.responses ?? []).map((r) => [r.item_id, r]));
  const mediaCountByItemId = new Map<string, number>();
  for (const m of data?.media ?? []) {
    if (!m.item_id) continue;
    mediaCountByItemId.set(m.item_id, (mediaCountByItemId.get(m.item_id) ?? 0) + 1);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Vistoria {data?.template?.name ? `— ${data.template.name}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loading && <p className="text-sm text-slate-500">Carregando...</p>}
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Timeline (item 24 do spec: Check-in -> Uso -> Check-out -> Comparação -> Laudo) */}
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                {["draft", "in_progress", "pending_review", "completed"].map((step, i) => {
                  const stepOrder = ["draft", "in_progress", "pending_review", "completed"];
                  const currentIdx = stepOrder.indexOf(data.inspection.status);
                  const reached = data.inspection.status === "rejected" ? i === 0 : i <= currentIdx;
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <span className={reached ? "text-shina-blue font-semibold" : ""}>
                        {STATUS_LABEL[step as InspectionStatus]}
                      </span>
                      {i < 3 && <ArrowRight className="w-3 h-3" />}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {data.inspection.status === "draft" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void transition("in_progress")}
                    className="px-3 py-1.5 bg-shina-blue text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                  >
                    Iniciar vistoria
                  </button>
                )}
                {data.inspection.status === "in_progress" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void transition("pending_review")}
                    className="px-3 py-1.5 bg-shina-blue text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                  >
                    Enviar para revisão
                  </button>
                )}
                {data.inspection.status === "pending_review" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("completed")}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                    >
                      Aprovar laudo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("rejected")}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                    >
                      Reprovar
                    </button>
                  </>
                )}
                {data.inspection.linked_inspection_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runCompare()}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                  >
                    Comparar com vistoria vinculada
                  </button>
                )}
              </div>

              {/* Comparison results */}
              {comparisons && (
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-3">
                    Comparação BEFORE × AFTER
                  </h3>
                  <div className="space-y-1.5">
                    {comparisons
                      .filter((c) => c.differs)
                      .map((c) => (
                        <div key={c.itemId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{c.itemKey}</span>
                          <span className="flex items-center gap-1.5 font-medium text-amber-600">
                            {JSON.stringify(c.beforeValue)} → {JSON.stringify(c.afterValue)}
                          </span>
                        </div>
                      ))}
                    {comparisons.every((c) => !c.differs) && (
                      <p className="text-xs text-slate-500">Nenhuma diferença encontrada.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Checklist */}
              {data.template && (
                <div className="space-y-4">
                  {data.template.sections.map((section) => (
                    <div key={section.id}>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
                        {section.title}
                      </h3>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-4 py-2.5 text-sm"
                          >
                            <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                            <span className="flex items-center gap-2 text-slate-900 dark:text-slate-50 font-medium">
                              {item.fieldType === "photo" || item.fieldType === "multi_photo" ? (
                                <span className="flex items-center gap-1 text-xs">
                                  <Camera className="w-3.5 h-3.5" />
                                  {mediaCountByItemId.get(item.id) ?? 0}
                                </span>
                              ) : (
                                formatResponseValue(responseByItemId.get(item.id))
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Findings */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Constatações / Avarias
                </h3>
                {data.findings.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhuma constatação registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {data.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 text-sm"
                      >
                        <div>
                          <p className="text-slate-900 dark:text-slate-50">{finding.description}</p>
                          <p className="text-xs text-slate-500">
                            {FINDING_STATUS_LABEL[finding.status]}
                            {finding.ai_suggested ? " · sugerido por IA" : ""}
                          </p>
                        </div>
                        {finding.status === "detected" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void reviewFinding(finding.id, "under_review")}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-white/5 text-xs font-medium rounded-lg border-0 cursor-pointer disabled:opacity-60"
                          >
                            Revisar
                          </button>
                        )}
                        {finding.status === "under_review" && (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void reviewFinding(finding.id, "confirmed")}
                              className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg border-0 cursor-pointer disabled:opacity-60 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void reviewFinding(finding.id, "rejected")}
                              className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-lg border-0 cursor-pointer disabled:opacity-60"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
