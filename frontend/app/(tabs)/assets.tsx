import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, Asset } from '@/src/api/shinaia';
import { Card, ScreenHeader, Chip, Loader, EmptyState, T } from '@/src/components/ui';

const FILTERS = ['all', 'rented', 'available', 'maintenance'] as const;
const FILTER_LABEL: Record<string, string> = { all: 'Todos', rented: 'Alugados', available: 'Disponíveis', maintenance: 'Manutenção' };

export default function Assets() {
  const router = useRouter();
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const load = useCallback(async () => {
    const res = await shinaia.assets();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => items.filter(a => {
    const okF = filter === 'all' || a.status === filter;
    const okQ = !q.trim() || `${a.id} ${a.model} ${a.plate}`.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  }), [items, filter, q]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Ativos" subtitle={`${items.length} na frota`} brand />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <TextInput
          testID="asset-search"
          value={q} onChangeText={setQ}
          placeholder="Buscar por ID, modelo ou placa"
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f => (
            <Pressable key={f} testID={`filter-${f}`} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
              <Text style={[T.text(theme.font.sm, filter === f ? '#fff' : theme.colors.onSurfaceTertiary), { fontWeight: '600' }]}>{FILTER_LABEL[f]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState icon="cube-outline" title="Nenhum ativo" subtitle="Ajuste a busca ou os filtros" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: 120, gap: theme.spacing.md }}
          renderItem={({ item }) => (
            <Pressable testID={`asset-${item.id}`} onPress={() => router.push({ pathname: '/asset/[id]', params: { id: item.id } })}>
              <Card style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                <Image source={{ uri: item.photo }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[T.display(theme.font.lg)]}>{item.id}</Text>
                    <Chip status={item.status} />
                  </View>
                  <Text style={[T.text(theme.font.base, theme.colors.onSurfaceTertiary)]}>{item.model} • {item.plate}</Text>
                  <View style={styles.healthBar}>
                    <View style={[styles.healthFill, { width: `${item.health}%`, backgroundColor: item.health > 80 ? theme.colors.success : item.health > 65 ? theme.colors.warning : theme.colors.error }]} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>Saúde {item.health}% • {item.odo_km.toLocaleString('pt-BR')} km</Text>
                    <Text style={[T.text(theme.font.sm, theme.colors.brandSecondary), { fontWeight: '700' }]}>R$ {item.weekly_rate}/sem</Text>
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
  search: { marginHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, height: 46, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontFamily: theme.text, fontSize: theme.font.base, color: theme.colors.onSurface },
  chipRow: { height: 56, justifyContent: 'center' },
  chips: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  thumb: { width: 72, height: 72, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceTertiary },
  healthBar: { height: 5, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden', marginTop: 2 },
  healthFill: { height: 5, borderRadius: 3 },
});
