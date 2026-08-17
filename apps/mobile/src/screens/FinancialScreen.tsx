import { useCallback } from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type BillingSummary } from "../lib/shinaia-api";

const brl = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

// M23 — GET /api/mobile/billing/summary (Wave 4 Phase A). tenant_user needs
// tenant.dashboard.financial permission server-side; customer sees their
// own by ownership. A 403 here means "no financial permission", surfaced
// via AsyncScreen's error state, not a silently empty screen.
export function FinancialScreen() {
  const fetcher = useCallback(() => shinaia.billingSummary(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher, () => false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Financeiro" subtitle="Resumo" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Sem dados financeiros"
      >
        {(summary: BillingSummary) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <Card>
              <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>A RECEBER</Text>
              <Text style={T.display(theme.font.xxxl)}>
                {brl(summary.receivables.amount, summary.receivables.currency)}
              </Text>
              <Text style={T.text(theme.font.sm)}>{summary.receivables.count} fatura(s)</Text>
            </Card>
            <Card>
              <Text style={T.text(theme.font.sm, theme.colors.error)}>VENCIDO</Text>
              <Text style={T.display(theme.font.xxl)}>
                {brl(summary.overdue.amount, summary.overdue.currency)}
              </Text>
              <Text style={T.text(theme.font.sm)}>{summary.overdue.count} fatura(s)</Text>
            </Card>
            <Card>
              <Text style={T.text(theme.font.sm, theme.colors.success)}>PAGO ESTE MÊS</Text>
              <Text style={T.display(theme.font.xxl)}>
                {brl(summary.paid.amount, summary.paid.currency)}
              </Text>
            </Card>
            {summary.nextDue && (
              <Card>
                <Text style={T.text(theme.font.sm)}>Próximo vencimento</Text>
                <Text style={T.display(theme.font.lg)}>
                  {brl(summary.nextDue.amount, summary.nextDue.currency)} em{" "}
                  {new Date(summary.nextDue.dueDate).toLocaleDateString("pt-BR")}
                </Text>
              </Card>
            )}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
