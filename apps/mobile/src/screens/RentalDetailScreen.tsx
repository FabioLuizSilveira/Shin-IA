import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
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

// Restyled to match the shared design system (see RentalsListScreen).
export function RentalDetailScreen({ route, navigation }: Props) {
  const { rentalId } = route.params;
  const [rental, setRental] = useState<Rental | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleReportIssue() {
    if (!rental || !message.trim()) return;
    setSubmitting(true);
    try {
      const rentalCustomerId = await fetchMyRentalCustomerId();
      await createServiceRequest({
        tenantContractId: rental.id,
        rentalCustomerId,
        tenantId: rental.tenant_id,
        type: "issue",
        message: message.trim(),
      });
      setMessage("");
      load();
      Alert.alert("Enviado", "Seu pedido foi enviado ao locador.");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !rental) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title="Detalhe da Locação" />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.xl)}>
              {formatCurrency(Number(rental.value_amount), rental.value_currency)}
            </Text>
            <Chip status={rental.status} />
          </View>
          <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
            {formatDate(rental.period_starts_at)} — {formatDate(rental.period_ends_at)}
          </Text>
        </Card>

        <Card>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>ATIVOS</Text>
          {rental.contract_assets.map((ca) => (
            <Text key={ca.id} style={[T.text(), { marginTop: theme.spacing.xs }]}>
              {ca.assets?.name ?? "—"} (qtd: {ca.quantity})
            </Text>
          ))}
        </Card>

        {rental.status === "active" && (
          <GradientButton
            label="Renovar contrato"
            onPress={() => navigation.navigate("Renewal", { rentalId: rental.id })}
          />
        )}

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>SOLICITAR</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontFamily: theme.text,
              fontSize: theme.font.base,
              color: theme.colors.onSurface,
              textAlignVertical: "top",
              minHeight: 90,
            }}
            placeholder="Descreva o problema ou o pedido de prorrogação..."
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
          />
          <GradientButton
            label={submitting ? "Enviando..." : "Reportar problema"}
            onPress={() => void handleReportIssue()}
            loading={submitting}
            colors={[theme.colors.error, theme.colors.error] as const}
          />
        </Card>

        {requests.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={T.display(theme.font.lg)}>Histórico de pedidos</Text>
            {requests.map((r) => (
              <Card key={r.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={T.text(theme.font.base, theme.colors.onSurfaceSecondary)}>
                    {r.type === "extension" ? "Prorrogação" : "Problema"}
                  </Text>
                  <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
                    {REQUEST_STATUS_LABEL[r.status]}
                  </Text>
                </View>
                <Text style={[T.text(), { marginTop: theme.spacing.xs }]}>{r.message}</Text>
                <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
                  {formatDate(r.created_at)}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
