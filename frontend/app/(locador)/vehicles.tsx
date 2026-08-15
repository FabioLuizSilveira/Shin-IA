import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Card, ScreenHeader, StatusBadge, EmptyState, PrimaryButton, Loader } from '@/src/components/ui';

const STATUS_FILTERS = ['all', 'available', 'rented', 'maintenance'] as const;

export default function VehiclesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ make: '', model: '', year: '2024', plate: '', color: '', daily_rate: '150', photo_url: '', mileage_km: '0', fuel: 'Flex', transmission: 'Automático', description: '' });

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: any[] }>('/vehicles?mine=true');
      setItems(res.items || []);
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter(v => filter === 'all' || v.status === filter);

  const submit = async () => {
    if (!form.make || !form.model || !form.plate) { Alert.alert('Preencha marca, modelo e placa'); return; }
    setSaving(true);
    try {
      await api('/vehicles', {
        method: 'POST',
        body: {
          make: form.make, model: form.model, year: Number(form.year) || 2024,
          plate: form.plate.toUpperCase(), color: form.color, daily_rate: Number(form.daily_rate) || 0,
          photo_url: form.photo_url || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
          mileage_km: Number(form.mileage_km) || 0, fuel: form.fuel, transmission: form.transmission,
          description: form.description,
        },
      });
      setShowForm(false);
      setForm({ make: '', model: '', year: '2024', plate: '', color: '', daily_rate: '150', photo_url: '', mileage_km: '0', fuel: 'Flex', transmission: 'Automático', description: '' });
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Minha frota"
        subtitle={`${items.length} veículo(s)`}
        right={
          <Pressable testID="add-vehicle-btn" style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={22} color={theme.colors.onBrandPrimary} />
          </Pressable>
        }
      />
      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {STATUS_FILTERS.map(s => (
            <Pressable
              key={s}
              testID={`filter-${s}`}
              onPress={() => setFilter(s)}
              style={[styles.chip, filter === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
                {s === 'all' ? 'Todos' : s === 'available' ? 'Disponíveis' : s === 'rented' ? 'Alugados' : 'Manutenção'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState
          icon="car-sport-outline"
          title="Nenhum veículo"
          subtitle="Adicione seu primeiro veículo à frota"
          actionLabel="Adicionar veículo"
          testID="empty-add-vehicle"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.vehicle_id}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md }}
          renderItem={({ item }) => (
            <Pressable testID={`vehicle-card-${item.vehicle_id}`} onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: item.vehicle_id } })}>
              <Card>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  <Image source={{ uri: item.photo_url }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.title}>{item.make} {item.model}</Text>
                    <Text style={styles.sub}>{item.year} • {item.plate}</Text>
                    <Text style={styles.sub}>{item.mileage_km?.toLocaleString('pt-BR')} km • R$ {item.daily_rate}/dia</Text>
                    <StatusBadge status={item.status} />
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Novo veículo</Text>
            <Pressable testID="close-form-btn" onPress={() => setShowForm(false)}><Ionicons name="close" size={24} color={theme.colors.onSurface} /></Pressable>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
              {[
                ['make', 'Marca (ex: Toyota)'], ['model', 'Modelo (ex: Corolla)'],
                ['year', 'Ano'], ['plate', 'Placa'], ['color', 'Cor'],
                ['daily_rate', 'Diária (R$)'], ['mileage_km', 'Km atual'],
                ['photo_url', 'URL da foto (opcional)'],
                ['fuel', 'Combustível'], ['transmission', 'Câmbio'],
                ['description', 'Descrição'],
              ].map(([key, label]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    testID={`input-${key}`}
                    value={(form as any)[key]}
                    onChangeText={(t) => setForm(f => ({ ...f, [key]: t }))}
                    style={styles.input}
                    placeholder={label}
                    placeholderTextColor={theme.colors.onSurfaceTertiary}
                    keyboardType={['year', 'daily_rate', 'mileage_km'].includes(key as string) ? 'numeric' : 'default'}
                    autoCapitalize={key === 'plate' ? 'characters' : 'sentences'}
                  />
                </View>
              ))}
              <PrimaryButton testID="save-vehicle-btn" label="Salvar veículo" onPress={submit} loading={saving} />
              <View style={{ height: theme.spacing.xxl }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  addBtn: {
    width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  chipRow: { height: 56, justifyContent: 'center' },
  chipsContainer: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, alignItems: 'center' },
  chip: {
    height: 36, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { color: theme.colors.onSurfaceSecondary, fontWeight: '500' },
  chipTextActive: { color: theme.colors.onBrandPrimary },
  thumb: { width: 96, height: 96, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceTertiary },
  title: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.base },
  modalHead: {
    padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '500', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm, marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: 12, color: theme.colors.onSurface, fontSize: theme.font.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
});
