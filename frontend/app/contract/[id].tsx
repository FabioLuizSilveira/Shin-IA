import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { theme } from '@/src/theme';
import { api, apiBaseUrl } from '@/src/api/client';
import { useAuth } from '@/src/context/auth';
import { Card, StatusBadge, Loader, PrimaryButton } from '@/src/components/ui';
import { storage } from '@/src/utils/storage';

type Tab = 'overview' | 'payments' | 'maintenance' | 'chat';

export default function ContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [contract, setContract] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [signOpen, setSignOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [signName, setSignName] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const c = await api<any>(`/contracts/${id}`);
      setContract(c);
      const [pays, ms, msgs] = await Promise.all([
        api<{ items: any[] }>(`/payments?contract_id=${id}`),
        api<{ items: any[] }>(`/maintenance?vehicle_id=${c.vehicle_id}`),
        api<{ items: any[] }>(`/messages/${id}`),
      ]);
      setPayments(pays.items || []);
      setMaintenance(ms.items || []);
      setMessages(msgs.items || []);
      setPayAmount(String(c.monthly_amount || ''));
      setSignName(user?.name || '');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setLoading(false);
  }, [id, user?.name]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (tab !== 'chat') return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ items: any[] }>(`/messages/${id}`);
        setMessages(r.items || []);
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [tab, id]);

  const sign = async () => {
    if (!signName.trim()) return;
    try {
      await api(`/contracts/${id}/sign`, { method: 'POST', body: { signature_data: signName.trim() } });
      setSignOpen(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  const registerPayment = async (method: 'pix' | 'manual' | 'stripe') => {
    const amount = Number(payAmount);
    if (!amount) { Alert.alert('Informe o valor'); return; }
    try {
      if (method === 'stripe') {
        const r = await api<{ url: string }>('/payments/stripe-checkout', {
          method: 'POST', body: { contract_id: id, amount, method: 'stripe' },
        });
        await WebBrowser.openBrowserAsync(r.url);
      } else {
        await api('/payments', { method: 'POST', body: { contract_id: id, amount, method } });
        load();
      }
      setPayOpen(false);
    } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  const openPdf = async () => {
    const token = await storage.getItem('auth_token');
    const url = `${apiBaseUrl()}/contracts/${id}/pdf`;
    // Basic open (auth via header not possible directly in browser). Fallback: use fetch and download as blob is complex on native.
    // Simpler: show a modal informing user or open directly (backend allows any auth'd — we'll use a query token approach if needed later)
    Alert.alert('Contrato em PDF', `Endpoint disponível: ${url}\nNa produção, use o app ou o navegador com autenticação.\nToken: ${token?.slice(0, 20)}...`);
  };

  const sendMsg = async () => {
    if (!msg.trim() || !contract) return;
    const other = user?.user_id === contract.locador_id ? contract.locatario_id : contract.locador_id;
    try {
      await api('/messages', { method: 'POST', body: { contract_id: id, to_user_id: other, text: msg.trim() } });
      setMsg('');
      const r = await api<{ items: any[] }>(`/messages/${id}`);
      setMessages(r.items || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  if (loading || !contract) return <SafeAreaView style={styles.container}><Loader /></SafeAreaView>;

  const veh = contract.vehicle || {};
  const mySignField = user?.user_id === contract.locador_id ? 'signature_locador' : 'signature_locatario';
  const alreadySigned = !!contract[mySignField];

  return (
    <View style={styles.container}>
      <View>
        <Image source={{ uri: veh.photo_url }} style={styles.hero} contentFit="cover" />
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill as any} />
        <SafeAreaView edges={['top']} style={styles.heroBar}>
          <Pressable testID="back-btn" style={styles.roundBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <StatusBadge status={contract.status} />
        </SafeAreaView>
        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle}>{veh.make} {veh.model}</Text>
          <Text style={styles.heroSub}>{veh.plate} • Contrato {contract.contract_id.slice(-6)}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['overview', 'payments', 'maintenance', 'chat'] as Tab[]).map(t => (
          <Pressable key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'overview' ? 'Resumo' : t === 'payments' ? 'Pagamentos' : t === 'maintenance' ? 'Manutenção' : 'Chat'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 140 }}>
          <Card>
            <Text style={styles.section}>Prazo</Text>
            <Text style={styles.body}>De {contract.start_date?.slice(0, 10)} até {contract.end_date?.slice(0, 10)}</Text>
          </Card>
          <Card>
            <Text style={styles.section}>Valores</Text>
            <Text style={styles.body}>Mensalidade: R$ {contract.monthly_amount?.toFixed(2)}</Text>
            <Text style={styles.body}>Caução: R$ {contract.deposit?.toFixed(2)}</Text>
          </Card>
          <Card>
            <Text style={styles.section}>Partes</Text>
            <Text style={styles.body}>Locador: {contract.locador?.name}</Text>
            <Text style={styles.body}>Locatário: {contract.locatario?.name}</Text>
          </Card>
          <Card>
            <Text style={styles.section}>Termos</Text>
            <Text style={styles.body}>{contract.terms || '—'}</Text>
          </Card>
          <Card>
            <Text style={styles.section}>Assinaturas</Text>
            <Text style={styles.body}>Locador: {contract.signature_locador ? `✓ ${contract.signature_locador.data}` : 'Pendente'}</Text>
            <Text style={styles.body}>Locatário: {contract.signature_locatario ? `✓ ${contract.signature_locatario.data}` : 'Pendente'}</Text>
          </Card>
          <Pressable testID="pdf-btn" onPress={openPdf} style={styles.linkRow}>
            <Ionicons name="document-outline" size={18} color={theme.colors.brandPrimary} />
            <Text style={styles.link}>Ver contrato em PDF</Text>
          </Pressable>
        </ScrollView>
      )}

      {tab === 'payments' && (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 140 }}>
          {payments.length === 0 ? (
            <Card><Text style={styles.muted}>Nenhum pagamento registrado.</Text></Card>
          ) : payments.map(p => (
            <Card key={p.payment_id}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.itemTitle}>R$ {p.amount?.toFixed(2)}</Text>
                  <Text style={styles.sub}>{p.method.toUpperCase()} • {new Date(p.created_at).toLocaleDateString('pt-BR')}</Text>
                  {!!p.note && <Text style={styles.sub}>{p.note}</Text>}
                </View>
                <StatusBadge status={p.status} />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {tab === 'maintenance' && (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 140 }}>
          {maintenance.length === 0 ? (
            <Card><Text style={styles.muted}>Nenhuma manutenção agendada.</Text></Card>
          ) : maintenance.map(m => (
            <Card key={m.maintenance_id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{m.kind}</Text>
                  <Text style={styles.sub}>Agendada: {m.scheduled_date?.slice(0, 10)}</Text>
                  {!!m.cost && <Text style={styles.sub}>R$ {m.cost?.toFixed(2)}</Text>}
                  {!!m.notes && <Text style={styles.sub}>{m.notes}</Text>}
                </View>
                <StatusBadge status={m.status} />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {tab === 'chat' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={80}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && <Text style={styles.muted}>Comece a conversa com a outra parte.</Text>}
            {messages.map(m => {
              const mine = m.from_user_id === user?.user_id;
              return (
                <View key={m.message_id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, mine && { color: theme.colors.onBrandPrimary }]}>{m.text}</Text>
                  <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.chatBar}>
            <TextInput
              testID="chat-input"
              value={msg}
              onChangeText={setMsg}
              placeholder="Escreva uma mensagem"
              placeholderTextColor={theme.colors.onSurfaceTertiary}
              style={styles.chatInput}
            />
            <Pressable testID="chat-send" onPress={sendMsg} style={styles.sendBtn}>
              <Ionicons name="send" size={18} color={theme.colors.onBrandPrimary} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {tab !== 'chat' && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
            {!alreadySigned && (
              <PrimaryButton testID="sign-btn" label="Assinar contrato" onPress={() => setSignOpen(true)} style={{ flex: 1 }} />
            )}
            <PrimaryButton testID="pay-btn" label="Pagar" onPress={() => setPayOpen(true)} style={{ flex: 1, backgroundColor: theme.colors.brandSecondary }} />
          </View>
        </SafeAreaView>
      )}

      <Modal visible={signOpen} transparent animationType="fade" onRequestClose={() => setSignOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.section}>Assinatura digital</Text>
            <Text style={styles.body}>Digite seu nome completo para assinar o contrato eletronicamente.</Text>
            <TextInput testID="sign-input" value={signName} onChangeText={setSignName} style={styles.input} placeholder="Seu nome completo" placeholderTextColor={theme.colors.onSurfaceTertiary} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Pressable onPress={() => setSignOpen(false)} style={[styles.ghostBtn, { flex: 1 }]}><Text>Cancelar</Text></Pressable>
              <PrimaryButton testID="confirm-sign-btn" label="Assinar" onPress={sign} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={payOpen} transparent animationType="fade" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.section}>Registrar pagamento</Text>
            <TextInput testID="pay-amount-input" value={payAmount} onChangeText={setPayAmount} style={styles.input} keyboardType="numeric" placeholder="Valor (R$)" placeholderTextColor={theme.colors.onSurfaceTertiary} />
            <PrimaryButton testID="pay-pix-btn" label="Marcar como pago (PIX)" onPress={() => registerPayment('pix')} />
            <PrimaryButton testID="pay-manual-btn" label="Marcar como pago (manual)" onPress={() => registerPayment('manual')} style={{ backgroundColor: theme.colors.brandSecondary }} />
            <PrimaryButton testID="pay-stripe-btn" label="Pagar com Stripe" onPress={() => registerPayment('stripe')} style={{ backgroundColor: '#635BFF' }} />
            <Pressable onPress={() => setPayOpen(false)} style={styles.ghostBtn}><Text>Cancelar</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { width: '100%', height: 220, backgroundColor: theme.colors.surfaceTertiary },
  heroBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroInfo: { position: 'absolute', bottom: 12, left: theme.spacing.lg, right: theme.spacing.lg },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '500' },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  roundBtn: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brandPrimary },
  tabText: { color: theme.colors.onSurfaceSecondary, fontWeight: '500', fontSize: theme.font.sm },
  tabTextActive: { color: theme.colors.onBrandPrimary },
  section: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface, marginBottom: 6 },
  body: { color: theme.colors.onSurfaceSecondary, fontSize: theme.font.base, lineHeight: 22 },
  itemTitle: { fontSize: theme.font.lg, fontWeight: '500', color: theme.colors.onSurface },
  sub: { color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  muted: { color: theme.colors.onSurfaceTertiary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  link: { color: theme.colors.brandPrimary, fontWeight: '500' },
  footer: { backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, gap: theme.spacing.md },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 12, color: theme.colors.onSurface, fontSize: theme.font.lg, borderWidth: 1, borderColor: theme.colors.border },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: theme.radius.md },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: theme.colors.brandPrimary },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  bubbleText: { color: theme.colors.onSurface, fontSize: theme.font.base },
  bubbleTime: { fontSize: 10, color: theme.colors.onSurfaceTertiary, marginTop: 2, alignSelf: 'flex-end' },
  chatBar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  chatInput: { flex: 1, backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: 10, color: theme.colors.onSurface },
  sendBtn: { width: 42, height: 42, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
