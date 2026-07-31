import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { AuthProvider } from "./src/lib/auth-context";
import { createSessionFromUrl } from "./src/lib/deep-link-session";
import { RootNavigator } from "./src/navigation";

function DeepLinkHandler() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    createSessionFromUrl(url).catch((err: Error) => console.error("[deep-link]", err.message));
  }, [url]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeepLinkHandler />
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
