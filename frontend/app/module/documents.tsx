import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, DocItem } from '@/src/api/shinaia';
import { Card, Chip, Loader, T } from '@/src/components/ui';

const ICON: Record<string, string> = { Licenciamento: 'car', Seguro: 'shield-checkmark', Contrato: 'document-text', Regulatório: 'ribbon' };

export default function Documents() {
  const router = useRouter();
  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.documents();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.head}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={[T.display(theme.font.xxl)]}>Documentos</Text>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable testID={`doc-${item.id}`}>
              <Card style={styles.row}>
                <View style={styles.docIcon}><Ionicons name={(ICON[item.type] || 'document') as any} size={20} color={theme.colors.brandSecondary} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[T.display(theme.font.base)]}>{item.name}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.type} • {item.size} • {item.updated}</Text>
                </View>
                <Chip status={item.status} />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  back: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  docIcon: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSecondary + '1A', alignItems: 'center', justifyContent: 'center' },
});
