import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, Contract } from '@/src/api/shinaia';
import { Card, Chip, Loader, T, BrandMark } from '@/src/components/ui';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR');

export default function Contracts() {
  const router = useRouter();
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.contracts();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.head}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <BrandMark size={22} />
        <Text style={[T.display(theme.font.xxl)]}>Contratos</Text>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[T.display(theme.font.lg)]}>{item.id}</Text>
                <Chip status={item.status} />
              </View>
              <Text style={[T.text(theme.font.base, theme.colors.onSurfaceSecondary)]}>{item.client}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
                  <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.start} → {item.end}</Text>
                </View>
                <Text style={[T.display(theme.font.lg), { color: theme.colors.brandSecondary }]}>{brl(item.value)}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  back: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
});
