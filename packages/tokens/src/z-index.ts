// Shinã Flow — z-index scale (doc 06 §9). Valores fora da escala são bug.

export const zIndex = {
  base: 0,
  raised: 10,
  nav: 40,
  header: 50,
  dropdown: 60,
  overlay: 80,
  modal: 90,
  toast: 100,
} as const;
