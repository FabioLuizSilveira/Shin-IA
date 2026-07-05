import type { Config } from "tailwindcss";
import { shinaPreset } from "@shina/theme";

// Wave 2.5 ORBIT: cores, radius, sombras e durações vêm do preset oficial
// (@shina/theme) — nada de tokens locais duplicados. Este app não define
// mais sua própria paleta; ela é a fonte única do design system.

export default {
  presets: [shinaPreset],
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/marketing-ai/src/**/*.{ts,tsx}",
    "../../packages/design-system/src/**/*.{ts,tsx}",
    "../../packages/landing/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
