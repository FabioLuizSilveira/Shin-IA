import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../theme";
import { Card, ScreenHeader, Loader, T, GradientButton } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { shinaia, type DashboardSummary } from "../lib/shinaia-api";

// M22.10 — operator home. Same GET /api/mobile/dashboard endpoint as
// tenant_user (it already branches by userType server-side, Wave 2 Phase A)
// — this is a distinct screen, not the tenant shell with buttons hidden,
// since the information architecture (assignments-first) is genuinely
// different, not just a permissions-trimmed tenant view.
export function OperatorHomeScreen() {
  const { signOut } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await shinaia.dashboard();
      setData(result.data);
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
