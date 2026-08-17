import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Card, ScreenHeader, Loader, T, GradientButton, EmptyState } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { shinaia } from "../lib/shinaia-api";

// M22.10 — operator home. Same GET /api/mobile/dashboard endpoint as
// tenant_user (it already branches by userType server-side, Wave 2 Phase A)
// — this is a distinct screen, not the tenant shell with buttons hidden,
// since the information architecture (assignments-first) is genuinely
// different, not just a permissions-trimmed tenant view.
interface OperatorDashboardData {
  summary: {
    activeOperations: number;
    pendingOperations: number;
    availableAssets: number;
    assetsInUse: number;
  };
  assignments: { assigned: number; confirmed: number };
}

export function OperatorHomeScreen() {
  const { signOut } = useAuth();
  const [data, setData] = useState<OperatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await shinaia.dashboard();
      setData(result.data as unknown as OperatorDashboardData);
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
      <ScreenHeader title="Minhas Atribuições" subtitle="Operador" brand />
      {loading ? (
        <Loader />
      ) : !data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Não foi possível carregar"
          subtitle="Puxe para baixo para tentar novamente."
        />
      ) : (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <View style={styles.row}>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: theme.colors.warning + "1A" }]}>
                <Ionicons name="clipboard-outline" size={18} color={theme.colors.warning} />
              </View>
              <Text style={[T.display(theme.font.xxl), { marginTop: theme.spacing.sm }]}>
                {data.assignments.assigned}
              </Text>
              <Text style={T.text(theme.font.sm)}>Atribuídas</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: theme.colors.success + "1A" }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
              </View>
              <Text style={[T.display(theme.font.xxl), { marginTop: theme.spacing.sm }]}>
                {data.assignments.confirmed}
              </Text>
              <Text style={T.text(theme.font.sm)}>Confirmadas</Text>
            </Card>
          </View>

          {data.assignments.assigned === 0 && data.assignments.confirmed === 0 && (
            <EmptyState
              icon="clipboard-outline"
              title="Nenhuma atribuição"
              subtitle="Você não tem operações atribuídas no momento."
            />
          )}

          <GradientButton label="Sair" onPress={() => void signOut()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  row: { flexDirection: "row", gap: theme.spacing.md },
  statCard: { flex: 1 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
