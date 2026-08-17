import { useCallback } from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type OperationItem } from "../lib/shinaia-api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// M23 — real data via GET /api/mobile/operations (Wave 2 Phase B), same
// endpoint regardless of persona (tenant_user sees the whole tenant,
// customer/operator already scoped server-side by ownership).
export function OperationsScreen() {
  const fetcher = useCallback(() => shinaia.operations(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Operações" subtitle="Fluxo" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma operação"
        emptySubtitle="Operações aparecerão aqui quando forem criadas."
      >
        {(operations: OperationItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {operations.map((op) => (
              <Card key={op.id}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={T.display(theme.font.lg)}>
                    {op.resources?.name ?? op.assets?.name ?? op.type}
                  </Text>
                  <Chip status={op.status} />
                </View>
                <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
                  {formatDate(op.scheduled_starts_at)} — {formatDate(op.scheduled_ends_at)}
                </Text>
                {!!op.description && <Text style={T.text()}>{op.description}</Text>}
              </Card>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
