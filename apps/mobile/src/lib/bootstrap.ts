import { supabase } from "./supabase";
import { getFirebaseAuth } from "./firebase";
import { perfMark, PERF_TRACE_ENABLED } from "./perf-trace";

const USE_FIREBASE = process.env.EXPO_PUBLIC_IDENTITY_PROVIDER === "firebase";

// M22.6 — the official source for user/userType/tenant/branding/roles/
// permissions/entitlements/features/navigation. Never build persona from
// user_metadata, a manually-decoded JWT, an email domain, or a local flag —
// this is the only call allowed to decide userType.
export interface BootstrapOrganization {
  organizationId: string;
  tenantId: string;
}

export interface BootstrapResponse {
  schemaVersion: number;
  user: {
    id: string;
    email: string | null;
    userType: "tenant_user" | "customer" | "operator" | "unprovisioned";
  };
  tenant: { id: string; name: string; slug: string } | null;
  branding: Record<string, unknown> | null;
  roles: string[];
  permissions: string[];
  entitlements: string[];
  features: Record<string, boolean>;
  organizations?: BootstrapOrganization[];
}

const API_BASE = (process.env.EXPO_PUBLIC_SHINAIA_API_URL ?? "").replace(/\/$/, "");

export class BootstrapError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  if (!API_BASE) {
    throw new BootstrapError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
  }

  const token = USE_FIREBASE
    ? await getFirebaseAuth().currentUser?.getIdToken()
    : (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new BootstrapError("No active session", 401);
  }
  perfMark("access_token_available");

  let res: Response;
  const clientStart = Date.now();
  perfMark("bootstrap_request_start");
  try {
    res = await fetch(`${API_BASE}/api/mobile/bootstrap`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(PERF_TRACE_ENABLED ? { "x-perf-trace": "1" } : {}),
      },
    });
  } catch {
    throw new BootstrapError("Network error");
  }

  if (!res.ok) {
    throw new BootstrapError(`HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as {
    data: BootstrapResponse & { _perf?: Record<string, number> };
  };
  perfMark("bootstrap_response", {
    clientMs: Date.now() - clientStart,
    serverMs: json.data._perf?.totalMs ?? -1,
    contextMs: json.data._perf?.contextResolutionMs ?? -1,
  });
  return json.data;
}
