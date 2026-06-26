import type { WhiteLabelTheme } from "./types.js";

export function computeCssVariables(theme: WhiteLabelTheme): Record<string, string> {
  const vars: Record<string, string> = {
    "--color-primary": theme.primaryColor,
    "--color-secondary": theme.secondaryColor,
    "--company-name": theme.companyName,
  };
  if (theme.fontFamily) {
    vars["--font-family"] = theme.fontFamily;
  }
  if (theme.logoUrl) {
    vars["--logo-url"] = theme.logoUrl;
  }
  return vars;
}

export function applyWhiteLabel(theme: WhiteLabelTheme): string {
  const vars = computeCssVariables(theme);
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

export function isWhiteLabelEnabled(theme: Partial<WhiteLabelTheme> | null | undefined): boolean {
  if (!theme) return false;
  return !!(theme.primaryColor && theme.companyName);
}

export function mergeTheme(
  base: WhiteLabelTheme,
  overrides: Partial<WhiteLabelTheme>,
): WhiteLabelTheme {
  return { ...base, ...overrides };
}
