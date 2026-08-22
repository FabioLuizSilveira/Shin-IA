import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { User as FirebaseUser } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { supabase } from "./supabase";
import { getFirebaseAuth } from "./firebase";
import { areMocksAllowed } from "./mock-policy";
import { perfMark } from "./perf-trace";

// Mirrors apps/web's NEXT_PUBLIC_IDENTITY_PROVIDER gate. Firebase-provider
// consumers only ever read `session` for truthiness (see persona-context.tsx,
// navigation.tsx) — no screen destructures Supabase-specific fields — so
// exposing a FirebaseUser under the same `session` name here is a drop-in
// swap, not a breaking change to any consumer.
const USE_FIREBASE = process.env.EXPO_PUBLIC_IDENTITY_PROVIDER === "firebase";

interface AuthContextValue {
  session: Session | FirebaseUser | null;
  loading: boolean;
  demoMode: boolean;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  // Only meaningful when USE_FIREBASE — LoginScreen's demo buttons need to
  // complete a custom-token sign-in themselves (server round trip to mint
  // the token), this just finishes it and updates context state.
  signInWithCustomToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  demoMode: false,
  signOut: async () => {},
  enterDemoMode: () => {},
  signInWithCustomToken: async () => {},
});

function useFirebaseAuthProvider(): AuthContextValue {
  const [session, setSession] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    perfMark("session_restore_start");
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setLoading(false);
      if (user) setDemoMode(false);
      perfMark("session_restore_done", { hasSession: !!user });
    });
    return unsubscribe;
  }, []);

  const enterDemoMode = useCallback(() => {
    if (!areMocksAllowed()) return;
    setDemoMode(true);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    setDemoMode(false);
    if (session) await firebaseSignOut(getFirebaseAuth());
    setSession(null);
  }, [session]);

  const signInWithCustomToken = useCallback(async (token: string) => {
    await firebaseSignInWithCustomToken(getFirebaseAuth(), token);
    // onAuthStateChanged above picks up the resulting user and updates
    // `session` — no need to setSession() here too.
  }, []);

  return useMemo(
    () => ({ session, loading, demoMode, signOut, enterDemoMode, signInWithCustomToken }),
    [session, loading, demoMode, signOut, enterDemoMode, signInWithCustomToken],
  );
}

function useSupabaseAuthProvider(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    perfMark("session_restore_start");
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
        perfMark("session_restore_done", { hasSession: true });
        return;
      }
      setSession(data.session);
      setLoading(false);
      perfMark("session_restore_done", { hasSession: !!data.session });
    });

    // Perf pass 2 finding: supabase-js fires an INITIAL_SESSION event here
    // shortly after getSession() above already resolved, with a new session
    // object referencing the *same* access_token. Calling setSession()
    // unconditionally made that a second "real" state change (new object
    // reference), which re-ran every consumer effect keyed on `session` —
    // concretely, PersonaProvider's bootstrap fetch — a second time on every
    // cold start (confirmed via [PERF] logs: two bootstrap_request_start
    // marks a few ms apart). Skipping the update when the token hasn't
    // actually changed keeps every other event (real sign-in, sign-out,
    // token refresh) working exactly as before.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession((current) => {
        if (current?.access_token === newSession?.access_token) return current;
        return newSession;
      });
      if (newSession) setDemoMode(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const enterDemoMode = useCallback(() => {
    if (!areMocksAllowed()) return;
    setDemoMode(true);
    setLoading(false);
  }, []);

  // M22.13 — logout clears the Supabase session (which itself wipes the
  // encrypted secure-store blob, see secure-session-store.ts) and any local
  // demo-mode flag. Bootstrap/persona cache lives in PersonaProvider, which
  // resets itself in response to `session` becoming null (see
  // persona-context.tsx) — no separate cache-clear call needed here.
  const signOut = useCallback(async () => {
    setDemoMode(false);
    if (session) {
      await supabase.auth.signOut();
    }
    setSession(null);
  }, [session]);

  const signInWithCustomToken = useCallback(async () => {
    throw new Error(
      "signInWithCustomToken is only available when EXPO_PUBLIC_IDENTITY_PROVIDER=firebase",
    );
  }, []);

  // Perf audit finding: this object literal was rebuilt every render with
  // no memoization, so every useAuth() consumer re-rendered on any change
  // to any field, even ones it doesn't read.
  return useMemo(
    () => ({ session, loading, demoMode, signOut, enterDemoMode, signInWithCustomToken }),
    [session, loading, demoMode, signOut, enterDemoMode, signInWithCustomToken],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hook choice is a build-time constant (env var), not conditional per
  // render — safe despite looking like "calling a hook conditionally":
  // USE_FIREBASE never changes within a running app instance.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const value = USE_FIREBASE ? useFirebaseAuthProvider() : useSupabaseAuthProvider();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Re-exported so LoginScreen can gate its own demo button without importing
// AuthProvider internals — the real gate logic lives in mock-policy.ts.
export { areMocksAllowed } from "./mock-policy";
