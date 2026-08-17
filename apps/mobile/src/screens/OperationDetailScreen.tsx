import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type OperationDetail, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_LABELS: Record<string, string> = {
  in_progress: "Iniciar operação",
  completed: "Concluir operação",
  cancelled: "Cancelar operação",
  failed: "Marcar como falha",
};

// GET /api/mobile/operations/{id} (Wave 2 Phase B). allowedActions is a
// server-computed preview only — PATCH /api/operations/{id} re-validates
// the transition (permission + status machine + contract gate) for real,
// exactly like ContractDetailScreen's acceptance flow never trusts a
// client-side check either.
export function OperationDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "OperationDetail">>();
  const { operationId } = route.params;
  const [updating, setUpdating] = useState<string | null>(null);

  const fetcher = useCallback(() => shinaia.operationDetail(operationId), [operationId]);
  const { state, reload } = useAsyncData(fetcher, () => false);

  async function handleAction(status: string) {
    setUpdating(status);
    try {
      await shinaia.updateOperationStatus(operationId, status);
      void reload();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha ao atualizar operação");
    } finally {
      setUpdating(null);
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
          {state.status === "error" ? state.message : "Operação não encontrada."}
        </Text>
      </View>
    );
  }

  const op: OperationDetail = state.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title={op.resources?.name ?? op.assets?.name ?? op.type} />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.xl)}>{op.type}</Text>
            <Chip status={op.status} />
          </View>
          <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
            {formatDateTime(op.scheduled_starts_at)} — {formatDateTime(op.scheduled_ends_at)}
          </Text>
          {!!op.started_at && (
            <Text style={T.text(theme.font.sm)}>Iniciada em {formatDateTime(op.started_at)}</Text>
          )}
          {!!op.completed_at && (
            <Text style={T.text(theme.font.sm)}>
              Concluída em {formatDateTime(op.completed_at)}
            </Text>
          )}
        </Card>

        <Card>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>DESCRIÇÃO</Text>
          <Text style={[T.text(), { marginTop: theme.spacing.sm }]}>
            {op.description ?? "Sem descrição."}
          </Text>
        </Card>

        {(op.resources ?? op.assets) && (
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>VINCULADO A</Text>
            <Text style={[T.display(theme.font.lg), { marginTop: theme.spacing.xs }]}>
              {op.resources?.name ?? op.assets?.name}
            </Text>
            <Text style={T.text(theme.font.sm)}>{op.resources?.type ?? op.assets?.category}</Text>
          </Card>
        )}

        {op.contractGate?.blocked && (
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.error)}>BLOQUEADA POR CONTRATO</Text>
            {op.contractGate.reasons.map((reason, i) => (
              <Text key={i} style={T.text()}>
                {reason}
              </Text>
            ))}
          </Card>
        )}

        {op.trackingSummary && (
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>ÚLTIMA POSIÇÃO</Text>
            <Text style={T.text()}>
              {op.trackingSummary.latitude.toFixed(5)}, {op.trackingSummary.longitude.toFixed(5)}
            </Text>
            <Text style={T.text(theme.font.sm)}>
              {formatDateTime(op.trackingSummary.recordedAt)}
            </Text>
          </Card>
        )}

        {op.allowedActions.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            {op.allowedActions.map((action) => (
              <GradientButton
                key={action}
                label={updating === action ? "Enviando..." : (ACTION_LABELS[action] ?? action)}
                onPress={() => void handleAction(action)}
                loading={updating === action}
                colors={
                  action === "cancelled" || action === "failed"
                    ? ([theme.colors.error, theme.colors.error] as const)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
