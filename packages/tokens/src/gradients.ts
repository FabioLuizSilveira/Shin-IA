// Shinã Flow — brand gradients (doc 04 §8, Brand Lock doc 02)

import { blue, cyan, purple } from "./colors";

export interface GradientToken {
  from: string;
  to: string;
  angle: number;
  css: string;
}

function linear(from: string, to: string, angle = 135): GradientToken {
  return { from, to, angle, css: `linear-gradient(${angle}deg, ${from}, ${to})` };
}

export const gradients = {
  platform: linear(blue[600], cyan[500]),
  mkt: linear(purple[500], purple[700]),
  mktText: linear(purple[500], purple[400]),
  success: linear("#10B981", "#059669"),
} as const;
