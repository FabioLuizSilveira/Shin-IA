// Shinã Flow — breakpoints, mobile-first (doc 06 §3)

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const containers = {
  reading: 672,
  detail: 896,
  dashboard: 1152,
  marketing: 1280,
} as const;
