"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface TemplateItem {
  id: string;
  label: string;
  field_type: string;
}
interface TemplateSection {
  id: string;
  title: string;
  items: TemplateItem[];
}
interface ResponseItem {
  item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: { label?: string } | null;
  notes: string | null;
}
interface MediaItem {
  id: string;
  item_id: string | null;
}
interface FindingItem {
  id: string;
  item_id: string | null;
  description: string;
  severity: string;
  status: string;
}
interface DisputeItem {
  id: string;
  item_id: string | null;
  description: string;
  status: string;
  created_at: string;
}
interface InspectionDetailData {
  inspection: { id: string; status: string; type: string };
  template: { sections: TemplateSection[] } | null;
  responses: ResponseItem[];
  media: MediaItem[];
  findings: FindingItem[];
  disputes: DisputeItem[];
  acceptance: { id: string; signed_at: string } | null;
  canReview: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando sua revisão",
  completed: "Concluída",
  rejected: "Reprovada",
};

function formatValue(r: ResponseItem | undefined): string {
  if (!r) return "—";
  if (r.value_json?.label) return r.value_json.label;
  if (r.value_boolean !== null && r.value_boolean !== undefined)
    return r.value_boolean ? "Sim" : "Não";
  if (r.value_number !== null && r.value_number !== undefined) return String(r.value_number);
  return r.value_text ?? "—";
}

// Customer-facing acceptance + dispute flow (items 4 and 5 of the spec).
// Every write goes through /api/mobile/customer/inspections/* —
// requireMobileContext()-authenticated, never a staff session standing in.
export default function RentalInspectionDetailPage() {
  const params = useParams<{ id: string; inspectionId: string }>();
  const router = useRouter();
  const { id: contractId, inspectionId } = params;

  const [data, setData] = useState<InspectionDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disputeOpenFor, setDisputeOpenFor] = useState<string | null>(null);
  const [disputeText, setDisputeText] = useState("");

  const load = useCallback(() => {
    fetch(`/api/mobile/customer/inspections/${inspectionId}`)
      .then((r) => r.json())
      .then((j: { data: InspectionDetailData }) => setData(j.data))
      .catch((err: Error) => setError(err.message));
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/mobile/customer/inspections/${inspectionId}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao registrar aceite.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar aceite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispute(itemId: string | null) {
    if (!disputeText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/mobile/customer/inspections/${inspectionId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: itemId === "__general__" ? null : itemId,
          description: disputeText.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao registrar divergência.");
      setDisputeText("");
      setDisputeOpenFor(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar divergência.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        )}
      </div>
    );
  }

  const responseByItem = new Map(data.responses.map((r) => [r.item_id, r]));
  const mediaCountByItem = new Map<string, number>();
  for (const m of data.media) {
    if (m.item_id) mediaCountByItem.set(m.item_id, (mediaCountByItem.get(m.item_id) ?? 0) + 1);
  }
  const disputedItemIds = new Set(data.disputes.map((d) => d.item_id).filter(Boolean));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${contractId}/inspections`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Vistoria</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {STATUS_LABEL[data.inspection.status] ?? data.inspection.status}
          </p>
        </div>

        {!data.canReview && (
          <p className="text-sm text-slate-500 py-6 text-center">
            Esta vistoria ainda não está disponível para revisão.
          </p>
        )}

        {data.canReview &&
          (data.template?.sections ?? []).map((section) => (
            <div
              key={section.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">{section.title}</p>
              {section.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {formatValue(responseByItem.get(item.id))}
                      {mediaCountByItem.get(item.id)
                        ? ` · ${mediaCountByItem.get(item.id)} foto(s)`
                        : ""}
                    </p>
                    {disputedItemIds.has(item.id) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Contestado
                      </p>
                    )}
                  </div>
                  {data.inspection.status === "pending_review" && !data.acceptance && (
                    <button
                      onClick={() => setDisputeOpenFor(item.id)}
                      className="shrink-0 text-xs text-amber-600 dark:text-amber-400 border-0 bg-transparent cursor-pointer"
                    >
                      Contestar
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

        {data.findings.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Avarias constatadas</p>
            {data.findings.map((f) => (
              <p key={f.id} className="text-sm text-slate-700 dark:text-slate-300">
                {f.description} — <span className="text-xs text-slate-500">{f.severity}</span>
              </p>
            ))}
          </div>
        )}

        {disputeOpenFor && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Descreva a divergência
            </p>
            <textarea
              value={disputeText}
              onChange={(e) => setDisputeText(e.target.value)}
              rows={3}
              placeholder="Ex.: Este risco já estava presente quando recebi o veículo."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-sm text-slate-900 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                disabled={submitting || !disputeText.trim()}
                onClick={() => void handleDispute(disputeOpenFor)}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer disabled:opacity-60"
              >
                Enviar
              </button>
              <button
                onClick={() => {
                  setDisputeOpenFor(null);
                  setDisputeText("");
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {data.canReview && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            {data.acceptance ? (
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Vistoria aceita em{" "}
                {new Date(data.acceptance.signed_at).toLocaleString("pt-BR")}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Revise os itens acima. Você pode contestar um item específico ou concordar com a
                  vistoria como um todo.
                </p>
                <button
                  disabled={submitting}
                  onClick={() => void handleAccept()}
                  className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer disabled:opacity-60"
                >
                  Concordo com a vistoria
                </button>
                <button
                  disabled={submitting}
                  onClick={() => setDisputeOpenFor("__general__")}
                  className="w-full px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm font-semibold rounded-xl border border-amber-200 dark:border-amber-900 cursor-pointer"
                >
                  Não concordo com esta vistoria
                </button>
              </>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
