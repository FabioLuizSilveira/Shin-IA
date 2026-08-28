import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type InfractionCaseDetail, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

// Mobile screens phase (docs/architecture/INFRACTIONS_ENGINE.md) — staff
// only (see InfractionsScreen for why operators never reach this route).
// Mirrors OperationDetailScreen's shape: real GET on focus, actions call
// the real mutation routes and reload, errors surface via Alert instead
// of a client-side guess. Covers the highest-value day-to-day actions
// (responsibility workflow, payment, dispute) -- driver-identification/
// defense registration stays web-only this round, same as the pending
// items already documented for the web drawer's own follow-ups.
function formatCents(cents: number | null, currency = "BRL"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

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

export function InfractionDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "InfractionDetail">>();
  const { caseId } = route.params;
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [disputeText, setDisputeText] = useState("");

  const fetcher = useCallback(() => shinaia.infractionDetail(caseId), [caseId]);
  const { state, reload } = useAsyncData(fetcher, () => false);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      await fn();
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

  const detail: InfractionCaseDetail = state.data;
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

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>RESPONSABILIDADE</Text>
          <Text style={T.text()}>
            {c.responsible_party_type
              ? `${c.responsible_party_type === "customer" ? "Cliente" : "Operador"} (confiança: ${
                  c.responsibility_confidence ? Math.round(c.responsibility_confidence * 100) : "—"
                }%)`
              : "Ainda não sugerida."}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <GradientButton
              label="Sugerir"
              loading={busy === "suggest"}
              onPress={() =>
                void run("suggest", () => shinaia.suggestInfractionResponsibility(caseId))
              }
              style={{ flex: 1 }}
            />
            <GradientButton
              label="Confirmar"
              loading={busy === "confirm"}
              onPress={() =>
                void run("confirm", () => shinaia.confirmInfractionResponsibility(caseId))
              }
              style={{ flex: 1 }}
            />
            <GradientButton
              label="Rejeitar"
              loading={busy === "reject"}
              colors={[theme.colors.error, theme.colors.error] as const}
              onPress={() =>
                void run("reject", () => shinaia.rejectInfractionResponsibility(caseId))
              }
              style={{ flex: 1 }}
            />
          </View>
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
                <Text
                  style={T.text(
                    theme.font.sm,
                    d.status === "overdue"
                      ? theme.colors.error
                      : d.status === "due_soon"
                        ? theme.colors.warning
                        : theme.colors.muted,
                  )}
                >
                  {d.due_at ? new Date(d.due_at).toLocaleDateString("pt-BR") : "—"} ({d.status})
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
            PAGAMENTO À AUTORIDADE
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
            }}
            placeholder="Valor pago (R$)"
            placeholderTextColor={theme.colors.muted}
            keyboardType="decimal-pad"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
          />
          <GradientButton
            label="Registrar pago"
            loading={busy === "payment"}
            disabled={!paymentAmount}
            onPress={() =>
              void run("payment", async () => {
                await shinaia.registerInfractionPayment(caseId, {
                  kind: "to_authority",
                  amountPaidCents: Math.round(Number(paymentAmount) * 100),
                });
                setPaymentAmount("");
              })
            }
          />
          {detail.payments.length > 0 &&
            detail.payments.map((p) => (
              <Text key={p.id} style={T.text(theme.font.sm)}>
                {p.kind === "to_authority" ? "Pago à autoridade" : "Reembolso"} —{" "}
                {formatCents(p.amount_paid_cents)}
              </Text>
            ))}
        </Card>

        <Card style={{ gap: theme.spacing.sm }}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>CONTESTAÇÃO</Text>
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
            loading={busy === "dispute"}
            disabled={!disputeText.trim()}
            colors={[theme.colors.error, theme.colors.error] as const}
            onPress={() =>
              void run("dispute", async () => {
                await shinaia.createInfractionDispute(caseId, {
                  partyType: c.responsible_party_type ?? "customer",
                  description: disputeText,
                });
                setDisputeText("");
              })
            }
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
