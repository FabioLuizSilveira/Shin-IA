import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Card, ScreenHeader, StatusBadge, EmptyState, PrimaryButton, Loader } from '@/src/components/ui';

export default function LocadorContracts() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: '', locatario_email: '', start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    monthly_amount: '2500', deposit: '1000', terms: 'Locação mensal. Combustível por conta do locatário.',
  });

  const load = useCallback(async () => {
    try {
      const [c, v] = await Promise.all([
        api<{ items: any[] }>('/contracts'),
        api<{ items: any[] }>('/vehicles?mine=true'),
      ]);
      setItems(c.items || []);
      setVehicles((v.items || []).filter((x: any) => x.status !== 'maintenance'));
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!form.vehicle_id || !form.locatario_email) { Alert.alert('Escolha o veículo e informe o e-mail do locatário'); return; }
    setSaving(true);
    try {
      await api('/contracts', {
        method: 'POST',
        body: {
          vehicle_id: form.vehicle_id,
          locatario_email: form.locatario_email.trim(),
          start_date: form.start_date, end_date: form.end_date,
          monthly_amount: Number(form.monthly_amount) || 0,
          deposit: Number(form.deposit) || 0,
          terms: form.terms,
        },
      });
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Contratos"
        subtitle={`${items.length} contrato(s)`}
        right={
          <Pressable testID="new-contract-btn" style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={22} color={theme.colors.onBrandPrimary} />
          </Pressable>
        }
      />
      {loading ? <Loader /> : items.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Sem contratos" subtitle="Crie um novo contrato para um dos seus veículos" actionLabel="Criar contrato" onAction={() => setShowForm(true)} testID="empty-new-contract" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.contract_id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
          renderItem={({ item }) => (
            <Pressable testID={`contract-${item.contract_id}`} onPress={() => router.push({ pathname: '/contract/[id]', params: { id: item.contract_id } })}>
              <Card>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.vehicle?.make} {item.vehicle?.model}</Text>
                    <Text style={styles.sub}>{item.vehicle?.plate}</Text>
                    <Text style={styles.sub}>{item.start_date?.slice(0, 10)} → {item.end_date?.slice(0, 10)}</Text>
                    <Text style={styles.price}>R$ {item.monthly_amount?.toFixed(0)}/mês</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Novo contrato</Text>
            <Pressable onPress={() => setShowForm(false)} testID="close-contract-form"><Ionicons name="close" size={24} /></Pressable>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
              <Text style={styles.label}>Veículo</Text>
              <View style={{ gap: theme.spacing.sm }}>
                {vehicles.map(v => (
                  <Pressable
                    key={v.vehicle_id}
                    testID={`pick-vehicle-${v.vehicle_id}`}
                    onPress={() => setForm(f => ({ ...f, vehicle_id: v.vehicle_id }))}
                    style={[styles.vehiclePick, form.vehicle_id === v.vehicle_id && styles.vehiclePickActive]}>
                    <Text style={[styles.vehiclePickText, form.vehicle_id === v.vehicle_id && { color: theme.colors.onBrandPrimary }]}>
                      {v.make} {v.model} • {v.plate}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {[
                ['locatario_email', 'E-mail do locatário'],
                ['start_date', 'Data início (YYYY-MM-DD)'],
                ['end_date', 'Data fim (YYYY-MM-DD)'],
                ['monthly_amount', 'Mensalidade (R$)'],
                ['deposit', 'Caução (R$)'],
                ['terms', 'Termos'],
              ].map(([key, label]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    testID={`input-${key}`}
                    value={(form as any)[key]}
                    onChangeText={(t) => setForm(f => ({ ...f, [key]: t }))}
                    style={[styles.input, key === 'terms' && { height: 90 }]}
                    placeholder={label}
                    placeholderTextColor={theme.colors.onSurfaceTertiary}
                    multiline={key === 'terms'}
                    keyboardType={['monthly_amount', 'deposit'].includes(key as string) ? 'numeric' : 'default'}
                    autoCapitalize={key === 'locatario_email' ? 'none' : 'sentences'}
                  />
                </View>
              ))}
              <PrimaryButton testID="save-contract-btn" label="Criar contrato" onPress={submit} loading={saving} />
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
  addBtn: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  title: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  price: { color: theme.colors.brandPrimary, fontWeight: '500', marginTop: 4 },
  modalHead: { padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: theme.font.xl, fontWeight: '500' },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: theme.font.sm, marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 12, color: theme.colors.onSurface, fontSize: theme.font.lg, borderWidth: 1, borderColor: theme.colors.border },
  vehiclePick: { padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  vehiclePickActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  vehiclePickText: { color: theme.colors.onSurface, fontWeight: '500' },
});
