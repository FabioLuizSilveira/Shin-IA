// Shinã I.A. — Dark-First Utility theme tokens
export const theme = {
  colors: {
    surface: '#0F172A',        // Navy Deep
    onSurface: '#F8FAFC',
    surfaceSecondary: '#1E293B',
    onSurfaceSecondary: '#F1F5F9',
    surfaceTertiary: '#334155',
    onSurfaceTertiary: '#E2E8F0',
    surfaceInverse: '#F8FAFC',
    onSurfaceInverse: '#0F172A',
    brand: '#2563EB',          // Electric Blue
    brandPrimary: '#2563EB',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#06B6D4', // Neural Cyan
    onBrandSecondary: '#0F172A',
    brandTertiary: '#7C3AED',  // Growth Violet
    onBrandTertiary: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    border: '#1E293B',
    borderStrong: '#334155',
    divider: '#1E293B',
    muted: '#64748B',
  },
  gradients: {
    neural: ['#2563EB', '#06B6D4'] as const,
    violet: ['#7C3AED', '#2563EB'] as const,
    scrim: ['transparent', '#0F172A'] as const,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  display: 'SpaceGrotesk',
  text: 'PlusJakartaSans',
};

export type Theme = typeof theme;
