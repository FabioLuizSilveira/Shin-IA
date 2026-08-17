import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, OperationsData } from '@/src/api/shinaia';
import { useAuth } from '@/src/context/auth';
import { Card, ScreenHeader, Loader, Sparkbar, T } from '@/src/components/ui';

export default function Operations() {
  const { user } = useAuth();
  const [data, setData] = useState<OperationsData | null>(null);
  const [source, setSource] = useState<'live' | 'mock'>('mock');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await shinaia.operations();
    setData(res.data); setSource(res.source); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Operações"
        subtitle={source === 'live' ? 'Ao vivo' : 'Demonstração'}
        brand
        right={
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.charAt(0) || 'S'}</Text></View>
        }
      />
      {loading && !data ? <Loader /> : data && (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.lg }}
          refreshControl={<RefreshControl tintColor={theme.colors.brandSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Hero KPI */}
          <View style={styles.hero}>
            <LinearGradient colors={theme.gradients.neural} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
            <View style={{ padding: theme.spacing.xl }}>
              <Text style={[T.text(theme.font.base, 'rgba(255,255,255,0.85)')]}>{data.hero.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Text style={styles.heroValue}>{data.hero.value}{data.hero.unit}</Text>
                <View style={styles.trendUp}>
                  <Ionicons name="trending-up" size={13} color="#fff" />
                  <Text style={styles.trendText}>{data.hero.trend}%</Text>
                </View>
              </View>
              <View style={{ marginTop: theme.spacing.md }}>
                <Sparkbar data={data.weekly_load} color="#ffffff" height={40} />
                <Text style={[T.text(theme.font.sm, 'rgba(255,255,255,0.7)'), { marginTop: 6 }]}>Carga operacional — últimos 7 dias</Text>
              </View>
            </View>
          </View>

          {/* Context tiles */}
          <View style={styles.grid}>
            {data.tiles.map(t => (
              <Card key={t.id} style={styles.tile}>
                <View style={styles.tileIcon}><Ionicons name={t.icon as any} size={18} color={theme.colors.brandSecondary} /></View>
                <Text style={[T.display(theme.font.xxl)]}>{t.value}</Text>
                <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{t.label}</Text>
              </Card>
            ))}
          </View>

          {/* Activity feed */}
          <View>
            <Text style={[T.display(theme.font.xl), { marginBottom: theme.spacing.sm }]}>Atividade recente</Text>
            <Card style={{ padding: 0 }}>
              {data.activity.map((a, i) => (
                <View key={a.id} style={[styles.actRow, i < data.activity.length - 1 && styles.actDivider]}>
                  <View style={[styles.actDot, { backgroundColor: toneColor(a.tone) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.text(theme.font.base, theme.colors.onSurface), { fontWeight: '600' }]}>{a.title}</Text>
                    <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{a.asset}</Text>
                  </View>
                  <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>{a.time}</Text>
                </View>
              ))}
            </Card>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function toneColor(t?: string) {
  return t === 'warning' ? theme.colors.warning : t === 'success' ? theme.colors.success : theme.colors.brandSecondary;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  avatar: { width: 42, height: 42, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.display, color: theme.colors.onSurface, fontSize: theme.font.lg },
  hero: { borderRadius: theme.radius.lg, overflow: 'hidden' },
  heroValue: { fontFamily: theme.display, fontSize: 52, color: '#fff', letterSpacing: -1 },
  trendUp: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, marginBottom: 12 },
  trendText: { color: '#fff', fontFamily: theme.text, fontSize: theme.font.sm, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  tile: { width: '47.5%', gap: 8, flexGrow: 1 },
  tileIcon: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSecondary + '1A', alignItems: 'center', justifyContent: 'center' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.lg },
  actDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  actDot: { width: 8, height: 8, borderRadius: 4 },
});
