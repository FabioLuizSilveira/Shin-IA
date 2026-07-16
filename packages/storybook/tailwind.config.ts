import type { Config } from "tailwindcss";
import { shinaPreset } from "@shina/theme";

// Sem este arquivo, nenhuma classe utilitária dos pacotes @shina/* vira CSS
// real dentro do Storybook — é a mesma fonte de verdade usada pelos apps.

export default {
  presets: [shinaPreset],
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../design-system/src/**/*.{ts,tsx}",
    "../landing/src/**/*.{ts,tsx}",
    "../flow-engine/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
