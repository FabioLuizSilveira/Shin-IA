// @shina/charts — primitivas de gráfico com a linguagem Shinã (doc 04 §7,
// doc 10 Charts). Sequência categórica fixa, grid sutil, sem zebra.

import type { SVGProps } from "react";
import { chartColors, border, semantic } from "@shina/tokens";

export { chartColors };

/** Cor da série n (repete a sequência além de 7 — doc 04 §7). */
export function seriesColor(index: number): string {
  return chartColors[index % chartColors.length];
}

export const chartTheme = {
  gridStroke: border.subtle,
  axisText: "#94A3B8",
  positive: semantic.success.text,
  negative: semantic.danger.text,
} as const;

export interface SparklineProps extends Omit<SVGProps<SVGSVGElement>, "values"> {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

/** Linha compacta para tendência em cards de métrica. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = chartColors[0],
  strokeWidth = 1.5,
  ...props
}: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden {...props}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MiniBarsProps extends Omit<SVGProps<SVGSVGElement>, "values"> {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  gap?: number;
  radius?: number;
}

/** Barras compactas (uso em cards e tabelas). Crescem da base. */
export function MiniBars({
  values,
  width = 96,
  height = 28,
  color = chartColors[0],
  gap = 3,
  radius = 1.5,
  ...props
}: MiniBarsProps) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden {...props}>
      {values.map((v, i) => {
        const h = Math.max((v / max) * height, 1);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={radius}
            fill={color}
            opacity={0.55 + (v / max) * 0.45}
          />
        );
      })}
    </svg>
  );
}
