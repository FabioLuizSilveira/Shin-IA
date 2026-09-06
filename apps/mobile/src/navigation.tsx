import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LoginScreen } from "./screens/LoginScreen";
import { RentalsListScreen } from "./screens/RentalsListScreen";
import { RentalDetailScreen } from "./screens/RentalDetailScreen";
import { OperatorHomeScreen } from "./screens/OperatorHomeScreen";
import { UnprovisionedScreen } from "./screens/UnprovisionedScreen";
import { TenantHomeScreen } from "./screens/TenantHomeScreen";
import { OperationsScreen } from "./screens/OperationsScreen";
import { AssetsScreen } from "./screens/AssetsScreen";
import { FinancialScreen } from "./screens/FinancialScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { ClientsScreen } from "./screens/ClientsScreen";
import { OperatorsScreen } from "./screens/OperatorsScreen";
import { ContractsScreen } from "./screens/ContractsScreen";
import { ContractDetailScreen } from "./screens/ContractDetailScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { TrackingScreen } from "./screens/TrackingScreen";
import { OperationDetailScreen } from "./screens/OperationDetailScreen";
import { AssetDetailScreen } from "./screens/AssetDetailScreen";
import { InvoicesScreen } from "./screens/InvoicesScreen";
import { RenewalScreen } from "./screens/RenewalScreen";
import { CustomerInvoicesScreen } from "./screens/CustomerInvoicesScreen";
import { InspectionsScreen } from "./screens/InspectionsScreen";
import { InspectionCaptureScreen } from "./screens/InspectionCaptureScreen";
import { InfractionsScreen } from "./screens/InfractionsScreen";
import { InfractionDetailScreen } from "./screens/InfractionDetailScreen";
import { OperatorInfractionDetailScreen } from "./screens/OperatorInfractionDetailScreen";
import { CustomerInfractionsScreen } from "./screens/CustomerInfractionsScreen";
import { CustomerInfractionDetailScreen } from "./screens/CustomerInfractionDetailScreen";
import { useAuth } from "./lib/auth-context";
import { usePersona } from "./lib/persona-context";
import { theme } from "./theme";
import { GradientButton } from "./components/ui";
import { VoiceRecordButton } from "./components/voice-record-button";

export type RootStackParamList = {
  Login: undefined;
  TenantTabs: undefined;
  OperatorHome: undefined;
  Unprovisioned: undefined;
  RentalsList: undefined;
  RentalDetail: { rentalId: string };
  Renewal: { rentalId: string };
  Clients: undefined;
  Operators: undefined;
  Contracts: undefined;
  ContractDetail: { contractId: string };
  Notifications: undefined;
  Tracking: undefined;
  OperationDetail: { operationId: string };
  AssetDetail: { assetId: string };
  Invoices: { statusFilter?: "issued" | "overdue" | "paid" } | undefined;
  CustomerInvoices: undefined;
  Inspections: undefined;
  InspectionCapture: { inspectionId: string };
  Infractions: undefined;
  InfractionDetail: { caseId: string };
  OperatorInfractionDetail: { caseId: string };
  CustomerInfractions: undefined;
  CustomerInfractionDetail: { caseId: string };
};

export type TenantTabParamList = {
  Dashboard: undefined;
  Operations: undefined;
  Assets: undefined;
  Financial: undefined;
  Menu: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TenantTabParamList>();

const TAB_ICONS: Record<keyof TenantTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: "grid-outline",
  Operations: "swap-horizontal-outline",
  Assets: "cube-outline",
  Financial: "cash-outline",
  Menu: "menu-outline",
};

// M23 — tenant_user shell: the 5-tab layout matching the Emergent frontend's
// (tabs)/_layout.tsx information architecture (Operações/Ativos/Financeiro/
// Menu, "Dashboard" here standing in for the Emergent's own operations
// overview tab), wired to real endpoints instead of expo-router.
function TenantTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandSecondary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceSecondary,
          borderTopColor: theme.colors.border,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={TAB_ICONS[route.name as keyof TenantTabParamList]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={TenantHomeScreen} />
      <Tab.Screen name="Operations" component={OperationsScreen} options={{ title: "Operações" }} />
      <Tab.Screen name="Assets" component={AssetsScreen} options={{ title: "Ativos" }} />
      <Tab.Screen name="Financial" component={FinancialScreen} options={{ title: "Financeiro" }} />
      <Tab.Screen name="Menu" component={MenuScreen} />
    </Tab.Navigator>
  );
}

function CenteredLoader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.brandSecondary} />
    </View>
  );
}

function BootstrapErrorScreen() {
  const { error, refetch } = usePersona();
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Não foi possível carregar sua sessão.</Text>
      <Text style={styles.errorDetail}>{error}</Text>
      <GradientButton
        label="Tentar novamente"
        onPress={refetch}
        style={{ marginTop: theme.spacing.lg }}
      />
    </View>
  );
}

// M22.7/M23 — PersonaRouter. The single place that branches on
// bootstrap.user.userType; no screen anywhere else should read userType to
// decide what to render. Session/persona loading and error states are
// handled once here too, instead of duplicated per screen.
export function RootNavigator() {
  const { session, loading: authLoading, demoMode } = useAuth();
  const { status, bootstrap } = usePersona();

  if (authLoading) return <CenteredLoader />;
  if (!session && !demoMode) {
    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (status === "loading") return <CenteredLoader />;
  if (status === "error") return <BootstrapErrorScreen />;
  if (status !== "ready" || !bootstrap) return <CenteredLoader />;

  return (
    <View style={styles.flexFill}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {bootstrap.user.userType === "tenant_user" && (
            <>
              <Stack.Screen name="TenantTabs" component={TenantTabs} />
              <Stack.Screen
                name="Clients"
                component={ClientsScreen}
                options={{ headerShown: true, title: "Clientes" }}
              />
              <Stack.Screen
                name="Operators"
                component={OperatorsScreen}
                options={{ headerShown: true, title: "Operadores" }}
              />
              <Stack.Screen
                name="Contracts"
                component={ContractsScreen}
                options={{ headerShown: true, title: "Contratos" }}
              />
              <Stack.Screen
                name="ContractDetail"
                component={ContractDetailScreen}
                options={{ headerShown: true, title: "Contrato" }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: true, title: "Notificações" }}
              />
              <Stack.Screen
                name="Tracking"
                component={TrackingScreen}
                options={{ headerShown: true, title: "Rastreamento" }}
              />
              <Stack.Screen
                name="OperationDetail"
                component={OperationDetailScreen}
                options={{ headerShown: true, title: "Operação" }}
              />
              <Stack.Screen
                name="AssetDetail"
                component={AssetDetailScreen}
                options={{ headerShown: true, title: "Ativo" }}
              />
              <Stack.Screen
                name="Invoices"
                component={InvoicesScreen}
                options={{ headerShown: true, title: "Faturas" }}
              />
              <Stack.Screen
                name="Inspections"
                component={InspectionsScreen}
                options={{ headerShown: true, title: "Vistorias" }}
              />
              <Stack.Screen
                name="InspectionCapture"
                component={InspectionCaptureScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Infractions"
                component={InfractionsScreen}
                options={{ headerShown: true, title: "Infrações" }}
              />
              <Stack.Screen
                name="InfractionDetail"
                component={InfractionDetailScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
          {bootstrap.user.userType === "operator" && (
            <>
              <Stack.Screen name="OperatorHome" component={OperatorHomeScreen} />
              <Stack.Screen
                name="Inspections"
                component={InspectionsScreen}
                options={{ headerShown: true, title: "Minhas Vistorias" }}
              />
              <Stack.Screen
                name="InspectionCapture"
                component={InspectionCaptureScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Infractions"
                component={InfractionsScreen}
                options={{ headerShown: true, title: "Minhas Infrações" }}
              />
              <Stack.Screen
                name="OperatorInfractionDetail"
                component={OperatorInfractionDetailScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
          {bootstrap.user.userType === "unprovisioned" && (
            <Stack.Screen name="Unprovisioned" component={UnprovisionedScreen} />
          )}
          {bootstrap.user.userType === "customer" && (
            <>
              <Stack.Screen name="RentalsList" component={RentalsListScreen} />
              <Stack.Screen name="RentalDetail" component={RentalDetailScreen} />
              <Stack.Screen name="Renewal" component={RenewalScreen} />
              <Stack.Screen name="CustomerInvoices" component={CustomerInvoicesScreen} />
              <Stack.Screen
                name="ContractDetail"
                component={ContractDetailScreen}
                options={{ headerShown: true, title: "Contrato" }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: true, title: "Notificações" }}
              />
              <Stack.Screen
                name="CustomerInfractions"
                component={CustomerInfractionsScreen}
                options={{ headerShown: true, title: "Minhas Infrações" }}
              />
              <Stack.Screen
                name="CustomerInfractionDetail"
                component={CustomerInfractionDetailScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {bootstrap.user.userType === "tenant_user" && <VoiceRecordButton />}
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
  },
  errorText: { color: theme.colors.onSurface, fontSize: theme.font.lg, textAlign: "center" },
  errorDetail: {
    color: theme.colors.muted,
    fontSize: theme.font.sm,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
});
