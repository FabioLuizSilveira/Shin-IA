import { useCallback } from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type OrganizationItem } from "../lib/shinaia-api";

// M23 — reuses the existing staff route GET /api/organizations directly
// (tenant_user only) rather than a duplicated /api/mobile/* endpoint, per
// the Wave 2 Phase D reuse decision.
export function ClientsScreen() {
  const fetcher = useCallback(() => shinaia.organizations(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Clientes" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhum cliente"
      >
        {(orgs: OrganizationItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {orgs.map((org) => (
              <Card key={org.id}>
                <Text style={T.display(theme.font.lg)}>{org.trade_name ?? org.name}</Text>
                <Text style={T.text(theme.font.sm)}>{org.document}</Text>
              </Card>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
