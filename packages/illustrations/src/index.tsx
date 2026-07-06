// @shina/illustrations — ilustrações abstratas oficiais (doc 15).
// Vocabulário: fluxo, energia, conexões, órbitas, partículas, aurora.
// Nunca: robôs, cérebros, humanos futuristas, circuitos clichê.

import type { SVGProps } from "react";
import { createTheme, type ThemeProduct } from "@shina/tokens";

export interface IllustrationProps extends SVGProps<SVGSVGElement> {
  size?: number;
  product?: ThemeProduct;
}

function useAccent(product: ThemeProduct = "platform") {
  const theme = createTheme({ product });
  return { primary: theme.color.primary, accent: theme.color.accent, gradient: theme.gradient };
}

/** Família Flow — correntes atravessando (empty states de fluxo/pipeline). */
export function FlowIllustration({ size = 96, product = "platform", ...props }: IllustrationProps) {
  const { primary, accent } = useAccent(product);
  const id = `flow-${product}`;
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 160 96" fill="none" aria-hidden {...props}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <path
        d="M0 40 C 40 10, 70 70, 110 40 S 150 20, 160 35"
        stroke={`url(#${id})`}
        strokeWidth="2"
        opacity="0.9"
      />
      <path
        d="M0 60 C 40 30, 70 90, 110 60 S 150 40, 160 55"
        stroke={accent}
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M0 78 C 40 50, 70 105, 110 78 S 150 58, 160 72"
        stroke={primary}
        strokeWidth="1"
        opacity="0.2"
      />
      <circle cx="110" cy="40" r="3" fill={accent} />
    </svg>
  );
}

/** Família Neural — constelação em repouso (empty states de IA). */
export function NeuralIllustration({
  size = 96,
  product = "platform",
  ...props
}: IllustrationProps) {
  const { accent } = useAccent(product);
  const nodes: [number, number, number][] = [
    [30, 25, 3],
    [80, 15, 4],
    [130, 30, 3],
    [55, 60, 5],
    [110, 70, 3.5],
    [20, 75, 2.5],
    [145, 65, 2.5],
  ];
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 160 96" fill="none" aria-hidden {...props}>
      <g stroke={accent} strokeWidth="0.8" opacity="0.35">
        <path d="M30 25L80 15L130 30M30 25L55 60L110 70L130 30M55 60L20 75M110 70L145 65" />
      </g>
      {nodes.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={accent} opacity={0.5 + (i % 3) * 0.18} />
      ))}
    </svg>
  );
}

/** Família Orbit — ecossistema em torno do núcleo (plataforma/marketplace). */
export function OrbitIllustration({
  size = 96,
  product = "platform",
  ...props
}: IllustrationProps) {
  const { primary, accent } = useAccent(product);
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden {...props}>
      <circle cx="80" cy="60" r="14" fill={primary} opacity="0.9" />
      <circle cx="80" cy="60" r="22" stroke={accent} strokeWidth="0.6" opacity="0.3" />
      <ellipse
        cx="80"
        cy="60"
        rx="55"
        ry="26"
        stroke={accent}
        strokeWidth="1"
        opacity="0.4"
        transform="rotate(-14 80 60)"
      />
      <ellipse
        cx="80"
        cy="60"
        rx="72"
        ry="36"
        stroke={accent}
        strokeWidth="0.7"
        opacity="0.2"
        transform="rotate(-14 80 60)"
      />
      <circle cx="128" cy="42" r="4" fill={accent} />
      <circle cx="30" cy="76" r="3" fill={accent} opacity="0.7" />
      <circle cx="105" cy="90" r="2.5" fill={primary} opacity="0.6" />
    </svg>
  );
}

/** Família Particle — campo de dados esparso (escala/empty de biblioteca). */
export function ParticlesIllustration({
  size = 96,
  product = "platform",
  ...props
}: IllustrationProps) {
  const { accent } = useAccent(product);
  const points: [number, number, number][] = [
    [12, 20, 1.5],
    [40, 12, 2],
    [70, 22, 1.2],
    [100, 10, 2.4],
    [130, 24, 1.6],
    [150, 14, 1.2],
    [22, 48, 2.2],
    [58, 44, 1.4],
    [90, 52, 2.8],
    [120, 44, 1.4],
    [146, 54, 2],
    [16, 78, 1.4],
    [48, 84, 2.4],
    [80, 76, 1.6],
    [112, 84, 1.8],
    [142, 78, 1.3],
  ];
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 160 96" fill="none" aria-hidden {...props}>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={accent} opacity={0.25 + (i % 4) * 0.15} />
      ))}
    </svg>
  );
}

/** Família Drift — nó desconectado da constelação (erros: offline, timeout, integração indisponível). */
export function DriftIllustration({
  size = 96,
  product = "platform",
  ...props
}: IllustrationProps) {
  const { primary, accent } = useAccent(product);
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 160 96" fill="none" aria-hidden {...props}>
      <g stroke={accent} strokeWidth="0.8" opacity="0.25" strokeDasharray="3 4">
        <path d="M45 30L75 45M75 45L100 28" />
      </g>
      <circle cx="45" cy="30" r="3.5" fill={accent} opacity="0.6" />
      <circle cx="100" cy="28" r="3" fill={accent} opacity="0.4" />
      <circle cx="120" cy="68" r="4.5" fill={primary} opacity="0.85" />
      <circle cx="120" cy="68" r="10" stroke={primary} strokeWidth="0.6" opacity="0.3" />
      <path
        d="M75 45L108 62"
        stroke={accent}
        strokeWidth="0.8"
        opacity="0.15"
        strokeDasharray="2 6"
      />
    </svg>
  );
}

/** Família Aurora/Mesh — manchas de luz (atmosfera, capas). */
export function AuroraIllustration({
  size = 160,
  product = "platform",
  ...props
}: IllustrationProps) {
  const { primary, accent } = useAccent(product);
  const idA = `aur-a-${product}`;
  const idB = `aur-b-${product}`;
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 160 96" fill="none" aria-hidden {...props}>
      <defs>
        <radialGradient id={idA}>
          <stop offset="0%" stopColor={primary} stopOpacity="0.35" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={idB}>
          <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="96" rx="12" fill="#020617" />
      <ellipse cx="50" cy="30" rx="60" ry="36" fill={`url(#${idA})`} />
      <ellipse cx="115" cy="70" rx="55" ry="32" fill={`url(#${idB})`} />
    </svg>
  );
}
