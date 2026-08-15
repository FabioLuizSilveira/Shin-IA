import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Card, ScreenHeader, StatusBadge, EmptyState, Loader } from '@/src/components/ui';

export default function Rentals() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: any[] }>('/contracts');
      setItems((res.items || []).filter((c: any) => c.status === 'active' || c.status === 'pending'));
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Meus carros" subtitle="Locações ativas e pendentes" />
      {loading ? <Loader /> : items.length === 0 ? (
        <EmptyState icon="key-outline" title="Nenhum carro alugado" subtitle="Explore a aba para encontrar um veículo" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.contract_id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable testID={`rental-${item.contract_id}`} onPress={() => router.push({ pathname: '/contract/[id]', params: { id: item.contract_id } })}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <Image source={{ uri: item.vehicle?.photo_url }} style={styles.hero} contentFit="cover" />
                <View style={{ padding: theme.spacing.lg, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.vehicle?.make} {item.vehicle?.model}</Text>
                      <Text style={styles.sub}>{item.vehicle?.plate} • R$ {item.monthly_amount?.toFixed(0)}/mês</Text>
                      <Text style={styles.sub}>Até {item.end_date?.slice(0, 10)}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
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
  hero: { width: '100%', height: 160, backgroundColor: theme.colors.surfaceTertiary },
  title: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
});
