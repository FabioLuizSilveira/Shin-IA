import { View, StyleSheet } from "react-native";
import { EmptyState, GradientButton } from "../components/ui";
import { theme } from "../theme";
import { useAuth } from "../lib/auth-context";

// M22.11 — unprovisioned state. Never renders operational UI, never calls
// createTenant()/createMembership()/assignRole() automatically — the only
// actions available are logout and (when a real invite/onboarding flow
// exists) completing it. No such flow exists yet, so this is intentionally
// just a state screen + logout per the M22 spec ("mostrar estado
// apropriado", not build a new onboarding feature).
export function UnprovisionedScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <EmptyState
        icon="person-outline"
        title="Conta sem vínculo ativo"
        subtitle="Sua conta ainda não está associada a um tenant, cliente ou operador. Se você recebeu um convite, conclua-o pelo link enviado por e-mail."
      />
      <GradientButton label="Sair" onPress={() => void signOut()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  button: { marginTop: theme.spacing.lg },
});
