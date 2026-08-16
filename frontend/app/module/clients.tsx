import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, Client } from '@/src/api/shinaia';
import { Card, Chip, Loader, T } from '@/src/components/ui';

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR');

export default function Clients() {
  const router = useRouter();
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.clients();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.head}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={[T.display(theme.font.xxl)]}>Clientes</Text>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.display(theme.font.lg)]}>{item.name}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.segment}</Text>
                </View>
                <Chip status={item.status} />
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={[T.display(theme.font.lg), { color: theme.colors.brandSecondary }]}>{item.activeContracts}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>Contratos</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[T.display(theme.font.lg), { color: theme.colors.success }]}>{brl(item.revenue)}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>Receita</Text>
                </View>
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
  stats: { flexDirection: 'row', gap: theme.spacing.xl, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  stat: { gap: 2 },
});
