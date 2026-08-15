import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/auth';
import { Card, ScreenHeader, StatusBadge, Loader } from '@/src/components/ui';

type Summary = { vehicles: number; active_contracts: number; pending_contracts: number; maintenance_open: number; monthly_revenue: number };

export default function LocadorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, v, c] = await Promise.all([
        api<Summary>('/dashboard/summary'),
        api<{ items: any[] }>('/vehicles?mine=true'),
        api<{ items: any[] }>('/contracts'),
      ]);
      setSummary(s);
      setVehicles(v.items || []);
      setContracts(c.items || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={`Olá, ${user?.name?.split(' ')[0] || ''}`} subtitle="Painel do locador" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !summary ? <Loader /> : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.md }}>
              <MetricCard icon="cash-outline" label="Receita mensal" value={`R$ ${(summary?.monthly_revenue || 0).toFixed(0)}`} tint />
              <MetricCard icon="car-outline" label="Frota" value={String(summary?.vehicles || 0)} />
              <MetricCard icon="document-text-outline" label="Ativos" value={String(summary?.active_contracts || 0)} />
              <MetricCard icon="hourglass-outline" label="Pendentes" value={String(summary?.pending_contracts || 0)} />
              <MetricCard icon="construct-outline" label="Manutenções" value={String(summary?.maintenance_open || 0)} />
            </ScrollView>

            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Contratos recentes</Text>
                <Pressable testID="see-all-contracts" onPress={() => router.push('/(locador)/contracts')}>
                  <Text style={styles.link}>Ver tudo</Text>
                </Pressable>
              </View>
              {contracts.length === 0 ? (
                <Card><Text style={styles.mutedText}>Nenhum contrato ainda.</Text></Card>
              ) : contracts.slice(0, 3).map(c => (
                <Pressable
                  key={c.contract_id}
                  testID={`contract-row-${c.contract_id}`}
                  onPress={() => router.push({ pathname: '/contract/[id]', params: { id: c.contract_id } })}
                  style={{ marginBottom: theme.spacing.sm }}>
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{c.vehicle ? `${c.vehicle.make} ${c.vehicle.model}` : 'Veículo removido'}</Text>
                        <Text style={styles.itemSub}>{c.vehicle?.plate || '—'} • R$ {c.monthly_amount?.toFixed(0)}/mês</Text>
                      </View>
                      <StatusBadge status={c.status} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>

            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Minha frota</Text>
                <Pressable testID="see-all-vehicles" onPress={() => router.push('/(locador)/vehicles')}>
                  <Text style={styles.link}>Ver tudo</Text>
                </Pressable>
              </View>
              {vehicles.slice(0, 3).map(v => (
                <Pressable
                  key={v.vehicle_id}
                  testID={`vehicle-row-${v.vehicle_id}`}
                  onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: v.vehicle_id } })}
                  style={{ marginBottom: theme.spacing.sm }}>
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{v.make} {v.model} <Text style={styles.itemSub}>{v.year}</Text></Text>
                        <Text style={styles.itemSub}>{v.plate} • {v.mileage_km?.toLocaleString('pt-BR')} km</Text>
                      </View>
                      <StatusBadge status={v.status} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value, tint }: any) {
  return (
    <View style={[styles.metric, tint && { backgroundColor: theme.colors.brandTertiary }]}>
      <Ionicons name={icon} size={20} color={tint ? theme.colors.onBrandTertiary : theme.colors.brandPrimary} />
      <Text style={[styles.metricValue, tint && { color: theme.colors.onBrandTertiary }]}>{value}</Text>
      <Text style={[styles.metricLabel, tint && { color: theme.colors.onBrandTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  metric: {
    width: 140, padding: theme.spacing.lg, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border,
    gap: 6,
  },
  metricValue: { fontSize: 22, fontWeight: '500', color: theme.colors.onSurface },
  metricLabel: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  sectionTitle: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  link: { color: theme.colors.brandPrimary, fontWeight: '500' },
  itemTitle: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  itemSub: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.base, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  mutedText: { color: theme.colors.onSurfaceTertiary },
});
