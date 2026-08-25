"use client";

import { useRef, useState } from "react";

export interface OverlayRegion {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

// InspectionOverlayPicker — item 11 of the spec. Click/drag a rectangle
// over the photo; coordinates are normalized (0..1) relative to the
// image's own box, so the marking stays correct at any display
// resolution (the spec's own worked example). Polygon support is
// explicitly deferred (item 11: "preferencialmente suportar polígono
// posteriormente") — rectangle only, on purpose.
export function InspectionOverlayPicker({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (region: OverlayRegion | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [region, setRegion] = useState<OverlayRegion | null>(null);

  function toNormalized(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragStart(toNormalized(e.clientX, e.clientY));
    setRegion(null);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart) return;
    const cur = toNormalized(e.clientX, e.clientY);
    const next: OverlayRegion = {
      type: "rectangle",
      x: Math.min(dragStart.x, cur.x),
      y: Math.min(dragStart.y, cur.y),
      width: Math.abs(cur.x - dragStart.x),
      height: Math.abs(cur.y - dragStart.y),
    };
    setRegion(next);
  }

  function handlePointerUp() {
    setDragStart(null);
    if (region && region.width > 0.01 && region.height > 0.01) {
      onChange(region);
    } else {
      setRegion(null);
      onChange(null);
    }
  }

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="relative w-full max-w-sm aspect-[4/3] rounded-lg overflow-hidden cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Foto da vistoria"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {region && (
          <div
            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          />
        )}
      </div>
      <p className="text-[10px] text-slate-400">
        Arraste sobre a foto para marcar a região da avaria.
      </p>
    </div>
  );
}
