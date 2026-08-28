import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type InfractionCaseListItem } from "../lib/shinaia-api";
import { usePersona } from "../lib/persona-context";
import type { RootStackParamList } from "../navigation";

// Mobile screens phase (docs/architecture/INFRACTIONS_ENGINE.md) — mirrors
// InspectionsScreen's list pattern exactly, including the same
// staff/operator scope split. Unlike inspections, an operator here can't
// drill into a detail screen (no operator-scoped GET /:id route exists,
// item 47's self-service is a documented follow-up) — the list card
// itself carries enough info (plate/description/value/status), and only
// staff rows are pressable.
const STATUS_LABEL: Record<string, string> = {
  received: "Recebida",
  matching: "Vinculando ativo",
  unmatched: "Sem ativo",
  matched: "Ativo vinculado",
  responsibility_pending: "Responsabilidade pendente",
  responsibility_suggested: "Responsabilidade sugerida",
  responsibility_confirmed: "Responsabilidade confirmada",
  notified: "Notificado",
  action_pending: "Ação pendente",
  disputed: "Contestada",
  driver_identification_pending: "Indicação pendente",
  driver_identified: "Condutor indicado",
  defense_pending: "Defesa pendente",
  appealed: "Recurso",
  payment_pending: "Pagamento pendente",
  paid: "Paga",
  overdue: "Vencida",
  waived: "Perdoada",
  cancelled: "Cancelada",
  closed: "Encerrada",
};

const STATUS_TONE: Record<string, string> = {
  paid: "paid",
  responsibility_confirmed: "active",
  driver_identified: "active",
  disputed: "alert",
  unmatched: "alert",
  overdue: "alert",
  cancelled: "alert",
  waived: "completed",
  closed: "completed",
  responsibility_pending: "warning",
  responsibility_suggested: "warning",
  driver_identification_pending: "warning",
  defense_pending: "warning",
  appealed: "warning",
  payment_pending: "warning",
  action_pending: "warning",
};

function formatCents(cents: number | null, currency = "BRL"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function InfractionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bootstrap } = usePersona();
  const scope = bootstrap?.user.userType === "operator" ? "operator" : "staff";
  const fetcher = useCallback(() => shinaia.infractions({ scope }), [scope]);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader
        title="Infrações"
        subtitle={scope === "operator" ? "Vinculadas a mim" : undefined}
        brand
      />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma infração"
        emptySubtitle={
          scope === "operator"
            ? "Nenhuma infração vinculada a você no momento."
            : "Nenhuma infração registrada ainda."
        }
      >
        {(cases: InfractionCaseListItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {cases.map((item) => {
              const content = (
                <Card style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={T.display(theme.font.lg)}>{item.infractions.plate}</Text>
                    <Chip
                      status={STATUS_TONE[item.status] ?? "pending"}
                      label={STATUS_LABEL[item.status] ?? item.status}
                    />
                  </View>
                  <Text style={T.text(theme.font.sm)}>
                    {item.infractions.description ?? "Sem descrição"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 4,
                    }}
                  >
                    <Text style={T.text(theme.font.sm)}>
                      {new Date(item.infractions.occurred_at).toLocaleDateString("pt-BR")}
                    </Text>
                    <Text
                      style={[T.display(theme.font.sm), { color: theme.colors.brandSecondary }]}
                    >
                      {formatCents(item.infractions.amount_cents, item.infractions.amount_currency)}
                    </Text>
                  </View>
                </Card>
              );
              return scope === "staff" ? (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate("InfractionDetail", { caseId: item.id })}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={item.id}>{content}</View>
              );
            })}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
