import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Card, ScreenHeader, StatusBadge, EmptyState, Loader } from '@/src/components/ui';

export default function LocatarioContracts() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: any[] }>('/contracts');
      setItems(res.items || []);
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Contratos" subtitle={`${items.length} contrato(s)`} />
      {loading ? <Loader /> : items.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Sem contratos ainda" subtitle="Assine seu primeiro contrato ao alugar um veículo" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.contract_id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable testID={`contract-${item.contract_id}`} onPress={() => router.push({ pathname: '/contract/[id]', params: { id: item.contract_id } })}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.vehicle?.make} {item.vehicle?.model}</Text>
                    <Text style={styles.sub}>{item.vehicle?.plate}</Text>
                    <Text style={styles.sub}>{item.start_date?.slice(0, 10)} → {item.end_date?.slice(0, 10)}</Text>
                    <Text style={styles.price}>R$ {item.monthly_amount?.toFixed(0)}/mês</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  title: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  price: { color: theme.colors.brandPrimary, fontWeight: '500', marginTop: 4 },
});
