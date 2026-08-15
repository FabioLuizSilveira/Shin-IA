import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ scheme: "shinacustomer", path: "auth/callback" });

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google OAuth: unlike signInWithOtp, GoTrue has no equivalent
  // "don't create a user" flag for OAuth providers — a first-time Google
  // login always creates an auth.users row. This can't be blocked client-
  // side. The actual guardrail lives server-side: /api/mobile/bootstrap
  // resolves userType via real membership (user_profiles/rental_customers/
  // operators), never via "an auth user exists" — a Google login with no
  // membership row anywhere comes back userType: "unprovisioned" and gets
  // zero operational access, regardless of how the auth identity was
  // created (Wave 0.1/0.2).
  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      }
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao entrar com Google");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setSending(true);
    try {
      // Security guardrail (Wave 0.1): shouldCreateUser: false means this
      // never creates a new auth.users row — only an email that already has
      // an account (created via staff invite, e.g. inviteRentalCustomer())
      // can complete a magic-link sign-in. Free self-signup previously
      // possible here (any typed email got a working login) is closed by
      // this flag alone; Supabase returns the same "email sent" response
      // either way, so this doesn't leak which emails have accounts.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao enviar o link");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shinã Cliente</Text>
      <Text style={styles.subtitle}>Acompanhe suas locações</Text>

      <Pressable
        style={[styles.button, styles.googleButton]}
        onPress={() => void handleGoogleLogin()}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <ActivityIndicator color="#1F2937" />
        ) : (
          <Text style={styles.googleButtonText}>Entrar com Google</Text>
        )}
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      {sent ? (
        <Text style={styles.sentText}>
          Enviamos um link de acesso para {email}. Abra-o neste dispositivo para entrar.
        </Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            style={[styles.button, styles.magicLinkButton]}
            onPress={() => void handleMagicLink()}
            disabled={sending || !email.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.magicLinkButtonText}>Enviar link de acesso</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#0F172A", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 4, marginBottom: 32 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButton: { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  googleButtonText: { color: "#0F172A", fontWeight: "600", fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText: { marginHorizontal: 12, color: "#94A3B8", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    color: "#0F172A",
  },
  magicLinkButton: { backgroundColor: "#2563EB" },
  magicLinkButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  sentText: { textAlign: "center", color: "#334155", fontSize: 14, lineHeight: 20 },
});
