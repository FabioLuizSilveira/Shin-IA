import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
