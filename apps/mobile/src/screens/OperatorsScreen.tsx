import { useCallback } from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type OperatorItem } from "../lib/shinaia-api";

// M23 — reuses the existing staff route GET /api/operators directly
// (tenant_user only), same reuse rationale as ClientsScreen.
export function OperatorsScreen() {
  const fetcher = useCallback(() => shinaia.operators(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Operadores" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhum operador"
      >
        {(operators: OperatorItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {operators.map((op) => (
              <Card key={op.id}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={T.display(theme.font.lg)}>{op.full_name}</Text>
                  <Chip status={op.status} />
                </View>
                {!!op.phone && <Text style={T.text(theme.font.sm)}>{op.phone}</Text>}
              </Card>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
