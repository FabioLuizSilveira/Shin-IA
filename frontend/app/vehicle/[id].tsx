import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/auth';
import { Card, StatusBadge, Loader, PrimaryButton } from '@/src/components/ui';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<any>(null);
  const [maint, setMaint] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mForm, setMForm] = useState({ kind: 'Revisão', scheduled_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), notes: '', cost: '0' });

  const load = useCallback(async () => {
    try {
      const [v, m, l] = await Promise.all([
        api<any>(`/vehicles/${id}`),
        api<{ items: any[] }>(`/maintenance?vehicle_id=${id}`),
        api<any>(`/locations/${id}`).catch(() => null),
      ]);
      setVehicle(v); setMaint(m.items || []); setLocation(l);
    } catch {}
    setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveMaint = async () => {
    setSaving(true);
    try {
      await api('/maintenance', {
        method: 'POST',
        body: { vehicle_id: id, kind: mForm.kind, scheduled_date: mForm.scheduled_date, notes: mForm.notes, cost: Number(mForm.cost) || 0 },
      });
      setShowAddMaint(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const completeMaint = async (mid: string) => {
    try {
      await api(`/maintenance/${mid}`, { method: 'PUT', body: { status: 'completed', completion_date: new Date().toISOString() } });
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  if (loading || !vehicle) return <SafeAreaView style={styles.container}><Loader /></SafeAreaView>;

  const isOwner = user?.role === 'locador' && vehicle.owner_id === user.user_id;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
        <View>
          <Image source={{ uri: vehicle.photo_url }} style={styles.hero} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={styles.heroGrad} />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <Pressable testID="back-btn" style={styles.roundBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <StatusBadge status={vehicle.status} />
          </SafeAreaView>
        </View>

        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <View>
            <Text style={styles.title}>{vehicle.make} {vehicle.model}</Text>
            <Text style={styles.sub}>{vehicle.year} • {vehicle.plate} • {vehicle.color}</Text>
            <Text style={styles.price}>R$ {vehicle.daily_rate}<Text style={styles.priceSub}>/dia</Text></Text>
          </View>

          <View style={styles.specs}>
            <Spec icon="speedometer-outline" label="Km" value={vehicle.mileage_km?.toLocaleString('pt-BR')} />
            <Spec icon="water-outline" label="Combustível" value={vehicle.fuel || '—'} />
            <Spec icon="settings-outline" label="Câmbio" value={vehicle.transmission || '—'} />
            <Spec icon="calendar-outline" label="Ano" value={String(vehicle.year)} />
          </View>

          {!!vehicle.description && (
            <Card>
              <Text style={styles.section}>Sobre o veículo</Text>
              <Text style={styles.body}>{vehicle.description}</Text>
            </Card>
          )}

          {location && (
            <Card>
              <Text style={styles.section}>Localização (última posição)</Text>
              <View style={{ gap: 6 }}>
                <Text style={styles.body}>Lat: {location.lat?.toFixed(5)} • Lng: {location.lng?.toFixed(5)}</Text>
                <Text style={styles.mutedSm}>Atualizado: {location.updated_at ? new Date(location.updated_at).toLocaleString('pt-BR') : '—'}</Text>
                {location.mocked && <Text style={styles.mutedSm}>* SIMULADO (aguardando telemetria real)</Text>}
              </View>
            </Card>
          )}

          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.section}>Manutenções</Text>
              {isOwner && (
                <Pressable testID="add-maint-btn" onPress={() => setShowAddMaint(true)} style={styles.smallBtn}>
                  <Ionicons name="add" size={16} color={theme.colors.onBrandPrimary} />
                  <Text style={styles.smallBtnText}>Nova</Text>
                </Pressable>
              )}
            </View>
            {maint.length === 0 ? (
              <Card><Text style={styles.muted}>Nenhuma manutenção registrada.</Text></Card>
            ) : (
              maint.map(m => (
                <Card key={m.maintenance_id} style={{ marginBottom: theme.spacing.sm }}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{m.kind}</Text>
                      <Text style={styles.sub}>Agendada: {m.scheduled_date?.slice(0, 10)}</Text>
                      {!!m.cost && <Text style={styles.sub}>R$ {m.cost?.toFixed(2)}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <StatusBadge status={m.status} />
                      {isOwner && m.status !== 'completed' && (
                        <Pressable testID={`complete-maint-${m.maintenance_id}`} onPress={() => completeMaint(m.maintenance_id)}>
                          <Text style={styles.link}>Concluir</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={showAddMaint} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMaint(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Nova manutenção</Text>
            <Pressable onPress={() => setShowAddMaint(false)}><Ionicons name="close" size={24} /></Pressable>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
              {[
                ['kind', 'Tipo (ex: Revisão, Troca óleo)'],
                ['scheduled_date', 'Data (YYYY-MM-DD)'],
                ['cost', 'Custo estimado (R$)'],
                ['notes', 'Observações'],
              ].map(([k, l]) => (
                <View key={k}>
                  <Text style={styles.label}>{l}</Text>
                  <TextInput
                    testID={`input-${k}`}
                    value={(mForm as any)[k]}
                    onChangeText={t => setMForm(f => ({ ...f, [k]: t }))}
                    style={[styles.input, k === 'notes' && { height: 80 }]}
                    placeholder={l}
                    placeholderTextColor={theme.colors.onSurfaceTertiary}
                    keyboardType={k === 'cost' ? 'numeric' : 'default'}
                    multiline={k === 'notes'}
                  />
                </View>
              ))}
              <PrimaryButton testID="save-maint-btn" label="Salvar" onPress={saveMaint} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Spec({ icon, label, value }: any) {
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={18} color={theme.colors.brandPrimary} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { width: '100%', height: 280, backgroundColor: theme.colors.surfaceTertiary },
  heroGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  heroBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundBtn: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '500', color: theme.colors.onSurface, letterSpacing: -0.5 },
  sub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  price: { fontSize: 28, fontWeight: '500', color: theme.colors.brandPrimary, marginTop: theme.spacing.sm },
  priceSub: { fontSize: theme.font.base, color: theme.colors.onSurfaceTertiary, fontWeight: '400' },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  spec: { flex: 1, minWidth: '45%', backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  specLabel: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm },
  specValue: { color: theme.colors.onSurface, fontSize: theme.font.lg, fontWeight: '500' },
  section: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface, marginBottom: theme.spacing.sm },
  body: { color: theme.colors.onSurfaceSecondary, fontSize: theme.font.base, lineHeight: 22 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  smallBtnText: { color: theme.colors.onBrandPrimary, fontWeight: '500' },
  itemTitle: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  muted: { color: theme.colors.onSurfaceTertiary },
  mutedSm: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm },
  link: { color: theme.colors.brandPrimary, fontWeight: '500' },
  modalHead: { padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '500' },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm, marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 12, color: theme.colors.onSurface, fontSize: theme.font.lg, borderWidth: 1, borderColor: theme.colors.border },
});
