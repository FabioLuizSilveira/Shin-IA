// Shinã Flow — theme composition (doc 09 §4). Dark é o padrão; light elimina
// glow/glass (doc 04 §9). Produto define o acento (platform azul, mkt índigo).

import { blue, purple, cyan, gray, semantic } from "./colors";
import { surface, border } from "./surface";
import { gradients, type GradientToken } from "./gradients";
import { glow, type GlowToken } from "./glow";

export type ThemeMode = "dark" | "light";
export type ThemeProduct = "platform" | "mkt";

export interface ShinaTheme {
  mode: ThemeMode;
  product: ThemeProduct;
  color: {
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    accent: string;
    text: { title: string; primary: string; secondary: string; tertiary: string; disabled: string };
    semantic: typeof semantic;
  };
  surface: {
    background: string;
    deep: string;
    raised: string;
    glass: string;
    glassHover: string;
    overlay: string;
  };
  border: { subtle: string; default: string; strong: string; focus: string };
  gradient: GradientToken;
  glow: GlowToken | null;
}

export function createTheme(
  options: { mode?: ThemeMode; product?: ThemeProduct } = {},
): ShinaTheme {
  const mode = options.mode ?? "dark";
  const product = options.product ?? "platform";

  const primaryScale = product === "mkt" ? purple : blue;
  const primary = product === "mkt" ? purple[500] : blue[600];
  const accent = product === "mkt" ? purple[400] : blue[400];

  if (mode === "light") {
    return {
      mode,
      product,
      color: {
        primary,
        primaryHover: primaryScale[600],
        primaryPressed: primaryScale[800],
        accent: primaryScale[600],
        text: {
          title: gray[900],
          primary: gray[900],
          secondary: gray[600],
          tertiary: gray[500],
          disabled: gray[400],
        },
        semantic,
      },
      surface: {
        background: "#FFFFFF",
        deep: gray[50],
        raised: "#FFFFFF",
        glass: gray[50],
        glassHover: gray[100],
        overlay: "rgba(15,23,42,0.40)",
      },
      border: {
        subtle: gray[100],
        default: gray[200],
        strong: gray[300],
        focus: withAlpha(primary, 0.4),
      },
      gradient: product === "mkt" ? gradients.mkt : gradients.platform,
      glow: null, // light mode elimina glow (doc 04 §9)
    };
  }

  return {
    mode,
    product,
    color: {
      primary,
      primaryHover: product === "mkt" ? purple[400] : blue[500],
      primaryPressed: primaryScale[700],
      accent,
      text: {
        title: "#FFFFFF",
        primary: gray[200],
        secondary: gray[400],
        tertiary: gray[500],
        disabled: gray[600],
      },
      semantic,
    },
    surface,
    border: { ...border, focus: withAlpha(primary, 0.4) },
    gradient: product === "mkt" ? gradients.mkt : gradients.platform,
    glow: product === "mkt" ? glow.mkt : glow.platform,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// re-export scale used above for consumers
export { cyan };
