// Gera CSS variables (--shina-*) a partir de um ShinaTheme (doc 09 §3/§5).

import {
  createTheme,
  spacing,
  radius,
  zIndex,
  durations,
  easing,
  type ShinaTheme,
  type ThemeMode,
  type ThemeProduct,
} from "@shina/tokens";

export function themeToCssVariables(theme: ShinaTheme): Record<string, string> {
  const vars: Record<string, string> = {
    "--shina-primary": theme.color.primary,
    "--shina-primary-hover": theme.color.primaryHover,
    "--shina-primary-pressed": theme.color.primaryPressed,
    "--shina-accent": theme.color.accent,
    "--shina-text-title": theme.color.text.title,
    "--shina-text-primary": theme.color.text.primary,
    "--shina-text-secondary": theme.color.text.secondary,
    "--shina-text-tertiary": theme.color.text.tertiary,
    "--shina-text-disabled": theme.color.text.disabled,
    "--shina-surface-background": theme.surface.background,
    "--shina-surface-deep": theme.surface.deep,
    "--shina-surface-raised": theme.surface.raised,
    "--shina-surface-glass": theme.surface.glass,
    "--shina-surface-glass-hover": theme.surface.glassHover,
    "--shina-surface-overlay": theme.surface.overlay,
    "--shina-border-subtle": theme.border.subtle,
    "--shina-border-default": theme.border.default,
    "--shina-border-strong": theme.border.strong,
    "--shina-border-focus": theme.border.focus,
    "--shina-gradient": theme.gradient.css,
    "--shina-glow": theme.glow?.css ?? "none",
    "--shina-ease-out": easing.out,
    "--shina-ease-in-out": easing.inOut,
  };

  for (const [key, value] of Object.entries(spacing)) vars[`--shina-space-${key}`] = `${value}px`;
  for (const [key, value] of Object.entries(radius)) vars[`--shina-radius-${key}`] = `${value}px`;
  for (const [key, value] of Object.entries(zIndex)) vars[`--shina-z-${key}`] = String(value);
  for (const [key, value] of Object.entries(durations))
    vars[`--shina-duration-${key}`] = `${value}ms`;

  for (const [name, tone] of Object.entries(theme.color.semantic)) {
    vars[`--shina-${name}`] = tone.base;
    vars[`--shina-${name}-bg`] = tone.bg;
    vars[`--shina-${name}-text`] = tone.text;
    vars[`--shina-${name}-border`] = tone.border;
  }

  return vars;
}

/** Folha de estilo completa: :root dark + [data-theme/product] overrides. */
export function generateCss(): string {
  const block = (selector: string, mode: ThemeMode, product: ThemeProduct) => {
    const vars = themeToCssVariables(createTheme({ mode, product }));
    const body = Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    return `${selector} {\n${body}\n}`;
  };

  return [
    block(":root", "dark", "platform"),
    block('[data-theme="light"]', "light", "platform"),
    block('[data-product="mkt"]', "dark", "mkt"),
    block('[data-theme="light"][data-product="mkt"]', "light", "mkt"),
  ].join("\n\n");
}
