import { useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type AssetItem } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";
import { HOTLINK_HEADERS } from "../lib/image-headers";

// Same customFields the tenant configured on the asset type (brand, model,
// year, plate, weekly_rate, etc.) show up in `metadata` — rendered
// generically here rather than hardcoding vehicle-only fields, since the
// route (GET /api/mobile/assets/{id}) is blueprint-agnostic by construction.
const HIDDEN_METADATA_KEYS = new Set(["photo_url"]);
const FIELD_LABELS: Record<string, string> = {
  plate: "Placa",
  brand: "Marca",
  model: "Modelo",
  year: "Ano",
  transmission: "Câmbio",
  seats: "Lugares",
  tier: "Categoria",
  weekly_rate: "Diária/Semanal",
};

export function AssetDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "AssetDetail">>();
  const { assetId } = route.params;

  const fetcher = useCallback(() => shinaia.asset(assetId), [assetId]);
  const { state } = useAsyncData(fetcher, () => false);

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
          {state.status === "error" ? state.message : "Ativo não encontrado."}
        </Text>
      </View>
    );
  }

  const asset: AssetItem = state.data;
  const specs = Object.entries(asset.metadata ?? {}).filter(
    ([key, value]) => !HIDDEN_METADATA_KEYS.has(key) && value !== null && value !== undefined,
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title={asset.name} />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {asset.metadata?.photo_url && (
          <Image
            source={{ uri: asset.metadata.photo_url, headers: HOTLINK_HEADERS }}
            style={{ width: "100%", height: 200, borderRadius: theme.radius.lg }}
            contentFit="cover"
          />
        )}

        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.xl)}>{asset.name}</Text>
            <Chip status={asset.status} />
          </View>
          <Text style={T.text(theme.font.sm)}>
            {asset.type_name ?? asset.category}
            {asset.serial_number ? ` · ${asset.serial_number}` : ""}
          </Text>
        </Card>

        {specs.length > 0 && (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>ESPECIFICAÇÕES</Text>
            {specs.map(([key, value]) => (
              <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={T.text(theme.font.sm)}>{FIELD_LABELS[key] ?? key}</Text>
                <Text style={T.text(theme.font.base, theme.colors.onSurfaceSecondary)}>
                  {key === "weekly_rate"
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        Number(value),
                      )
                    : String(value)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
