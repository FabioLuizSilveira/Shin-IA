import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, FinancialData } from '@/src/api/shinaia';
import { Card, ScreenHeader, Loader, T } from '@/src/components/ui';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR');

export default function Financial() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await shinaia.financial();
    setData(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const maxSeries = data ? Math.max(...data.revenue_series, ...data.expense_series) : 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Financeiro" subtitle={data?.period || ''} />
      {loading && !data ? <Loader /> : data && (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.lg }}
          refreshControl={<RefreshControl tintColor={theme.colors.brandSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Net hero */}
          <View style={styles.hero}>
            <LinearGradient colors={theme.gradients.violet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
            <View style={{ padding: theme.spacing.xl }}>
              <Text style={[T.text(theme.font.base, 'rgba(255,255,255,0.85)')]}>Resultado líquido</Text>
              <Text style={styles.heroValue}>{brl(data.net)}</Text>
              <View style={styles.marginPill}>
                <Ionicons name="trending-up" size={13} color="#fff" />
                <Text style={styles.marginText}>Margem {(data.margin * 100).toFixed(1)}%</Text>
              </View>
            </View>
          </View>

          {/* Revenue vs expenses */}
          <View style={styles.grid}>
            <Card style={styles.half}>
              <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>Receita</Text>
              <Text style={[T.display(theme.font.xl), { color: theme.colors.success }]}>{brl(data.revenue)}</Text>
            </Card>
            <Card style={styles.half}>
              <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>Despesas</Text>
              <Text style={[T.display(theme.font.xl), { color: theme.colors.warning }]}>{brl(data.expenses)}</Text>
            </Card>
          </View>

          {/* Dual bar chart */}
          <Card>
            <Text style={[T.display(theme.font.lg), { marginBottom: theme.spacing.md }]}>Receita x Despesa (6 meses)</Text>
            <View style={styles.chart}>
              {data.revenue_series.map((r, i) => (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, { height: (r / maxSeries) * 120, backgroundColor: theme.colors.brandSecondary }]} />
                    <View style={[styles.bar, { height: (data.expense_series[i] / maxSeries) * 120, backgroundColor: theme.colors.brandTertiary }]} />
                  </View>
                  <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>{i + 1}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.lgDot, { backgroundColor: theme.colors.brandSecondary }]} /><Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>Receita</Text></View>
              <View style={styles.legendItem}><View style={[styles.lgDot, { backgroundColor: theme.colors.brandTertiary }]} /><Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>Despesa</Text></View>
            </View>
          </Card>

          {/* Breakdown */}
          <View>
            <Text style={[T.display(theme.font.xl), { marginBottom: theme.spacing.sm }]}>Despesas por categoria</Text>
            <Card style={{ padding: 0 }}>
              {data.breakdown.map((b, i) => {
                const pct = (b.value / data.expenses) * 100;
                const c = b.tone === 'warning' ? theme.colors.warning : b.tone === 'info' ? theme.colors.brandSecondary : b.tone === 'brand' ? theme.colors.brandPrimary : theme.colors.muted;
                return (
                  <View key={b.id} style={[styles.brRow, i < data.breakdown.length - 1 && styles.brDivider]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={[T.text(theme.font.base, theme.colors.onSurface), { fontWeight: '600' }]}>{b.label}</Text>
                        <Text style={[T.text(theme.font.base, theme.colors.onSurfaceTertiary)]}>{brl(b.value)}</Text>
                      </View>
                      <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: c }]} /></View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { borderRadius: theme.radius.lg, overflow: 'hidden' },
  heroValue: { fontFamily: theme.display, fontSize: 42, color: '#fff', letterSpacing: -1, marginTop: 4 },
  marginPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, alignSelf: 'flex-start', marginTop: 10 },
  marginText: { color: '#fff', fontFamily: theme.text, fontSize: theme.font.sm, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: theme.spacing.md },
  half: { flex: 1, gap: 6 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 8 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 120 },
  bar: { width: 9, borderRadius: 3 },
  legendRow: { flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lgDot: { width: 8, height: 8, borderRadius: 4 },
  brRow: { flexDirection: 'row', padding: theme.spacing.lg },
  brDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
