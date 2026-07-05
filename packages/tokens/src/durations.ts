// Shinã Flow — durations em ms (doc 11 §3)

export const durations = {
  instant: 100,
  fast: 150,
  base: 250,
  slow: 400,
  /** loops ambientes: faixa 3000–8000 */
  ambient: 6000,
} as const;

export type DurationToken = keyof typeof durations;
