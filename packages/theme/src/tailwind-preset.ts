// Preset Tailwind oficial (doc 09 §5). Apps consomem via `presets: [shinaPreset]`.
// Mantém compatibilidade com as classes já usadas (cores shina.* e mkt.*).

import {
  blue,
  purple,
  cyan,
  gray,
  semantic,
  surface,
  border,
  radius,
  shadow,
  zIndex,
  durations,
  fontFamily,
  breakpoints,
} from "@shina/tokens";

export const shinaPreset = {
  darkMode: "class" as const,
  theme: {
    extend: {
      colors: {
        blue,
        purple,
        cyan,
        gray,
        // aliases de marca já usados nos apps (compat)
        shina: {
          navy: gray[900],
          blue: blue[600],
          cyan: cyan[500],
          green: semantic.success.base,
          slate: gray[500],
          light: gray[200],
          black: gray[950],
        },
        mkt: {
          primary: purple[500],
          secondary: purple[700],
          glow: purple[400],
        },
        surface: {
          DEFAULT: surface.background,
          deep: surface.deep,
          raised: surface.raised,
        },
        success: semantic.success.base,
        warning: semantic.warning.base,
        danger: semantic.danger.base,
        info: semantic.info.base,
      },
      borderColor: {
        subtle: border.subtle,
        DEFAULT: border.default,
        strong: border.strong,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
      },
      boxShadow: {
        sm: shadow.sm,
        md: shadow.md,
        lg: shadow.lg,
        "glow-platform": shadow.glowPlatform,
        "glow-mkt": shadow.glowMkt,
      },
      zIndex: Object.fromEntries(Object.entries(zIndex).map(([k, v]) => [k, String(v)])),
      transitionDuration: {
        instant: `${durations.instant}ms`,
        fast: `${durations.fast}ms`,
        base: `${durations.base}ms`,
        slow: `${durations.slow}ms`,
      },
      transitionTimingFunction: {
        "shina-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "shina-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      fontFamily: {
        sans: [...fontFamily.sans],
        display: [...fontFamily.display],
        mono: [...fontFamily.mono],
      },
      screens: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v}px`])),
    },
  },
};

export default shinaPreset;
