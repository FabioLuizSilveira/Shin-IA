"use client";

import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";

// InspectionComparisonViewer — item 13 of the spec. Side-by-side always
// works; the slider mode only activates once both images are loaded
// (no layout jump while signed URLs resolve). Matching is done by the
// caller via template_item_id (never upload order — item 14 of the
// spec) — this component only ever renders whatever pair it's handed.
export interface ComparisonMediaRef {
  inspectionId: string;
  mediaId: string;
}

export function InspectionComparisonViewer({
  itemLabel,
  before,
  after,
  differs,
}: {
  itemLabel: string;
  before: ComparisonMediaRef | null;
  after: ComparisonMediaRef | null;
  differs: boolean;
}) {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [sliderPos, setSliderPos] = useState(50);

  useEffect(() => {
    if (before) {
      fetch(`/api/inspections/${before.inspectionId}/media/${before.mediaId}/url`)
        .then((r) => r.json())
        .then((j: { data?: { url: string } }) => setBeforeUrl(j.data?.url ?? null))
        .catch(() => setBeforeUrl(null));
    }
    if (after) {
      fetch(`/api/inspections/${after.inspectionId}/media/${after.mediaId}/url`)
        .then((r) => r.json())
        .then((j: { data?: { url: string } }) => setAfterUrl(j.data?.url ?? null))
        .catch(() => setAfterUrl(null));
    }
  }, [before, after]);

  if (!before && !after) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {itemLabel} {differs && <span className="text-amber-600">— divergente</span>}
        </p>
        {beforeUrl && afterUrl && (
          <div className="flex gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setMode("side")}
              className={`px-2 py-0.5 rounded border-0 cursor-pointer ${mode === "side" ? "bg-shina-blue text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"}`}
            >
              Lado a lado
            </button>
            <button
              type="button"
              onClick={() => setMode("slider")}
              className={`px-2 py-0.5 rounded border-0 cursor-pointer ${mode === "slider" ? "bg-shina-blue text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"}`}
            >
              Slider
            </button>
          </div>
        )}
      </div>

      {mode === "side" || !beforeUrl || !afterUrl ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-slate-400 mb-1">ANTES</p>
            {beforeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeUrl} alt="Antes" className="w-full h-32 object-cover rounded-lg" />
            ) : (
              <div className="w-full h-32 rounded-lg bg-slate-100 dark:bg-white/5" />
            )}
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-1">DEPOIS</p>
            {afterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={afterUrl} alt="Depois" className="w-full h-32 object-cover rounded-lg" />
            ) : (
              <div className="w-full h-32 rounded-lg bg-slate-100 dark:bg-white/5" />
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative w-full h-56 rounded-lg overflow-hidden select-none"
          onMouseMove={(e) => {
            if (e.buttons !== 1) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setSliderPos(Math.min(100, Math.max(0, pct)));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt="Depois"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* clip-path (not a width-clipped wrapper) keeps this image at
              the container's full intrinsic size, so object-cover crops
              identically to the "after" image underneath — a wrapper
              sized to sliderPos% would instead re-crop the image to a
              narrower box. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeUrl}
            alt="Antes"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow cursor-ew-resize flex items-center justify-center"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center -ml-2.5">
              <GripVertical className="w-3 h-3 text-slate-500" />
            </div>
          </div>
          <span className="absolute top-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">
            ANTES
          </span>
          <span className="absolute top-1 right-1 text-[9px] bg-black/50 text-white px-1 rounded">
            DEPOIS
          </span>
        </div>
      )}
    </div>
  );
}
