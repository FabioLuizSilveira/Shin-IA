import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Card, ScreenHeader, EmptyState, Loader, StatusBadge } from '@/src/components/ui';

export default function LocatarioHome() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: any[] }>('/vehicles?status=available');
      setItems(res.items || []);
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter(v => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${v.make} ${v.model} ${v.plate}`.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Explore" subtitle="Encontre um carro para alugar" />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.colors.onSurfaceTertiary} />
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Marca, modelo ou placa"
          placeholderTextColor={theme.colors.onSurfaceTertiary}
          style={styles.searchInput}
        />
      </View>
      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState icon="car-sport-outline" title="Nenhum carro disponível" subtitle="Tente novamente mais tarde ou limpe filtros" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.vehicle_id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable testID={`market-${item.vehicle_id}`} onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: item.vehicle_id } })}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <Image source={{ uri: item.photo_url }} style={styles.hero} contentFit="cover" />
                <View style={{ padding: theme.spacing.lg, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.make} {item.model}</Text>
                      <Text style={styles.sub}>{item.year} • {item.transmission} • {item.fuel}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.price}>R$ {item.daily_rate}<Text style={styles.priceSub}>/dia</Text></Text>
                    <View style={styles.viewBtn}><Text style={styles.viewBtnText}>Ver detalhes</Text></View>
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
  searchBox: {
    marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: theme.font.lg },
  hero: { width: '100%', height: 180, backgroundColor: theme.colors.surfaceTertiary },
  title: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 22, fontWeight: '500', color: theme.colors.brandPrimary },
  priceSub: { fontSize: theme.font.base, color: theme.colors.onSurfaceTertiary, fontWeight: '400' },
  viewBtn: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill },
  viewBtnText: { color: theme.colors.onBrandTertiary, fontWeight: '500' },
});
