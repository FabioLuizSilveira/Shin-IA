import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Card, ScreenHeader, Loader, T, GradientButton, EmptyState } from "../components/ui";
import { usePersona } from "../lib/persona-context";
import { useAuth } from "../lib/auth-context";
import { shinaia, type DashboardSummary } from "../lib/shinaia-api";

// M22.8 — tenant_user home. Real data via GET /api/mobile/dashboard
// (Wave 2 Phase A), navigation.tsx branches here whenever
// bootstrap.user.userType === "tenant_user".
interface TenantDashboardData {
  summary: {
    activeOperations: number;
    pendingOperations: number;
    availableAssets: number;
    assetsInUse: number;
  };
  alerts: { type: string; message: string; severity: string; resourceId: string }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }[];
  financial: {
    pendingInvoicesTotal: number;
    overdueInvoicesCount: number;
    currency: string;
  } | null;
}

const CURRENCY_FORMATTERS: Record<string, Intl.NumberFormat> = {};
function formatCurrency(amount: number, currency: string) {
  if (!CURRENCY_FORMATTERS[currency]) {
    CURRENCY_FORMATTERS[currency] = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
  }
  return CURRENCY_FORMATTERS[currency].format(amount);
}

const SEVERITY_ICON_COLOR: Record<string, string> = {
  high: theme.colors.error,
  medium: theme.colors.warning,
  low: theme.colors.info,
};

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card style={styles.statCard}>
      <View
        style={[styles.statIcon, { backgroundColor: (tone ?? theme.colors.brandSecondary) + "1A" }]}
      >
        <Ionicons name={icon} size={18} color={tone ?? theme.colors.brandSecondary} />
      </View>
      <Text style={[T.display(theme.font.xxl), { marginTop: theme.spacing.sm }]}>{value}</Text>
      <Text style={T.text(theme.font.sm)}>{label}</Text>
    </Card>
  );
}

export function TenantHomeScreen() {
  const { bootstrap } = usePersona();
  const { signOut, demoMode } = useAuth();
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<"live" | "mock" | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await shinaia.dashboard();
      setData(result.data as unknown as TenantDashboardData);
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
      ) : !data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Não foi possível carregar"
          subtitle="Puxe para baixo para tentar novamente."
        />
      ) : (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <View style={styles.statGrid}>
            <StatCard
              icon="play-circle-outline"
              label="Operações ativas"
              value={data.summary.activeOperations}
              tone={theme.colors.success}
            />
            <StatCard
              icon="time-outline"
              label="Operações pendentes"
              value={data.summary.pendingOperations}
              tone={theme.colors.warning}
            />
            <StatCard
              icon="cube-outline"
              label="Ativos disponíveis"
              value={data.summary.availableAssets}
            />
            <StatCard
              icon="swap-horizontal-outline"
              label="Ativos em uso"
              value={data.summary.assetsInUse}
              tone={theme.colors.brandTertiary}
            />
          </View>

          {data.financial && (
            <Card>
              <Text style={T.text(theme.font.sm)}>Financeiro</Text>
              <Text style={[T.display(theme.font.xxl), { marginTop: theme.spacing.xs }]}>
                {formatCurrency(data.financial.pendingInvoicesTotal, data.financial.currency)}
              </Text>
              <Text style={T.text(theme.font.sm)}>
                {data.financial.overdueInvoicesCount > 0
                  ? `${data.financial.overdueInvoicesCount} fatura(s) em atraso`
                  : "Nenhuma fatura em atraso"}
              </Text>
            </Card>
          )}

          {data.alerts.length > 0 && (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={T.display(theme.font.lg)}>Alertas</Text>
              {data.alerts.map((alert, index) => (
                <Card key={`${alert.resourceId}-${index}`} style={styles.alertCard}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={SEVERITY_ICON_COLOR[alert.severity] ?? theme.colors.warning}
                  />
                  <Text style={[T.text(), { flex: 1 }]}>{alert.message}</Text>
                </Card>
              ))}
            </View>
          )}

          {data.recentActivity.length > 0 && (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={T.display(theme.font.lg)}>Atividade recente</Text>
              <Card style={{ gap: theme.spacing.md }}>
                {data.recentActivity.map((activity) => (
                  <View key={activity.id} style={styles.activityRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={T.text(theme.font.base, theme.colors.onSurfaceSecondary)}>
                        {activity.action}
                      </Text>
                      <Text style={T.text(theme.font.sm)}>{activity.entityType}</Text>
                    </View>
                    <Text style={T.text(theme.font.sm)}>
                      {new Date(activity.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          <GradientButton label="Sair" onPress={() => void signOut()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  statCard: { width: "47%" },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  activityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});
