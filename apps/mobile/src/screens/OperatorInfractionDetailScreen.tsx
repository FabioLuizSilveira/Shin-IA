import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type OperatorInfractionCaseDetail, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

// Self-service closure round (docs/architecture/INFRACTIONS_ENGINE.md) —
// the operator's own, deliberately narrow detail screen. Never shows the
// staff-only responsibility/payment workflow InfractionDetailScreen has —
// the only real action here is acknowledging or disputing a driver
// identification pointed at this operator specifically.
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

export function OperatorInfractionDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "OperatorInfractionDetail">>();
  const { caseId } = route.params;
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const fetcher = useCallback(() => shinaia.operatorInfractionDetail(caseId), [caseId]);
  const { state, reload } = useAsyncData(fetcher, () => false);

  async function respond(driverIdentificationId: string, acknowledgment: "confirmed" | "disputed") {
    setBusy(driverIdentificationId + acknowledgment);
    try {
      await shinaia.respondDriverIdentification(caseId, driverIdentificationId, {
        acknowledgment,
        notes: notes.trim() || undefined,
      });
      setNotes("");
      void reload();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha na operação.");
    } finally {
      setBusy(null);
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

  const detail: OperatorInfractionCaseDetail = state.data;
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

        {detail.driverIdentifications.length === 0 && (
          <Card>
            <Text style={T.text()}>
              Nenhuma indicação de condutor aguardando sua resposta nesta infração.
            </Text>
          </Card>
        )}

        {detail.driverIdentifications.map((d) => (
          <Card key={d.id} style={{ gap: theme.spacing.sm }}>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
              VOCÊ FOI INDICADO COMO CONDUTOR
            </Text>
            {d.operator_acknowledgment ? (
              <Text style={T.text()}>
                Você já respondeu:{" "}
                {d.operator_acknowledgment === "confirmed"
                  ? "confirmou que estava dirigindo"
                  : "contestou a indicação"}{" "}
                em{" "}
                {d.operator_acknowledged_at
                  ? new Date(d.operator_acknowledged_at).toLocaleDateString("pt-BR")
                  : "—"}
                .
              </Text>
            ) : (
              <>
                <Text style={T.text()}>Você estava dirigindo o veículo nesta infração?</Text>
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
                    minHeight: 60,
                  }}
                  placeholder="Observação, opcional..."
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <GradientButton
                    label="Sim, era eu"
                    loading={busy === d.id + "confirmed"}
                    disabled={busy !== null}
                    onPress={() => void respond(d.id, "confirmed")}
                    style={{ flex: 1 }}
                  />
                  <GradientButton
                    label="Não fui eu"
                    loading={busy === d.id + "disputed"}
                    disabled={busy !== null}
                    colors={[theme.colors.error, theme.colors.error] as const}
                    onPress={() => void respond(d.id, "disputed")}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
