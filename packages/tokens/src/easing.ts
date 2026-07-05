// Shinã Flow — easing curves (doc 11 §3). Física de água: sem bounce.

export const easing = {
  /** entradas — chega rápido, assenta devagar */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** morphs e trocas de posição */
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  /** saídas — só para elementos que somem */
  in: "cubic-bezier(0.7, 0, 0.84, 0)",
  /** loops ambientes e streaming */
  linear: "linear",
} as const;

/** Arrays para Framer Motion (`ease: [...]`) */
export const easingArray = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.7, 0, 0.84, 0],
} as const;
