import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { shinaia, Asset } from '@/src/api/shinaia';
import { Card, Chip, Loader, T } from '@/src/components/ui';

export default function AssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | undefined>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await shinaia.asset(String(id));
    setAsset(res.data); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.container}><Loader /></SafeAreaView>;
  if (!asset) return <SafeAreaView style={styles.container}><Text style={[T.text(), { padding: 20 }]}>Ativo não encontrado</Text></SafeAreaView>;

  const specs = [
    { icon: 'car-outline', label: 'Modelo', value: asset.model },
    { icon: 'pricetag-outline', label: 'Placa', value: asset.plate },
    { icon: 'speedometer-outline', label: 'Odômetro', value: `${asset.odo_km.toLocaleString('pt-BR')} km` },
    { icon: 'cash-outline', label: 'Locação', value: `R$ ${(asset as any).weekly_rate}/sem` },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
        <View>
          <Image source={{ uri: asset.photo }} style={styles.hero} contentFit="cover" />
          <LinearGradient colors={['rgba(15,23,42,0.5)', 'transparent', '#0F172A']} style={StyleSheet.absoluteFill as any} />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <Pressable testID="back-btn" onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color="#fff" /></Pressable>
            <Chip status={asset.status} />
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <Text style={[T.display(theme.font.xxxl), { color: '#fff' }]}>{asset.id}</Text>
            <Text style={[T.text(theme.font.lg, 'rgba(255,255,255,0.85)')]}>{asset.model}</Text>
          </View>
        </View>

        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          {/* Health */}
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <Text style={[T.display(theme.font.lg)]}>Saúde do ativo</Text>
              <Text style={[T.display(theme.font.xl), { color: asset.health > 80 ? theme.colors.success : asset.health > 65 ? theme.colors.warning : theme.colors.error }]}>{asset.health}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${asset.health}%`, backgroundColor: asset.health > 80 ? theme.colors.success : asset.health > 65 ? theme.colors.warning : theme.colors.error }]} />
            </View>
          </Card>

          {/* Specs */}
          <View style={styles.grid}>
            {specs.map(s => (
              <Card key={s.label} style={styles.spec}>
                <Ionicons name={s.icon as any} size={18} color={theme.colors.brandSecondary} />
                <Text style={[T.text(theme.font.sm, theme.colors.muted)]}>{s.label}</Text>
                <Text style={[T.display(theme.font.lg)]}>{s.value}</Text>
              </Card>
            ))}
          </View>

          {/* Maintenance timeline (mock) */}
          <Card>
            <Text style={[T.display(theme.font.lg), { marginBottom: theme.spacing.md }]}>Plano de manutenção</Text>
            {[
              { t: 'Revisão dos 180k km', d: 'Agendada • 22 jun 2026', tone: 'pending' },
              { t: 'Troca de óleo e filtros', d: 'Concluída • 03 mai 2026', tone: 'success' },
              { t: 'Calibragem e pneus', d: 'Concluída • 12 abr 2026', tone: 'success' },
            ].map((m, i, arr) => (
              <View key={i} style={styles.tl}>
                <View style={styles.tlLine}>
                  <View style={[styles.tlDot, { backgroundColor: m.tone === 'success' ? theme.colors.success : theme.colors.warning }]} />
                  {i < arr.length - 1 && <View style={styles.tlBar} />}
                </View>
                <View style={{ flex: 1, paddingBottom: theme.spacing.md }}>
                  <Text style={[T.text(theme.font.base, theme.colors.onSurface), { fontWeight: '600' }]}>{m.t}</Text>
                  <Text style={[T.text(theme.font.sm, theme.colors.onSurfaceTertiary)]}>{m.d}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { width: '100%', height: 300, backgroundColor: theme.colors.surfaceSecondary },
  heroBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg },
  round: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroInfo: { position: 'absolute', bottom: theme.spacing.lg, left: theme.spacing.lg },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  spec: { width: '47%', flexGrow: 1, gap: 4 },
  tl: { flexDirection: 'row', gap: theme.spacing.md },
  tlLine: { alignItems: 'center', width: 14 },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  tlBar: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 2 },
});
