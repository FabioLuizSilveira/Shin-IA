// Shinã Flow — shadow and elevation scales (doc 06 §7–8)

export const shadow = {
  sm: "0 1px 2px rgba(2,6,23,0.4)",
  md: "0 4px 12px rgba(2,6,23,0.35)",
  lg: "0 12px 32px rgba(2,6,23,0.45)",
  /** restricted: apenas CTAs hero (lint da plataforma alerta fora disso) */
  glowPlatform: "0 8px 32px rgba(37,99,235,0.25)",
  glowMkt: "0 8px 32px rgba(99,102,241,0.25)",
} as const;

/** Camadas de elevação (dark: luz, não sombra) — doc 06 §7 */
export const elevation = {
  ambient: 0,
  surface: 1,
  raised: 2,
  floating: 3,
  overlay: 4,
} as const;
