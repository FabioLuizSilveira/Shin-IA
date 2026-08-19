import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T, Loader, EmptyState, GradientButton } from "../components/ui";
import { fetchMyRentals, fetchMyInvoices, type Rental, type CustomerInvoice } from "../lib/rentals";
import { useAuth } from "../lib/auth-context";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "RentalsList">;

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

// Restyled to match the rest of the app (Card/ScreenHeader/Chip/T from the
// shared design system) — this and RentalDetailScreen were the only
// customer-facing screens still using the pre-M22 ad hoc styling. Also adds
// the "tela inicial" requirements: a payment/faturas summary right here
// (invoices_select_rental_customer, 20260090000000) and a "Renovar
// contrato" entry point per active rental leading to RenewalScreen.
export function RentalsListScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    Promise.all([fetchMyRentals(), fetchMyInvoices()])
      .then(([r, i]) => {
        setRentals(r);
        setInvoices(i);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pending = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const currency = invoices[0]?.total_currency ?? "BRL";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <ScreenHeader title="Minhas Locações" subtitle="Shinã" brand />

      {loading ? (
        <Loader />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Não foi possível carregar"
          subtitle={error}
        />
      ) : (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          {invoices.length > 0 && (
            <Pressable onPress={() => navigation.navigate("CustomerInvoices")}>
              <Card>
                <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>PAGAMENTOS</Text>
                <Text style={[T.display(theme.font.xxl), { marginTop: theme.spacing.xs }]}>
                  {formatCurrency(pendingTotal, currency)}
                </Text>
                <Text style={T.text(theme.font.sm)}>
                  {overdue.length > 0
                    ? `${overdue.length} fatura(s) em atraso`
                    : pending.length > 0
                      ? `${pending.length} fatura(s) a pagar`
                      : "Nenhuma fatura pendente"}
                </Text>
              </Card>
            </Pressable>
          )}

          {rentals.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title="Nenhuma locação"
              subtitle="Suas locações aparecerão aqui."
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {rentals.map((rental) => (
                <Card key={rental.id}>
                  <Pressable
                    onPress={() => navigation.navigate("RentalDetail", { rentalId: rental.id })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={T.display(theme.font.lg)}>
                        {rental.contract_assets[0]?.assets?.name ?? "Locação"}
                        {rental.contract_assets.length > 1
                          ? ` +${rental.contract_assets.length - 1}`
                          : ""}
                      </Text>
                      <Chip status={rental.status} />
                    </View>
                    <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
                      {formatDate(rental.period_starts_at)} — {formatDate(rental.period_ends_at)}
                    </Text>
                    <Text style={[T.text(theme.font.base, theme.colors.onSurfaceSecondary)]}>
                      {formatCurrency(Number(rental.value_amount), rental.value_currency)}/semana
                    </Text>
                  </Pressable>
                  {rental.status === "active" && (
                    <GradientButton
                      label="Renovar contrato"
                      onPress={() => navigation.navigate("Renewal", { rentalId: rental.id })}
                      style={{ marginTop: theme.spacing.md }}
                    />
                  )}
                </Card>
              ))}
            </View>
          )}

          <GradientButton
            label="Sair"
            colors={[theme.colors.error, theme.colors.error] as const}
            onPress={() => void signOut()}
          />
        </View>
      )}
    </ScrollView>
  );
}
