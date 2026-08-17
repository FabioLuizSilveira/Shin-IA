import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { areMocksAllowed } from "./mock-policy";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  demoMode: boolean;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  demoMode: false,
  signOut: async () => {},
  enterDemoMode: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // Dev-only shortcut: Expo Go can't complete the magic-link/Google
      // deep link back into the app (custom scheme, see
      // deep-link-session.ts), so local testing without a dev-client build
      // has no way to actually finish a login. When EXPO_PUBLIC_DEV_*
      // tokens are present (apps/mobile/.env.local, gitignored, never set
      // in CI/EAS builds), bootstrap a real session obtained out-of-band
      // for a test rental_customer instead of blocking on the deep link.
      if (!data.session && __DEV__ && process.env.EXPO_PUBLIC_DEV_ACCESS_TOKEN) {
        const { data: devData } = await supabase.auth.setSession({
          access_token: process.env.EXPO_PUBLIC_DEV_ACCESS_TOKEN,
          refresh_token: process.env.EXPO_PUBLIC_DEV_REFRESH_TOKEN ?? "",
        });
        setSession(devData.session);
        setLoading(false);
        return;
      }
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) setDemoMode(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // M22.5 — demo mode never touches Supabase; it is a purely local UI state
  // that only exists to preview mock-backed screens without a real
  // session. It is a no-op unless __DEV__ AND EXPO_PUBLIC_ENABLE_MOCKS are
  // both true — see mock-policy.ts, which this function delegates to so
  // there is exactly one place that decides "is mock/demo allowed here".
  function enterDemoMode() {
    if (!areMocksAllowed()) return;
    setDemoMode(true);
    setLoading(false);
  }

  // M22.13 — logout clears the Supabase session (which itself wipes the
  // encrypted secure-store blob, see secure-session-store.ts) and any local
  // demo-mode flag. Bootstrap/persona cache lives in PersonaProvider, which
  // resets itself in response to `session` becoming null (see
  // persona-context.tsx) — no separate cache-clear call needed here.
  async function signOut() {
    setDemoMode(false);
    if (session) {
      await supabase.auth.signOut();
    }
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, demoMode, signOut, enterDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Re-exported so LoginScreen can gate its own demo button without importing
// AuthProvider internals — the real gate logic lives in mock-policy.ts.
export { areMocksAllowed } from "./mock-policy";
