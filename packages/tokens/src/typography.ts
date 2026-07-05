// Shinã Flow — type scale (doc 05). 16 estilos nomeados.

export const fontFamily = {
  sans: ["Inter", "system-ui", "sans-serif"],
  display: ["Manrope", "Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "monospace"],
} as const;

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: number;
  /** tracking em em (ex.: -0.02 = -2%) */
  tracking: number;
  family: keyof typeof fontFamily;
  /** overrides responsivos (px) */
  responsive?: { md?: number; sm?: number };
  uppercase?: boolean;
}

export const typography = {
  displayXXL: {
    size: 72,
    lineHeight: 1.05,
    weight: 900,
    tracking: -0.02,
    family: "display",
    responsive: { md: 56, sm: 40 },
  },
  displayXL: {
    size: 60,
    lineHeight: 1.05,
    weight: 900,
    tracking: -0.02,
    family: "display",
    responsive: { md: 48, sm: 36 },
  },
  display: {
    size: 48,
    lineHeight: 1.1,
    weight: 800,
    tracking: -0.015,
    family: "display",
    responsive: { md: 40, sm: 32 },
  },
  h1: {
    size: 36,
    lineHeight: 1.15,
    weight: 800,
    tracking: -0.01,
    family: "display",
    responsive: { md: 30, sm: 26 },
  },
  h2: {
    size: 30,
    lineHeight: 1.2,
    weight: 700,
    tracking: -0.01,
    family: "display",
    responsive: { md: 26, sm: 22 },
  },
  h3: {
    size: 24,
    lineHeight: 1.25,
    weight: 700,
    tracking: -0.005,
    family: "display",
    responsive: { md: 22, sm: 20 },
  },
  h4: { size: 20, lineHeight: 1.3, weight: 600, tracking: -0.005, family: "display" },
  h5: { size: 16, lineHeight: 1.4, weight: 600, tracking: 0, family: "sans" },
  bodyLarge: { size: 18, lineHeight: 1.6, weight: 400, tracking: 0, family: "sans" },
  body: { size: 14, lineHeight: 1.55, weight: 400, tracking: 0, family: "sans" },
  small: { size: 12, lineHeight: 1.45, weight: 400, tracking: 0, family: "sans" },
  caption: { size: 11, lineHeight: 1.4, weight: 500, tracking: 0.01, family: "sans" },
  label: { size: 12, lineHeight: 1.2, weight: 500, tracking: 0.01, family: "sans" },
  button: { size: 14, lineHeight: 1, weight: 600, tracking: 0, family: "sans" },
  overline: {
    size: 11,
    lineHeight: 1.2,
    weight: 700,
    tracking: 0.08,
    family: "sans",
    uppercase: true,
  },
  code: { size: 13, lineHeight: 1.5, weight: 400, tracking: 0, family: "mono" },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;
