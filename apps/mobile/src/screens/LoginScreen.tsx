import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "firebase/auth";
import { supabase } from "../lib/supabase";
import { getFirebaseAuth } from "../lib/firebase";
import { areMocksAllowed } from "../lib/mock-policy";
import { useAuth } from "../lib/auth-context";
import { shinaia, ApiError } from "../lib/shinaia-api";

WebBrowser.maybeCompleteAuthSession();

const USE_FIREBASE = process.env.EXPO_PUBLIC_IDENTITY_PROVIDER === "firebase";

const redirectTo = makeRedirectUri({ scheme: "shinacustomer", path: "auth/callback" });

export function LoginScreen() {
  const { enterDemoMode, signInWithCustomToken } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"tenant" | "customer" | null>(null);

  // Google OAuth client IDs are per-platform and separate from the
  // Firebase project's own web client — MANUAL CONFIGURATION REQUIRED:
  // create OAuth 2.0 Client IDs (type "iOS"/"Android"/"Web application")
  // in the Firebase project's linked Google Cloud Console
  // (APIs & Services -> Credentials), matching this app's bundle
  // identifier/package name and SHA-1 fingerprint, then set
  // EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID /
  // EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Until then, useAuthRequest below
  // returns a null `request` and the button below is disabled with an
  // explanatory label rather than crashing.
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (!USE_FIREBASE || googleResponse?.type !== "success") return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) return;
    setGoogleLoading(true);
    signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken))
      .catch((err) =>
        Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao entrar com Google"),
      )
      .finally(() => setGoogleLoading(false));
  }, [googleResponse]);

  // The approved (Emergent) design had a single "Entrar em modo
  // demonstração" button on this screen, but backed by a fully mocked,
  // offline session — reversing this app's mock-gating decision (M22:
  // mocks/demo structurally impossible outside __DEV__) wasn't the goal.
  // This is the real equivalent: two fixed, dedicated accounts already
  // provisioned against the real Veloz Rent a Car tenant (a real staff
  // login and a real customer login, both with real data behind them) —
  // signs in as one of them and returns a real session, exactly like
  // Google/Apple/magic-link do. No mock data, no bypassed backend.
  async function handleDemoLogin(persona: "tenant" | "customer") {
    setDemoLoading(persona);
    try {
      if (USE_FIREBASE) {
        const { customToken } = await shinaia.firebaseDemoLogin(persona);
        await signInWithCustomToken(customToken);
      } else {
        const { access_token, refresh_token } = await shinaia.demoLogin(persona);
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      }
    } catch (err) {
      Alert.alert(
        "Erro",
        err instanceof ApiError ? err.message : "Falha ao entrar em modo demonstração",
      );
    } finally {
      setDemoLoading(null);
    }
  }

  // Google OAuth: unlike signInWithOtp, GoTrue has no equivalent
  // "don't create a user" flag for OAuth providers — a first-time Google
  // login always creates an auth.users row. This can't be blocked client-
  // side. The actual guardrail lives server-side: /api/mobile/bootstrap
  // resolves userType via real membership (user_profiles/rental_customers/
  // operators), never via "an auth user exists" — a Google login with no
  // membership row anywhere comes back userType: "unprovisioned" and gets
  // zero operational access, regardless of how the auth identity was
  // created (Wave 0.1/0.2). Same guarantee applies to the Firebase path —
  // resolveMobileContext() never trusts anything but real membership rows.
  async function handleGoogleLogin() {
    if (USE_FIREBASE) {
      if (!googleRequest) {
        Alert.alert(
          "Google indisponível",
          "Configuração pendente (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID) — ver docs/architecture/FIREBASE_AUTH_MIGRATION.md.",
        );
        return;
      }
      await promptGoogleAsync();
      return;
    }

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

  // M22.3 — Apple Sign-In. Uses the native Sign in with Apple button
  // (iOS-only per Apple's own HIG/App Review requirement — there is no
  // Android/web equivalent). Exchanges Apple's identityToken for a real
  // session — Supabase's signInWithIdToken() normally, or Firebase's
  // OAuthProvider('apple.com') credential when USE_FIREBASE. Either path
  // still requires the same two pieces of external configuration this code
  // cannot verify itself: (1) "Sign In with Apple" capability enabled on
  // the app's Apple Developer identifier, and (2) the Apple provider
  // configured in the relevant auth dashboard (Supabase's, or Firebase
  // Console -> Authentication -> Sign-in method -> Apple, with the
  // Services ID/key). MANUAL CONFIGURATION REQUIRED for both before this
  // button will actually authenticate — the code path is real and correct,
  // but cannot self-verify infrastructure it doesn't control.
  async function handleAppleLogin() {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("Apple não retornou um identityToken");

      if (USE_FIREBASE) {
        const provider = new OAuthProvider("apple.com");
        const firebaseCredential = provider.credential({ idToken: credential.identityToken });
        await signInWithCredential(getFirebaseAuth(), firebaseCredential);
      } else {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao entrar com Apple");
    } finally {
      setAppleLoading(false);
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
      <Text style={styles.title}>Shinã</Text>
      <Text style={styles.subtitle}>Entre para continuar</Text>

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

      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={() => void handleAppleLogin()}
        />
      )}
      {appleLoading && <ActivityIndicator style={{ marginTop: 8 }} />}

      {/* Magic Link still only produces a Supabase session — with the
          backend cut over to Firebase (USE_FIREBASE), that session
          wouldn't be recognized by requireMobileContext(), so it's hidden
          rather than left silently broken. Firebase's email-link
          equivalent needs its own Dynamic Links / deep-link redirect
          domain setup, not done yet — see FIREBASE_AUTH_MIGRATION.md. */}
      {!USE_FIREBASE && (
        <>
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
        </>
      )}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>demonstração</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          style={[styles.button, styles.realDemoButton, { flex: 1 }]}
          onPress={() => void handleDemoLogin("tenant")}
          disabled={demoLoading !== null}
        >
          {demoLoading === "tenant" ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <Text style={styles.realDemoButtonText}>Ver como Equipe</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.button, styles.realDemoButton, { flex: 1 }]}
          onPress={() => void handleDemoLogin("customer")}
          disabled={demoLoading !== null}
        >
          {demoLoading === "customer" ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <Text style={styles.realDemoButtonText}>Ver como Cliente</Text>
          )}
        </Pressable>
      </View>

      {/* M22.5 — never rendered outside dev + EXPO_PUBLIC_ENABLE_MOCKS=1;
          areMocksAllowed() folds in __DEV__, which is false in every
          eas build release/production profile regardless of any env var,
          so this button cannot exist in a release build's bundle output. */}
      {areMocksAllowed() && (
        <Pressable style={styles.demoButton} onPress={enterDemoMode}>
          <Text style={styles.demoButtonText}>Entrar em modo demonstração (dev, mock)</Text>
        </Pressable>
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
  appleButton: { height: 48, marginTop: 12 },
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
  realDemoButton: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  realDemoButtonText: { color: "#2563EB", fontWeight: "600", fontSize: 14 },
  sentText: { textAlign: "center", color: "#334155", fontSize: 14, lineHeight: 20 },
  demoButton: { marginTop: 24, alignItems: "center", paddingVertical: 8 },
  demoButtonText: { color: "#94A3B8", fontSize: 13, textDecorationLine: "underline" },
});
