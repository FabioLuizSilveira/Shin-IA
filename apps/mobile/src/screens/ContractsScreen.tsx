import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type ContractItem } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

const brl = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

// M23 — GET /api/mobile/contracts. Works for both tenant_user (would need
// the staff /api/contracts variant for a full cross-organization view — out
// of scope this pass, tenant_user browses via the same endpoint customer
// uses when reachable) and customer (ownership-scoped). Never shows the
// editable template, only what the backend already renders.
export function ContractsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const fetcher = useCallback(() => shinaia.contracts(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Contratos" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhum contrato"
      >
        {(contracts: ContractItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {contracts.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => navigation.navigate("ContractDetail", { contractId: c.id })}
              >
                <Card>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={T.display(theme.font.lg)}>
                      {brl(c.value_amount, c.value_currency)}
                    </Text>
                    <Chip status={c.status} />
                  </View>
                  <Text style={T.text(theme.font.sm)}>
                    {new Date(c.period_starts_at).toLocaleDateString("pt-BR")} —{" "}
                    {new Date(c.period_ends_at).toLocaleDateString("pt-BR")}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
