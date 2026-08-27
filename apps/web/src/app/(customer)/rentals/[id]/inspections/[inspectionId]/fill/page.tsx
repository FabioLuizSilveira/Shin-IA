"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, CheckCircle2 } from "lucide-react";

interface TemplateItem {
  id: string;
  label: string;
  instructions: string | null;
  field_type: string;
  required: boolean;
  min_photos: number | null;
  select_options: { value: string; label: string; severity?: string }[] | null;
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
  value_json: { value: string; label: string } | null;
}
interface MediaItem {
  id: string;
  item_id: string | null;
}
interface FillData {
  inspection: { id: string; status: string };
  template: { sections: TemplateSection[] } | null;
  responses: ResponseItem[];
  media: MediaItem[];
  canFill: boolean;
}

const PHOTO_TYPES = new Set(["photo", "multi_photo"]);
const NUMERIC_TYPES = new Set(["number", "odometer", "hour_meter", "percentage"]);

// Self-service checklist fill — the web equivalent of
// InspectionCaptureScreen (mobile), reusing the same server-side
// contract (upsert-by-item, checksum-deduped media uploads,
// checkTemplateCompletion gate). One scrolling form rather than a
// step wizard: on web, scanning a full checklist at once is normal
// UX (the mobile 1-item-at-a-time flow exists because a phone screen
// can't fit a full checklist comfortably, a desktop/tablet browser
// can).
export default function RentalInspectionFillPage() {
  const params = useParams<{ id: string; inspectionId: string }>();
  const router = useRouter();
  const { id: contractId, inspectionId } = params;

  const [data, setData] = useState<FillData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missingItemIds, setMissingItemIds] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    return fetch(`/api/mobile/customer/inspections/${inspectionId}`)
      .then((r) => r.json())
      .then((j: { data: FillData }) => setData(j.data))
      .catch((err: Error) => setError(err.message));
  }, [inspectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.inspection.status === "draft" && !started) {
      setStarted(true);
      void fetch(`/api/mobile/customer/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      }).then(() => load());
    }
  }, [data, started, inspectionId, load]);

  async function saveResponse(itemId: string, value: Record<string, unknown>) {
    setSavingItemId(itemId);
    try {
      await fetch(`/api/mobile/customer/inspections/${inspectionId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      await load();
    } finally {
      setSavingItemId(null);
    }
  }

  async function uploadPhoto(itemId: string, file: File) {
    setSavingItemId(itemId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("itemId", itemId);
      await fetch(`/api/mobile/customer/inspections/${inspectionId}/media`, {
        method: "POST",
        body: form,
      });
      await load();
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    setMissingItemIds(new Set());
    try {
      const res = await fetch(`/api/mobile/customer/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_review" }),
      });
      const json = (await res.json()) as {
        error?: string;
        missingRequiredItems?: { itemId: string }[];
        photoCountViolations?: { itemId: string }[];
      };
      if (!res.ok) {
        const ids = new Set([
          ...(json.missingRequiredItems ?? []).map((m) => m.itemId),
          ...(json.photoCountViolations ?? []).map((m) => m.itemId),
        ]);
        setMissingItemIds(ids);
        throw new Error(
          ids.size > 0
            ? "Alguns itens obrigatórios ainda estão faltando — veja abaixo."
            : (json.error ?? "Falha ao enviar vistoria."),
        );
      }
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao enviar vistoria.");
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

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-lg font-bold text-slate-900 dark:text-white">Vistoria enviada</p>
        <p className="text-sm text-slate-500 max-w-xs">
          Sua vistoria foi registrada e o aceite foi gravado automaticamente, já que você mesmo a
          preencheu.
        </p>
        <button
          onClick={() => router.push(`/rentals/${contractId}/inspections`)}
          className="px-4 py-2.5 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
        >
          Voltar às vistorias
        </button>
      </div>
    );
  }

  if (!data.canFill) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <p className="text-sm text-slate-500">
          Esta vistoria não está disponível para preenchimento.
        </p>
        <button
          onClick={() => router.push(`/rentals/${contractId}/inspections/${inspectionId}`)}
          className="text-sm text-shina-blue font-semibold cursor-pointer border-0 bg-transparent"
        >
          Ver vistoria
        </button>
      </div>
    );
  }

  const responseByItem = new Map(data.responses.map((r) => [r.item_id, r]));
  const mediaCountByItem = new Map<string, number>();
  for (const m of data.media) {
    if (m.item_id) mediaCountByItem.set(m.item_id, (mediaCountByItem.get(m.item_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${contractId}/inspections`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Preencher vistoria</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {(data.template?.sections ?? []).map((section) => (
          <div
            key={section.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4"
          >
            <p className="text-sm font-bold text-slate-900 dark:text-white">{section.title}</p>
            {section.items.map((item) => {
              const response = responseByItem.get(item.id);
              const mediaCount = mediaCountByItem.get(item.id) ?? 0;
              const isMissing = missingItemIds.has(item.id);
              const saving = savingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0 ${isMissing ? "ring-1 ring-red-300 rounded-lg p-2" : ""}`}
                >
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {item.label}
                    {item.required && <span className="text-red-500"> *</span>}
                  </p>
                  {item.instructions && (
                    <p className="text-xs text-slate-400">{item.instructions}</p>
                  )}

                  {PHOTO_TYPES.has(item.field_type) ? (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        Adicionar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPhoto(item.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <span className="text-xs text-slate-500">
                        {mediaCount} / {item.min_photos || (item.required ? 1 : 0)} foto
                        {item.min_photos === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : item.field_type === "boolean" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveResponse(item.id, { valueBoolean: true })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${response?.value_boolean === true ? "bg-shina-blue text-white border-shina-blue" : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => void saveResponse(item.id, { valueBoolean: false })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${response?.value_boolean === false ? "bg-shina-blue text-white border-shina-blue" : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                      >
                        Não
                      </button>
                    </div>
                  ) : item.field_type === "single_select" || item.field_type === "condition" ? (
                    <div className="flex flex-wrap gap-2">
                      {(item.select_options ?? []).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => void saveResponse(item.id, { valueJson: opt })}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${response?.value_json?.value === opt.value ? "bg-shina-blue text-white border-shina-blue" : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={NUMERIC_TYPES.has(item.field_type) ? "number" : "text"}
                      defaultValue={
                        NUMERIC_TYPES.has(item.field_type)
                          ? (response?.value_number ?? "")
                          : (response?.value_text ?? "")
                      }
                      onBlur={(e) =>
                        void saveResponse(
                          item.id,
                          NUMERIC_TYPES.has(item.field_type)
                            ? { valueNumber: Number(e.target.value) || 0 }
                            : { valueText: e.target.value },
                        )
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-xl mx-auto space-y-2">
          {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
          <button
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="w-full px-4 py-3 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Enviar vistoria"}
          </button>
        </div>
      </div>
    </div>
  );
}
