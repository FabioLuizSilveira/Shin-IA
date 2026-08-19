import { useCallback, useMemo } from "react";
import { View, Text } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type InvoiceItem } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

const brl = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

const FILTER_TITLE: Record<string, string> = {
  issued: "A receber",
  overdue: "Vencidas",
  paid: "Pagas",
};

// GET /api/mobile/invoices — the flat list behind FinancialScreen's
// summary cards. statusFilter is applied client-side (the endpoint always
// returns the full tenant-scoped list), matching how the summary cards
// themselves are just aggregates of this same data.
export function InvoicesScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Invoices">>();
  const statusFilter = route.params?.statusFilter;

  const fetcher = useCallback(() => shinaia.invoices(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader
        title="Faturas"
        subtitle={statusFilter ? FILTER_TITLE[statusFilter] : "Todas"}
      />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma fatura"
      >
        {(invoices: InvoiceItem[]) => (
          <InvoiceList invoices={invoices} statusFilter={statusFilter} />
        )}
      </AsyncScreen>
    </View>
  );
}

function InvoiceList({
  invoices,
  statusFilter,
}: {
  invoices: InvoiceItem[];
  statusFilter?: "issued" | "overdue" | "paid";
}) {
  const filtered = useMemo(
    () => (statusFilter ? invoices.filter((i) => i.status === statusFilter) : invoices),
    [invoices, statusFilter],
  );

  if (filtered.length === 0) {
    return (
      <View style={{ padding: theme.spacing.xl, alignItems: "center" }}>
        <Text style={T.text()}>Nenhuma fatura nesta categoria.</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {filtered.map((invoice) => (
        <Card key={invoice.id}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.lg)}>
              {brl(invoice.total_amount, invoice.total_currency)}
            </Text>
            <Chip status={invoice.status} />
          </View>
          <Text style={T.text(theme.font.sm)}>
            Vencimento: {new Date(invoice.due_date).toLocaleDateString("pt-BR")}
          </Text>
          {invoice.paid_at && (
            <Text style={T.text(theme.font.sm)}>
              Pago em {new Date(invoice.paid_at).toLocaleDateString("pt-BR")}
            </Text>
          )}
        </Card>
      ))}
    </View>
  );
}
