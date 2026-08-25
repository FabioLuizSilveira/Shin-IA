import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { Card, ScreenHeader, Chip, T } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type InspectionListItem } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

const TYPE_LABEL: Record<string, string> = {
  pre_delivery: "Pré-entrega",
  check_in: "Check-in",
  check_out: "Check-out",
  return: "Retorno",
  periodic: "Periódica",
  maintenance: "Manutenção",
  damage: "Avaria",
  custom: "Personalizada",
};

const STATUS_TONE: Record<string, string> = {
  draft: "pending",
  in_progress: "on_route",
  pending_review: "warning",
  completed: "completed",
  rejected: "alert",
  abandoned: "off",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando revisão",
  completed: "Concluída",
  rejected: "Reprovada",
  abandoned: "Abandonada",
};

// Fase D (docs/architecture/INSPECTION_ENGINE.md) — mirrors AssetsScreen's
// list pattern exactly. Reachable from the Menu tab; the actual create
// entry point is AssetDetailScreen's "Nova Vistoria" button, since an
// inspection always starts from a real asset (item 33 of the spec's
// Definition of Done: "Operador abre pelo celular... Sistema identifica o
// ativo").
export function InspectionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const fetcher = useCallback(() => shinaia.inspections(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Vistorias" subtitle="Digitais" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma vistoria"
        emptySubtitle="Inicie uma vistoria a partir de um ativo."
      >
        {(inspections: InspectionListItem[]) => (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {inspections.map((inspection) => (
              <Pressable
                key={inspection.id}
                onPress={() =>
                  navigation.navigate("InspectionCapture", { inspectionId: inspection.id })
                }
              >
                <Card style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={T.display(theme.font.lg)}>
                      {TYPE_LABEL[inspection.type] ?? inspection.type}
                    </Text>
                    <Chip
                      status={STATUS_TONE[inspection.status] ?? "muted"}
                      label={STATUS_LABEL[inspection.status] ?? inspection.status}
                    />
                  </View>
                  <Text style={T.text(theme.font.sm)}>
                    {new Date(inspection.created_at).toLocaleDateString("pt-BR")}
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
