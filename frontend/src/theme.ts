// Central theme tokens for the app
export const theme = {
  colors: {
    surface: '#F9F9F7',
    onSurface: '#1C1C1E',
    surfaceSecondary: '#FFFFFF',
    onSurfaceSecondary: '#3A3A3C',
    surfaceTertiary: '#F2F2F0',
    onSurfaceTertiary: '#636366',
    surfaceInverse: '#2C2C2E',
    onSurfaceInverse: '#F9F9F7',
    brand: '#5B6B46',
    brandPrimary: '#4A5D23',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#7C8E64',
    brandTertiary: '#E7EBE1',
    onBrandTertiary: '#314013',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#5AC8FA',
    border: '#E5E5EA',
    borderStrong: '#C7C7CC',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

export type Theme = typeof theme;
