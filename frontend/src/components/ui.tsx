import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    available: { color: theme.colors.success, bg: '#E7F8EC', label: 'Disponível' },
    rented: { color: theme.colors.brandPrimary, bg: theme.colors.brandTertiary, label: 'Alugado' },
    maintenance: { color: theme.colors.warning, bg: '#FFF3E0', label: 'Manutenção' },
    active: { color: theme.colors.success, bg: '#E7F8EC', label: 'Ativo' },
    pending: { color: theme.colors.warning, bg: '#FFF3E0', label: 'Pendente' },
    completed: { color: theme.colors.onSurfaceTertiary, bg: theme.colors.surfaceTertiary, label: 'Concluído' },
    scheduled: { color: theme.colors.info, bg: '#E5F6FE', label: 'Agendado' },
    in_progress: { color: theme.colors.warning, bg: '#FFF3E0', label: 'Em andamento' },
    paid: { color: theme.colors.success, bg: '#E7F8EC', label: 'Pago' },
  };
  const cfg = map[status] || { color: theme.colors.onSurfaceTertiary, bg: theme.colors.surfaceTertiary, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction, testID }: any) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon || 'file-tray-outline'} size={32} color={theme.colors.onBrandTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
      {!!actionLabel && (
        <Pressable testID={testID} style={styles.emptyBtn} onPress={onAction}>
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Loader() {
  return (
    <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={theme.colors.brandPrimary} />
    </View>
  );
}

export function PrimaryButton({ label, onPress, testID, disabled, loading, style }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading}
      style={[styles.primaryBtn, (disabled || loading) && { opacity: 0.6 }, style]}>
      {loading ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> :
        <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: theme.font.sm, fontWeight: '500' },
  card: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  header: {
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
  },
  headerTitle: { fontSize: 28, fontWeight: '500', color: theme.colors.onSurface, letterSpacing: -0.5 },
  headerSub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  empty: { alignItems: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
  emptyIcon: {
    width: 64, height: 64, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm,
  },
  emptyTitle: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  emptySub: { color: theme.colors.onSurfaceTertiary, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: theme.colors.brandPrimary, paddingHorizontal: theme.spacing.xl,
    paddingVertical: 12, borderRadius: theme.radius.pill, marginTop: theme.spacing.sm,
  },
  emptyBtnText: { color: theme.colors.onBrandPrimary, fontWeight: '500' },
  primaryBtn: {
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: theme.colors.onBrandPrimary, fontWeight: '500', fontSize: theme.font.lg },
});
