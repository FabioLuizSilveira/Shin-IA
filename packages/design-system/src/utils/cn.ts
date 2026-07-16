// Concatena classes condicionalmente, sem dependências externas.
// Não faz merge de conflitos Tailwind (ex.: "p-2 p-4") — mantemos as
// classes do design system enxutas o suficiente para não precisar disso.

export type ClassValue = string | number | boolean | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((v) => typeof v === "string" && v.length > 0).join(" ");
}
