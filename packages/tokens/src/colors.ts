// Shinã Flow — primitive color scales (docs/design-system/04_COLOR_SYSTEM.md)
// Brand anchors are under Brand Lock (doc 02) — never change them here.

export const blue = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB", // Shinã Blue — platform primary
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
} as const;

export const purple = {
  50: "#EEF2FF",
  100: "#E0E7FF",
  200: "#C7D2FE",
  300: "#A5B4FC",
  400: "#A78BFA", // MKT Glow
  500: "#6366F1", // MKT primary
  600: "#7C3AED",
  700: "#8B5CF6", // gradient pair (brand position)
  800: "#5B21B6",
  900: "#4C1D95",
} as const;

export const cyan = {
  50: "#ECFEFF",
  100: "#CFFAFE",
  200: "#A5F3FC",
  300: "#67E8F9",
  400: "#22D3EE",
  500: "#06B6D4", // Shinã Cyan — platform gradient pair
  600: "#0891B2",
  700: "#0E7490",
  800: "#155E75",
  900: "#164E63",
} as const;

export const gray = {
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E2E8F0", // Shinã Light — primary text on dark
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#64748B", // Shinã Slate
  600: "#475569",
  700: "#334155",
  800: "#1E293B",
  900: "#0F172A", // Shinã Navy — default background
  950: "#020617", // Shinã Black — deep background
} as const;

export const semantic = {
  success: {
    base: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    text: "#34D399",
    border: "rgba(16,185,129,0.25)",
  },
  warning: {
    base: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    text: "#FBBF24",
    border: "rgba(245,158,11,0.25)",
  },
  danger: {
    base: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    text: "#F87171",
    border: "rgba(239,68,68,0.25)",
  },
  info: {
    base: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
    text: "#60A5FA",
    border: "rgba(59,130,246,0.25)",
  },
} as const;

/** Categorical chart sequence — fixed order, dark-accessible (doc 04 §7). */
export const chartColors = [
  blue[400],
  purple[400],
  cyan[400],
  "#34D399",
  "#FBBF24",
  "#F87171",
  gray[400],
] as const;

export const colors = { blue, purple, cyan, gray, semantic, chartColors } as const;
