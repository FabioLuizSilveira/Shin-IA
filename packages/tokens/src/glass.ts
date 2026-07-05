// Shinã Flow — glass recipe (doc 08 §4)

import { surface, border } from "./surface";
import { radius } from "./radius";

export const glass = {
  background: surface.glass,
  backgroundHover: surface.glassHover,
  border: border.default,
  borderHover: border.strong,
  /** backdrop blur, px */
  blur: 8,
  radius: radius.lg,
  /** máx. de níveis de glass empilhados */
  maxStack: 2,
} as const;
