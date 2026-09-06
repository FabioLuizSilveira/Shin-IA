import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type CustomerInfractionCaseDetail, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

// Self-service closure round (docs/architecture/INFRACTIONS_ENGINE.md) —
// closes the "qualquer tela de cliente" gap. Deliberately narrower than
// the staff detail screen: no payments, no other party's driver
// identification — only what GET /api/mobile/customer/infractions/:id
// actually returns. The only real action is disputing responsibility
// ("Eu não estava com o veículo" / "Não fui eu"), same
// infraction_disputes mechanism the staff web UI and the operator
// self-service route both use.
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

function formatCents(cents: number | null, currency = "BRL"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function CustomerInfractionDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "CustomerInfractionDetail">>();
  const { caseId } = route.params;
  const [busy, setBusy] = useState(false);
  const [disputeText, setDisputeText] = useState("");

  const fetcher = useCallback(() => shinaia.customerInfractionDetail(caseId), [caseId]);
  const { state, reload } = useAsyncData(fetcher, () => false);

  async function submitDispute() {
    setBusy(true);
    try {
      await shinaia.createCustomerInfractionDispute(caseId, { description: disputeText.trim() });
      setDisputeText("");
      void reload();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }
  if (state.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, padding: theme.spacing.xl }}>
        <Text style={T.text()}>
          {state.status === "error" ? state.message : "Infração não encontrada."}
        </Text>
      </View>
    );
  }

  const detail: CustomerInfractionCaseDetail = state.data;
  const c = detail.case;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title={c.infractions.auto_number ?? c.infractions.plate} />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.xl)}>{c.infractions.plate}</Text>
            <Chip status="warning" label={STATUS_LABEL[c.status] ?? c.status} />
          </View>
          <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
            {c.infractions.description ?? "Sem descrição"}
          </Text>
          <Text style={T.text(theme.font.sm)}>
            {new Date(c.infractions.occurred_at).toLocaleString("pt-BR")}
          </Text>
          <Text style={[T.display(theme.font.lg), { marginTop: theme.spacing.sm }]}>
            {formatCents(c.infractions.amount_cents, c.infractions.amount_currency)}
          </Text>
        </Card>

        {detail.deadlines.length > 0 && (
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>PRAZOS</Text>
            {detail.deadlines.map((d) => (
              <View
                key={d.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: theme.spacing.xs,
                }}
              >
                <Text style={T.text(theme.font.sm)}>{d.deadline_type}</Text>
                <Text style={T.text(theme.font.sm)}>
                  {d.due_at ? new Date(d.due_at).toLocaleDateString("pt-BR") : "—"}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>CONTESTAÇÃO</Text>
          <Text style={T.text(theme.font.sm)}>
            Se você não estava com o veículo no momento da infração, pode contestar aqui.
          </Text>
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
              minHeight: 70,
            }}
            placeholder="Descreva o motivo da contestação..."
            placeholderTextColor={theme.colors.muted}
            multiline
            value={disputeText}
            onChangeText={setDisputeText}
          />
          <GradientButton
            label="Contestar"
            loading={busy}
            disabled={!disputeText.trim()}
            colors={[theme.colors.error, theme.colors.error] as const}
            onPress={() => void submitDispute()}
          />
          {detail.disputes.length > 0 &&
            detail.disputes.map((d) => (
              <Text key={d.id} style={T.text(theme.font.sm)}>
                {d.status} — {d.description}
              </Text>
            ))}
        </Card>
      </View>
    </ScrollView>
  );
}
