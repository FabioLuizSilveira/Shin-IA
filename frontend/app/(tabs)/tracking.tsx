import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, TrackedAsset } from '@/src/api/shinaia';
import { Chip, Loader, T, BrandMark } from '@/src/components/ui';

const { width } = Dimensions.get('window');
const MAP_H = 380;

export default function Tracking() {
  const [items, setItems] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrackedAsset | null>(null);

  const load = useCallback(async () => {
    const res = await shinaia.tracking();
    setItems(res.data);
    setSelected(res.data[0] || null);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pinColor = (s: string) => (s === 'alert' ? theme.colors.error : s === 'idle' ? theme.colors.muted : theme.colors.success);

  return (
    <View style={styles.container}>
      {/* Map area */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1759256243611-502772ac391b?w=1000' }}
        style={styles.map}
        imageStyle={{ opacity: 0.55 }}
      >
        <LinearGradient colors={['rgba(15,23,42,0.6)', 'rgba(15,23,42,0.2)', 'rgba(15,23,42,0.9)']} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={styles.mapHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <BrandMark size={26} />
            <View>
              <Text style={[T.text(theme.font.sm, theme.colors.brandSecondary), { letterSpacing: 1, textTransform: 'uppercase' }]}>Ao vivo</Text>
              <Text style={[T.display(theme.font.xxl)]}>Tracking</Text>
            </View>
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} /><Text style={styles.legendText}>Ativo</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.colors.error }]} /><Text style={styles.legendText}>Alerta</Text></View>
          </View>
        </SafeAreaView>

        {/* Pins */}
        {!loading && items.map(a => (
          <Pressable
            key={a.id}
            testID={`pin-${a.id}`}
            onPress={() => setSelected(a)}
            style={[styles.pin, { left: a.x * (width - 40), top: a.y * MAP_H }]}
          >
            <View style={[styles.pinDot, { backgroundColor: pinColor(a.status), borderColor: selected?.id === a.id ? '#fff' : 'transparent' }]}>
              <Ionicons name="car" size={13} color="#fff" />
            </View>
            {a.status === 'active' && <View style={[styles.pulse, { borderColor: pinColor(a.status) }]} />}
          </Pressable>
        ))}
      </ImageBackground>

      {/* Bottom sheet list */}
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {loading ? <Loader /> : (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.sm }}>
            <Text style={[T.display(theme.font.xl), { marginBottom: 4 }]}>{items.length} veículos rastreados</Text>
            {items.map(a => {
              const active = selected?.id === a.id;
              return (
                <Pressable key={a.id} testID={`track-row-${a.id}`} onPress={() => setSelected(a)} style={[styles.row, active && styles.rowActive]}>
                  <View style={[styles.rowIcon, { backgroundColor: pinColor(a.status) + '22' }]}>
                    <Ionicons name="navigate" size={16} color={pinColor(a.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[T.display(theme.font.base)]}>{a.id}</Text>
                      <Chip status={a.status} />
                    </View>
                    <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{a.city} • {a.speed} km/h</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={[T.text(theme.font.sm, theme.colors.muted), { textAlign: 'center', marginTop: 8 }]}>
              Mapa interativo com GPS em tempo real disponível no build nativo.
            </Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  map: { height: MAP_H, backgroundColor: theme.colors.surfaceSecondary },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  legend: { gap: 4, backgroundColor: 'rgba(30,41,59,0.7)', padding: 8, borderRadius: theme.radius.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: theme.text, fontSize: theme.font.sm, color: theme.colors.onSurfaceTertiary },
  pin: { position: 'absolute', width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  pulse: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2, opacity: 0.4 },
  sheet: { flex: 1, marginTop: -20, backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceTertiary, marginTop: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: 'transparent' },
  rowActive: { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.borderStrong },
  rowIcon: { width: 36, height: 36, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
});
