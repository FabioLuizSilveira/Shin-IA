import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, EmptyState } from "../components/ui";
import { fetchMyInvoices, type CustomerInvoice } from "../lib/rentals";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CustomerInvoicesScreen() {
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    fetchMyInvoices()
      .then(setInvoices)
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <BackHeader title="Pagamentos" />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {invoices.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Nenhuma fatura"
            subtitle="Suas faturas aparecerão aqui."
          />
        ) : (
          invoices.map((invoice) => (
            <Card key={invoice.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={T.display(theme.font.lg)}>
                  {formatCurrency(Number(invoice.total_amount), invoice.total_currency)}
                </Text>
                <Chip status={invoice.status} />
              </View>
              <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
                Vencimento: {formatDate(invoice.due_date)}
              </Text>
              {invoice.paid_at && (
                <Text style={T.text(theme.font.sm)}>Pago em {formatDate(invoice.paid_at)}</Text>
              )}
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}
