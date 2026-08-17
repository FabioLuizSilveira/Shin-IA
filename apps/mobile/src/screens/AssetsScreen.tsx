import { useCallback } from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type AssetItem } from "../lib/shinaia-api";

// M23 — real data via GET /api/mobile/assets (Wave 2 Phase C). Blueprint-
// agnostic by construction (matches the backend route) — no
// `if (category === "vehicle")` branching here.
export function AssetsScreen() {
  const fetcher = useCallback(() => shinaia.assets(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Ativos" subtitle="Frota" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhum ativo"
        emptySubtitle="Ativos vinculados aparecerão aqui."
      >
        {(assets: AssetItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {assets.map((asset) => (
              <Card key={asset.id}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={T.display(theme.font.lg)}>{asset.name}</Text>
                  <Chip status={asset.status} />
                </View>
                <Text style={T.text(theme.font.sm)}>
                  {asset.type_name ?? asset.category}
                  {asset.serial_number ? ` · ${asset.serial_number}` : ""}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </AsyncScreen>
    </View>
  );
}
