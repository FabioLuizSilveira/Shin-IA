import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shina: {
          navy: "#0F172A",
          blue: "#2563EB",
          cyan: "#06B6D4",
          green: "#10B981",
          slate: "#64748B",
          light: "#E2E8F0",
          black: "#020617",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
