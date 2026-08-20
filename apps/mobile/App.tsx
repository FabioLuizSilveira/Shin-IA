import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useFonts } from "expo-font";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "./src/lib/auth-context";
import { PersonaProvider, usePersona } from "./src/lib/persona-context";
import { createSessionFromUrl } from "./src/lib/deep-link-session";
import { RootNavigator } from "./src/navigation";
import { theme } from "./src/theme";
import { registerForPushNotifications, unregisterCurrentDevice } from "./src/lib/push-registration";
import { perfMark } from "./src/lib/perf-trace";

perfMark("app_js_start");

function DeepLinkHandler() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    createSessionFromUrl(url).catch((err: Error) => console.error("[deep-link]", err.message));
  }, [url]);

  return null;
}

// M23 — registers/unregisters the device's push token as the session
// transitions. Never runs for unprovisioned/demo (no server-side identity
// to attach a token to in demo mode; unprovisioned has no operational
// access to notify about).
function PushRegistrar() {
  const { session, demoMode } = useAuth();
  const { status } = usePersona();
  const deviceIdRef = useRef<string | null>(null);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (session && status === "ready" && !demoMode) {
      wasAuthenticated.current = true;
      registerForPushNotifications()
        .then((deviceId) => {
          deviceIdRef.current = deviceId;
        })
        .catch((err: Error) => console.warn("[push] registration failed", err.message));
    } else if (!session && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      void unregisterCurrentDevice(deviceIdRef.current);
      deviceIdRef.current = null;
    }
  }, [session, status, demoMode]);

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk: require("./assets/fonts/SpaceGrotesk.ttf"),
    PlusJakartaSans: require("./assets/fonts/PlusJakartaSans.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) perfMark("fonts_loaded");
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surface,
        }}
      >
        <ActivityIndicator color={theme.colors.brandSecondary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PersonaProvider>
          <DeepLinkHandler />
          <PushRegistrar />
          <RootNavigator />
          <StatusBar style="light" />
        </PersonaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
