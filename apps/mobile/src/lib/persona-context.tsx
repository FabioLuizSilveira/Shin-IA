import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import { fetchBootstrap, type BootstrapResponse } from "./bootstrap";
import { perfMark } from "./perf-trace";

// M22.7 — PersonaRouter: the one place that resolves session -> bootstrap ->
// userType, so screens never do `if (userType === ...)` themselves. Renamed
// "PersonaProvider" here (the router/branching component itself lives in
// navigation.tsx, which reads `usePersona()`); this file only owns identity
// resolution + caching, matching the same separation already used for
// auth-context.tsx (session resolution) vs. navigation.tsx (routing).
type PersonaStatus = "loading" | "ready" | "error" | "unauthenticated";

interface PersonaContextValue {
  status: PersonaStatus;
  bootstrap: BootstrapResponse | null;
  error: string | null;
  refetch: () => void;
}

const PersonaContext = createContext<PersonaContextValue>({
  status: "loading",
  bootstrap: null,
  error: null,
  refetch: () => {},
});

// M22 — demo mode never touches the network; it hands the router a fixed,
// clearly-fake bootstrap payload so the tenant_user shell can be previewed
// without a real session. Only reachable when mock-policy.ts's
// areMocksAllowed() is true (enforced in auth-context.tsx's enterDemoMode,
// not re-checked here — this file trusts demoMode already means "allowed").
const DEMO_BOOTSTRAP: BootstrapResponse = {
  schemaVersion: 1,
  user: { id: "demo-user", email: "demo@shinaia.com.br", userType: "tenant_user" },
  tenant: { id: "demo-tenant", name: "Shinã Demo", slug: "demo" },
  branding: null,
  roles: ["tenant_owner"],
  permissions: [],
  entitlements: [],
  features: {},
};

export function PersonaProvider({ children }: { children: ReactNode }) {
  const { session, demoMode, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<PersonaStatus>("loading");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (demoMode) {
      setBootstrap(DEMO_BOOTSTRAP);
      setStatus("ready");
      setError(null);
      return;
    }

    if (!session) {
      // M22.13 — session gone (logout, expiry with no refresh) means the
      // persona cache resets too; there is no separate "clear bootstrap
      // cache" step to remember on logout, it falls out of this effect.
      setBootstrap(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    perfMark("persona_resolution_start");
    fetchBootstrap()
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        setStatus("ready");
        setError(null);
        perfMark("persona_resolution_done", { userType: data.user.userType });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBootstrap(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load bootstrap");
        perfMark("persona_resolution_error");
      });
    return () => {
      cancelled = true;
    };
  }, [session, demoMode, authLoading, refetchToken]);

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  // Perf audit finding: unmemoized value object meant any consumer reading
  // only `bootstrap` (large, rarely-changing) also re-rendered on every
  // `status` transition (loading -> ready etc.), and vice versa.
  const value = useMemo(
    () => ({ status, bootstrap, error, refetch }),
    [status, bootstrap, error, refetch],
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  return useContext(PersonaContext);
}
