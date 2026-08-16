import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, Operator } from '@/src/api/shinaia';
import { Card, Chip, Loader, T } from '@/src/components/ui';

export default function Operators() {
  const router = useRouter();
  const [items, setItems] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.operators();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.head}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={[T.display(theme.font.xxl)]}>Operadores</Text>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0)}</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.display(theme.font.lg)]}>{item.name}</Text>
                  <Chip status={item.status} />
                </View>
                <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.role} • CNH {item.license}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="star" size={13} color={theme.colors.warning} />
                    <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.rating}</Text>
                  </View>
                  {item.assignedAsset && <Text style={[T.text(theme.font.sm, theme.colors.brandSecondary)]}>→ {item.assignedAsset}</Text>}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  avatar: { width: 48, height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.display, fontSize: theme.font.lg, color: theme.colors.onSurface },
});
