"use client";

// Loaders contextuais (Wave 4 SUPERNOVA / doc 14). Cada superfície tem um
// loader com a MESMA silhueta do conteúdo real — nunca um spinner genérico.

import { Skeleton } from "./loaders";

export interface MetricLoaderProps {
  className?: string;
}

/** Silhueta de um MetricCard: rótulo curto + número grande. */
export function MetricLoader({ className }: MetricLoaderProps) {
  return (
    <div data-shina-flow="metric-loader" className={className}>
      <Skeleton width={80} height={12} className="mb-3" />
      <Skeleton width={120} height={28} rounded="sm" />
    </div>
  );
}

export interface ChartLoaderProps {
  bars?: number;
  className?: string;
}

/** Silhueta de um gráfico de barras/linhas — alturas variando, nunca reto. */
export function ChartLoader({ bars = 7, className }: ChartLoaderProps) {
  const heights = Array.from({ length: bars }, (_, i) => 30 + ((i * 37) % 60));
  return (
    <div
      data-shina-flow="chart-loader"
      className={className}
      style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96 }}
    >
      {heights.map((h, i) => (
        <Skeleton key={i} width="100%" height={h} rounded="sm" />
      ))}
    </div>
  );
}

export interface WorkspaceLoaderProps {
  rows?: number;
  className?: string;
}

/** Silhueta de sidebar + conteúdo (telas de workspace/dashboard). */
export function WorkspaceLoader({ rows = 4, className }: WorkspaceLoaderProps) {
  return (
    <div
      data-shina-flow="workspace-loader"
      className={className}
      style={{ display: "flex", gap: 24 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 180 }}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} height={32} rounded="md" />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={140} rounded="lg" />
        <Skeleton height={140} rounded="lg" />
      </div>
    </div>
  );
}

export interface GalleryLoaderProps {
  items?: number;
  className?: string;
}

/** Silhueta de grid de criativos/imagens (Ad Library, Studio, Marketplace). */
export function GalleryLoader({ items = 6, className }: GalleryLoaderProps) {
  return (
    <div
      data-shina-flow="gallery-loader"
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: items }, (_, i) => (
        <div key={i}>
          <Skeleton height={140} rounded="lg" className="mb-2" />
          <Skeleton width="70%" height={12} />
        </div>
      ))}
    </div>
  );
}

export interface MarketplaceLoaderProps {
  cards?: number;
  className?: string;
}

/** Silhueta de cards de marketplace/agentes: ícone + título + descrição + cta. */
export function MarketplaceLoader({ cards = 3, className }: MarketplaceLoaderProps) {
  return (
    <div
      data-shina-flow="marketplace-loader"
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton width={40} height={40} rounded="lg" />
          <Skeleton width="60%" height={14} />
          <Skeleton width="90%" height={11} />
          <Skeleton width="90%" height={11} />
          <Skeleton width={100} height={32} rounded="md" className="mt-1" />
        </div>
      ))}
    </div>
  );
}

export interface BackgroundLoaderProps {
  className?: string;
}

/** Silhueta de tela cheia (primeiro carregamento de uma rota completa). */
export function BackgroundLoader({ className }: BackgroundLoaderProps) {
  return (
    <div
      data-shina-flow="background-loader"
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <Skeleton width={220} height={20} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={80} rounded="lg" />
        ))}
      </div>
      <Skeleton height={220} rounded="lg" />
    </div>
  );
}
