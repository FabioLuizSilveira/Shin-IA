import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../theme";
import { Card, ScreenHeader, Loader, T, GradientButton } from "../components/ui";
import { usePersona } from "../lib/persona-context";
import { useAuth } from "../lib/auth-context";
import { shinaia, type DashboardSummary } from "../lib/shinaia-api";

// M22.8 — tenant_user home. Real data via GET /api/mobile/dashboard
// (Wave 2 Phase A), navigation.tsx branches here whenever
// bootstrap.user.userType === "tenant_user". Full module screens
// (Operations/Assets/Contracts/...) are M23 scope — this proves the
// persona-routing + real-data pipeline end to end for this persona without
// claiming the whole Emergent shell is ported yet.
export function TenantHomeScreen() {
  const { bootstrap } = usePersona();
  const { signOut, demoMode } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<"live" | "mock" | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await shinaia.dashboard();
      setData(result.data);
      setSource(result.source);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <ScreenHeader title={bootstrap?.tenant?.name ?? "Shinã"} subtitle="Dashboard" brand />
      {source === "mock" && (
        <Card style={{ marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md }}>
          <Text style={T.text()}>
            Exibindo dados de demonstração{demoMode ? " (modo demo)" : ""}.
          </Text>
        </Card>
      )}
      {loading ? (
        <Loader />
      ) : (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Card>
            <Text style={T.text(theme.font.sm)}>{JSON.stringify(data, null, 2)}</Text>
          </Card>
          <GradientButton label="Sair" onPress={() => void signOut()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
});
