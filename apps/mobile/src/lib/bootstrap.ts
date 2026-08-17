import { supabase } from "./supabase";

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

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new BootstrapError("No active session", 401);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/mobile/bootstrap`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new BootstrapError("Network error");
  }

  if (!res.ok) {
    throw new BootstrapError(`HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as { data: BootstrapResponse };
  return json.data;
}
