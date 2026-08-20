import { supabase } from "./supabase";
import { areMocksAllowed } from "./mock-policy";
import { MOCK } from "./mocks";

// M22/M23 — typed data-access layer. Single point of HTTP for the whole
// app; no screen ever calls fetch() directly. Paths corrected against the
// M21 migration map / the real routes in apps/web/src/app/api. Mocks only
// ever return when areMocksAllowed() is true (dev + EXPO_PUBLIC_ENABLE_MOCKS=1)
// AND the live call actually fails/is unconfigured — staging/production
// builds can never reach the mock branch (mock-policy.ts).
const API_BASE = (process.env.EXPO_PUBLIC_SHINAIA_API_URL ?? "").replace(/\/$/, "");

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

// Perf audit finding: request() had no timeout — a hung request (dead
// network, backend stall) blocked the caller indefinitely with no cutoff,
// which section 14 of the audit spec explicitly calls out ("loading não
// pode bloquear indefinidamente").
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  method: "GET" | "PATCH" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!API_BASE) throw new ApiError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
  const headers = await authHeader();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("A solicitação demorou demais para responder.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson?.error) message = errJson.error;
    } catch {
      /* ignore parse failure, keep generic status message */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

// GET with mock fallback — read paths only. Never throws for the caller
// when mocks are allowed; propagates a real error otherwise (M23 rule 2:
// "API falhou → error/offline/retry", never a silent mock in prod).
async function get<T>(path: string, mock: T): Promise<{ data: T; source: "live" | "mock" }> {
  try {
    const data = await request<T>("GET", path);
    return { data, source: "live" };
  } catch (err) {
    if (areMocksAllowed()) {
      await new Promise((r) => setTimeout(r, 200));
      return { data: mock, source: "mock" };
    }
    throw err;
  }
}

// Mutations never fall back to mock — a write must always reflect what the
// server actually did, or fail loudly.
async function mutate<T>(method: "PATCH" | "POST", path: string, body?: unknown): Promise<T> {
  return request<T>(method, path, body);
}

export interface DashboardSummary {
  [key: string]: unknown;
}
export interface OperationItem {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  started_at: string | null;
  completed_at: string | null;
  description: string | null;
  resources: { id: string; name: string; type: string; status: string } | null;
  assets: { id: string; name: string; category: string; status: string } | null;
}
export interface OperationDetail extends OperationItem {
  allowedActions: string[];
  contractGate: { blocked: boolean; reasons: string[] } | null;
  trackingSummary: { latitude: number; longitude: number; recordedAt: string } | null;
}
export interface AssetItem {
  id: string;
  name: string;
  serial_number: string | null;
  category: string;
  status: string;
  branch_id: string;
  asset_type_id: string;
  type_name?: string;
  metadata?: { photo_url?: string; [key: string]: unknown };
}
export interface ContractItem {
  id: string;
  type: string;
  status: string;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
  template_id: string | null;
  organization_id: string;
}
export interface ContractDetail extends ContractItem {
  snapshot: { id: string; rendered_content: string } | null;
  version: number | null;
  acceptance: { accepted: boolean };
  billing: { type: string; satisfied: boolean };
  documents: { allApproved: boolean };
  allowedActions: string[];
}
export interface NotificationItem {
  id: string;
  subject: string;
  body: string;
  priority: string;
  status: string;
  created_at: string;
  read_at: string | null;
}
export interface OrganizationItem {
  id: string;
  name: string;
  trade_name: string | null;
  type: string;
  document: string;
}
export interface OperatorItem {
  id: string;
  full_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}
export interface InvoiceItem {
  id: string;
  status: string;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at: string | null;
}
export interface BillingSummary {
  receivables: { amount: number; currency: string; count: number };
  overdue: { amount: number; currency: string; count: number };
  paid: { amount: number; currency: string; count: number };
  nextDue: { invoiceId: string; amount: number; currency: string; dueDate: string } | null;
}

export const shinaia = {
  // Pre-auth — the mobile login screen's "Demonstração" button. Signs in as
  // one of two real, dedicated demo accounts against the real Veloz Rent a
  // Car tenant (no mocks); the caller passes the resulting tokens straight
  // into supabase.auth.setSession().
  demoLogin: (persona: "tenant" | "customer") =>
    request<{ access_token: string; refresh_token: string }>("POST", "/api/mobile/demo-login", {
      persona,
    }),

  // Customer contract renewal — real Stripe Checkout, no fake mocks (the
  // demo customer login already gets real data; these hit the real
  // payment routes too). "Só pagar para renovar" — paying the returned
  // checkout URL is what renews the contract, via the Stripe webhook.
  customerRenewalCheckout: (contractId: string) =>
    request<{ url: string }>("POST", "/api/mobile/customer/renewal-checkout", { contractId }),
  customerAssetAvailability: (assetId: string) =>
    get<{ start: string; end: string }[]>(
      `/api/mobile/customer/asset-availability?assetId=${assetId}`,
      [],
    ),
  customerCreateReservation: (input: { assetId: string; startsAt: string; endsAt: string }) =>
    request<{
      url: string;
      reservationId: string;
      deposit: number;
      balance: number;
      total: number;
    }>("POST", "/api/mobile/customer/reservations", input),
  customerReservationBalanceCheckout: (reservationId: string) =>
    request<{ url: string }>(
      "POST",
      `/api/mobile/customer/reservations/${reservationId}/balance-checkout`,
    ),

  dashboard: () => get<DashboardSummary>("/api/mobile/dashboard", MOCK.dashboard),

  operations: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get<OperationItem[]>(`/api/mobile/operations${qs ? `?${qs}` : ""}`, MOCK.operations);
  },
  operationDetail: (id: string) =>
    get<OperationDetail>(
      `/api/mobile/operations/${id}`,
      MOCK.operations[0] as unknown as OperationDetail,
    ),
  // Mutation — real server-side re-validation (permission + status machine +
  // contract gate) happens in the route itself; allowedActions from the
  // detail call is only a UI hint, never trusted as the real check.
  updateOperationStatus: (id: string, status: string) =>
    mutate<{ ok: true }>("PATCH", `/api/operations/${id}`, { status }),

  assets: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get<AssetItem[]>(`/api/mobile/assets${qs ? `?${qs}` : ""}`, MOCK.assets);
  },
  asset: (id: string) => get<AssetItem>(`/api/mobile/assets/${id}`, MOCK.assets[0]),

  contracts: () => get<ContractItem[]>("/api/mobile/contracts", MOCK.contracts),
  contractDetail: (id: string) =>
    get<ContractDetail>(
      `/api/mobile/contracts/${id}`,
      MOCK.contracts[0] as unknown as ContractDetail,
    ),
  acceptContract: (id: string, dataProcessingConsent?: boolean) =>
    mutate<{ acceptanceId: string }>("POST", `/api/customer-contracts/${id}/accept`, {
      dataProcessingConsent,
    }),

  contractDocuments: (contractId: string) =>
    get<{
      requirements: { id: string; key: string; label: string; is_mandatory: boolean }[];
      documents: {
        id: string;
        requirement_id: string;
        status: string;
        original_filename: string;
      }[];
    }>(`/api/customer-contracts/${contractId}/documents`, MOCK.documents),
  documentDownloadUrl: (contractId: string, documentId: string) =>
    mutate<{ url: string; expiresAt: string }>(
      "POST",
      `/api/customer-contracts/${contractId}/documents/${documentId}/url`,
    ),
  // Staff review — tenant_user only; server enforces via requireTenantScope.
  reviewDocument: (
    contractId: string,
    documentId: string,
    status: "approved" | "rejected",
    reviewNotes?: string,
  ) =>
    mutate<{ id: string; status: string }>(
      "PATCH",
      `/api/contracts/${contractId}/documents/${documentId}`,
      { status, review_notes: reviewNotes },
    ),

  // Same staff-route-reuse pattern as organizations()/operators() (Wave 2
  // Phase D) — no /api/mobile/* duplicate exists for the fleet-wide map,
  // just the one requireTenantScope() route the web tracking page already
  // uses.
  fleetLocations: () =>
    get<
      {
        resource_id: string;
        resource_name: string | null;
        resource_type: string | null;
        resource_status: string | null;
        latitude: number;
        longitude: number;
        recorded_at: string;
      }[]
    >("/api/resources/locations", []),

  trackingCurrent: (resourceId: string) =>
    get<{
      resourceId: string;
      latitude: number;
      longitude: number;
      recordedAt: string;
      speed?: number;
    } | null>(`/api/mobile/tracking/${resourceId}/current`, null),
  trackingHistory: (resourceId: string, limit = 100) =>
    get<{ latitude: number; longitude: number; recorded_at: string }[]>(
      `/api/mobile/tracking/${resourceId}/history?limit=${limit}`,
      MOCK.tracking,
    ),

  notifications: () => get<NotificationItem[]>("/api/mobile/notifications", MOCK.notifications),
  markNotificationsRead: (ids?: string[], all?: boolean) =>
    mutate<{ ok: true }>("PATCH", "/api/mobile/notifications", ids ? { ids } : { all }),

  registerDevice: (input: {
    deviceId: string;
    pushToken?: string;
    platform: "ios" | "android";
    appVersion?: string;
  }) =>
    mutate<{ id: string; device_id: string; platform: string; enabled: boolean }>(
      "POST",
      "/api/mobile/devices",
      input,
    ),
  disableDevice: (deviceId: string) =>
    mutate<{ ok: true }>("PATCH", `/api/mobile/devices/${deviceId}`, undefined),

  // Customers/Operators listing — tenant_user only, reuses the existing
  // staff routes directly (not duplicated as /api/mobile/*, per the Wave 2
  // Phase D reuse decision already verified live in this session).
  organizations: () => get<OrganizationItem[]>("/api/organizations", MOCK.clients),
  operators: () => get<OperatorItem[]>("/api/operators", MOCK.operators),
  myCustomerProfile: () =>
    get<{ profile: Record<string, unknown>; organizations: unknown[]; contracts: unknown[] }>(
      "/api/mobile/customers/me",
      { profile: {}, organizations: [], contracts: [] },
    ),
  myOperatorProfile: () =>
    get<{ profile: Record<string, unknown>; assignments: unknown[] }>("/api/mobile/operators/me", {
      profile: {},
      assignments: [],
    }),

  billingSummary: () => get<BillingSummary>("/api/mobile/billing/summary", MOCK.financial),
  invoices: () => get<InvoiceItem[]>("/api/mobile/invoices", MOCK.invoices),
  commissionsSummary: () =>
    get<{ currency: string; byStatus: Record<string, { amount: number; count: number }> }>(
      "/api/mobile/commissions/summary",
      { currency: "BRL", byStatus: {} },
    ),

  reportsSummary: (range = "30d") =>
    get<{
      period: { start: string; end: string };
      kpis: {
        type: string;
        label: string;
        value: number;
        unit: string;
        changePercent: number | null;
      }[];
    }>(`/api/mobile/reports/summary?range=${range}`, MOCK.reports),
};

export { ApiError };
