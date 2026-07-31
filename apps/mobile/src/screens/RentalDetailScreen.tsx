import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  fetchMyRentals,
  fetchMyRentalCustomerId,
  fetchServiceRequests,
  createServiceRequest,
  type Rental,
  type ServiceRequest,
} from "../lib/rentals";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "RentalDetail">;

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
  expired: "Expirado",
  terminated: "Encerrado",
  suspended: "Suspenso",
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  resolved: "Resolvido",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export function RentalDetailScreen({ route }: Props) {
  const { rentalId } = route.params;
  const [rental, setRental] = useState<Rental | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"extension" | "issue" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchMyRentals(), fetchServiceRequests(rentalId)])
      .then(([rentals, reqs]) => {
        setRental(rentals.find((r) => r.id === rentalId) ?? null);
        setRequests(reqs);
      })
      .catch((err: Error) => Alert.alert("Erro", err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSubmit(type: "extension" | "issue") {
    if (!rental || !message.trim()) return;
    setSubmitting(type);
    try {
      const rentalCustomerId = await fetchMyRentalCustomerId();
      await createServiceRequest({
        tenantContractId: rental.id,
        rentalCustomerId,
        tenantId: rental.tenant_id,
        type,
        message: message.trim(),
      });
      setMessage("");
      load();
      Alert.alert("Enviado", "Seu pedido foi enviado ao locador.");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao enviar pedido");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading || !rental) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{STATUS_LABEL[rental.status] ?? rental.status}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Período</Text>
        <Text style={styles.value}>
          {formatDate(rental.period_starts_at)} — {formatDate(rental.period_ends_at)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Valor</Text>
        <Text style={styles.value}>
          {formatCurrency(Number(rental.value_amount), rental.value_currency)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ativos</Text>
        {rental.contract_assets.map((ca) => (
          <Text key={ca.id} style={styles.value}>
            {ca.assets?.name ?? "—"} (qtd: {ca.quantity})
          </Text>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Solicitar</Text>
      <TextInput
        style={styles.input}
        placeholder="Descreva o problema ou o pedido de prorrogação..."
        placeholderTextColor="#94A3B8"
        multiline
        numberOfLines={4}
        value={message}
        onChangeText={setMessage}
      />
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.actionButton, styles.issueButton]}
          disabled={!!submitting || !message.trim()}
          onPress={() => void handleSubmit("issue")}
        >
          {submitting === "issue" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Reportar problema</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.extensionButton]}
          disabled={!!submitting || !message.trim()}
          onPress={() => void handleSubmit("extension")}
        >
          {submitting === "extension" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Pedir prorrogação</Text>
          )}
        </Pressable>
      </View>

      {requests.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Histórico de pedidos</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestType}>
                  {r.type === "extension" ? "Prorrogação" : "Problema"}
                </Text>
                <Text style={styles.requestStatus}>{REQUEST_STATUS_LABEL[r.status]}</Text>
              </View>
              <Text style={styles.requestMessage}>{r.message}</Text>
              <Text style={styles.requestDate}>{formatDate(r.created_at)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  section: { marginBottom: 16 },
  label: { fontSize: 12, color: "#64748B", marginBottom: 2 },
  value: { fontSize: 15, color: "#0F172A", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 90,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  issueButton: { backgroundColor: "#DC2626" },
  extensionButton: { backgroundColor: "#2563EB" },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  requestCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestHeader: { flexDirection: "row", justifyContent: "space-between" },
  requestType: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  requestStatus: { fontSize: 12, fontWeight: "600", color: "#2563EB" },
  requestMessage: { fontSize: 13, color: "#334155", marginTop: 4 },
  requestDate: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
