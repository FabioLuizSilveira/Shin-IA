import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, NotificationItem } from '@/src/api/shinaia';
import { Card, Loader, T } from '@/src/components/ui';

const toneColor = (t: string) => (t === 'warning' ? theme.colors.warning : t === 'success' ? theme.colors.success : theme.colors.brandSecondary);
const toneIcon = (t: string) => (t === 'warning' ? 'warning' : t === 'success' ? 'checkmark-circle' : 'information-circle');

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.notifications();
    setItems(res.data); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAll = () => setItems(prev => prev.map(n => ({ ...n, read: true })));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.head}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={theme.colors.onSurface} /></Pressable>
        <Text style={[T.display(theme.font.xxl), { flex: 1 }]}>Notificações</Text>
        <Pressable testID="mark-all-btn" onPress={markAll}><Text style={[T.text(theme.font.sm, theme.colors.brandSecondary), { fontWeight: '600' }]}>Marcar lidas</Text></Pressable>
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card style={[styles.row, !item.read && styles.unread]}>
              <View style={[styles.icon, { backgroundColor: toneColor(item.tone) + '22' }]}>
                <Ionicons name={toneIcon(item.tone) as any} size={18} color={toneColor(item.tone)} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.display(theme.font.base), { flex: 1 }]}>{item.title}</Text>
                  {!item.read && <View style={styles.dot} />}
                </View>
                <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{item.body}</Text>
                <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>{item.time}</Text>
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
  row: { flexDirection: 'row', gap: theme.spacing.md },
  unread: { borderColor: theme.colors.borderStrong },
  icon: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brandSecondary, marginLeft: 8, marginTop: 4 },
});
