import { supabase } from "./supabase";
import { getFirebaseAuth } from "./firebase";
import { areMocksAllowed } from "./mock-policy";
import { MOCK } from "./mocks";
import { perfMark, PERF_TRACE_ENABLED } from "./perf-trace";

const USE_FIREBASE = process.env.EXPO_PUBLIC_IDENTITY_PROVIDER === "firebase";

// M22/M23 — typed data-access layer. Single point of HTTP for the whole
// app; no screen ever calls fetch() directly. Paths corrected against the
// M21 migration map / the real routes in apps/web/src/app/api. Mocks only
// ever return when areMocksAllowed() is true (dev + EXPO_PUBLIC_ENABLE_MOCKS=1)
// AND the live call actually fails/is unconfigured — staging/production
// builds can never reach the mock branch (mock-policy.ts).
const API_BASE = (process.env.EXPO_PUBLIC_SHINAIA_API_URL ?? "").replace(/\/$/, "");

async function authHeader(): Promise<Record<string, string>> {
  if (USE_FIREBASE) {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
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
  const isDashboard = path.startsWith("/api/mobile/dashboard");
  const clientStart = Date.now();
  if (isDashboard) perfMark("dashboard_request_start");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(PERF_TRACE_ENABLED ? { "x-perf-trace": "1" } : {}),
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
  if (isDashboard) {
    const clone = res.clone();
    clone
      .json()
      .then((j: { data?: { _perf?: Record<string, number> } }) => {
        perfMark("dashboard_response", {
          clientMs: Date.now() - clientStart,
          status: res.status,
          serverMs: j.data?._perf?.totalMs ?? -1,
        });
      })
      .catch(() =>
        perfMark("dashboard_response", { clientMs: Date.now() - clientStart, status: res.status }),
      );
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

// ── Inspection Engine (docs/architecture/INSPECTION_ENGINE.md) ─────────────
// Types kept intentionally loose rather than re-deriving from
// @shina/inspection-engine — this app has no workspace dependency on that
// package, same posture already used for OperationItem/AssetItem above.
// IMPORTANT: template items/sections are camelCase, NOT snake_case —
// they come back through createInspectionTemplateRepository
// (apps/web/src/lib/inspection-repository.ts), which maps DB rows to
// packages/inspection-engine/src/types.ts's HydratedInspectionTemplate
// shape (fieldType/minPhotos/selectOptions/sortOrder). Found live via a
// real browser E2E test: this file previously claimed snake_case here,
// which silently made every photo/boolean/select/condition item on the
// real capture screen fall through to a plain text input — the same bug
// existed on the Customer Portal's web fill page and was fixed there
// first. Responses/media below (item_id, value_text, etc.) are genuinely
// snake_case — those come from raw Supabase rows, not the repository.
export interface InspectionTemplateItem {
  id: string;
  sectionId?: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  instructions: string | null;
  referenceImageUrl: string | null;
  minPhotos: number | null;
  maxPhotos: number | null;
  selectOptions: { value: string; label: string; severity?: string }[] | null;
  condition: { field: string; op: string; value: unknown } | null;
  approvalGate: boolean;
  sortOrder: number;
}
export interface InspectionTemplateSection {
  id: string;
  key: string;
  title: string;
  instructions: string | null;
  sortOrder: number;
  items: InspectionTemplateItem[];
}
export interface InspectionTemplate {
  id: string;
  name: string;
  status: string;
  sections: InspectionTemplateSection[];
}
export interface InspectionListItem {
  id: string;
  asset_id: string;
  type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}
export interface InspectionResponseItem {
  id: string;
  item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: { value: string; label: string; severity?: string } | null;
  notes: string | null;
}
export interface InspectionMediaItem {
  id: string;
  item_id: string | null;
  finding_id: string | null;
  media_type: string;
  storage_path: string;
}
export interface InspectionFindingItem {
  id: string;
  item_id: string | null;
  description: string;
  severity: string;
  status: string;
  ai_suggested: boolean;
}
export interface InspectionDetail {
  inspection: InspectionListItem & { linked_inspection_id: string | null };
  template: InspectionTemplate | null;
  responses: InspectionResponseItem[];
  media: InspectionMediaItem[];
  findings: InspectionFindingItem[];
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

  // Firebase equivalent of demoLogin() above — mints a custom token
  // server-side (apps/web's api/auth/firebase/demo-login, shared with the
  // web login screen) so the app never handles the demo account's real
  // password. LoginScreen exchanges the token for a real Firebase session
  // via signInWithCustomToken.
  firebaseDemoLogin: (persona: "tenant" | "customer") =>
    request<{ customToken: string }>("POST", "/api/auth/firebase/demo-login", { persona }),

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

  // Same RLS→API migration as apps/web's rentals-portal.ts — a Firebase
  // session has no auth.uid() RLS can key off, so these can no longer go
  // straight to PostgREST the way they used to (see rentals.ts, which now
  // just calls these instead of querying Supabase directly).
  customerMe: () => get<{ customerId: string } | null>("/api/mobile/customer/me", null),
  customerContracts: () => get<unknown[]>("/api/mobile/customer/contracts", []),
  customerServiceRequests: (contractId: string) =>
    get<unknown[]>(`/api/mobile/customer/contracts/${contractId}/service-requests`, []),
  customerCreateServiceRequest: (
    contractId: string,
    input: { type: "extension" | "issue"; message: string },
  ) =>
    request<{ ok: true }>(
      "POST",
      `/api/mobile/customer/contracts/${contractId}/service-requests`,
      input,
    ),
  customerUpgradeOptions: (tenantId: string, minWeeklyRate: number) =>
    get<unknown[]>(
      `/api/mobile/customer/upgrade-options?tenantId=${encodeURIComponent(tenantId)}&minWeeklyRate=${minWeeklyRate}`,
      [],
    ),
  customerInvoices: () => get<unknown[]>("/api/mobile/customer/invoices", []),
  customerReservations: () => get<unknown[]>("/api/mobile/customer/reservations", []),

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

  // Inspection Engine — no mock fallback on any of these (item 29 of the
  // spec: never present simulated data as a real feature; a checklist and
  // its findings are exactly the kind of thing that must never be faked).
  //
  // `scope` picks the base path: "staff" hits /api/inspections
  // (requireTenantScope — tenant_user persona, sees every tenant
  // inspection it has permission for), "operator" hits
  // /api/mobile/operator-inspections (requireMobileContext — operator
  // persona, server-side filtered to only inspections assigned to that
  // operator). Same request/response shapes either way, so
  // InspectionsScreen/InspectionCaptureScreen work unmodified for both
  // personas — only the base path differs. Defaults to "staff" so every
  // existing call site keeps working unchanged.
  inspectionsBasePath: (scope: "staff" | "operator") =>
    scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections",
  inspections: (params?: { assetId?: string; status?: string; scope?: "staff" | "operator" }) => {
    const base =
      params?.scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
    const qs = new URLSearchParams();
    if (params?.assetId) qs.set("assetId", params.assetId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<InspectionListItem[]>("GET", `${base}${suffix}`).then((data) => ({
      data,
      source: "live" as const,
    }));
  },
  inspectionDetail: (id: string, scope: "staff" | "operator" = "staff") => {
    const base = scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
    return request<InspectionDetail>("GET", `${base}/${id}`).then((data) => ({
      data,
      source: "live" as const,
    }));
  },
  createInspection: (input: {
    assetId: string;
    type: string;
    purpose: "check_in" | "check_out";
    blueprintId?: string;
    contractId?: string;
    linkedInspectionId?: string;
  }) =>
    mutate<{ id: string; templateId: string; status: string }>("POST", "/api/inspections", input),
  transitionInspection: (id: string, status: string, scope: "staff" | "operator" = "staff") => {
    const base = scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
    return request<{ ok: true }>("PATCH", `${base}/${id}`, { status });
  },
  saveInspectionResponse: (
    inspectionId: string,
    itemId: string,
    value: {
      valueText?: string | null;
      valueNumber?: number | null;
      valueBoolean?: boolean | null;
      valueJson?: unknown;
      notes?: string | null;
    },
    scope: "staff" | "operator" = "staff",
  ) => {
    const base = scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
    return mutate<{ ok: true }>("PATCH", `${base}/${inspectionId}/items/${itemId}`, value);
  },
  compareInspection: (id: string) =>
    mutate<{ comparisons: unknown[] }>("POST", `/api/inspections/${id}/compare`, undefined),
  signInspection: (id: string, scope: "staff" | "operator" = "operator") => {
    const base = scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
    return mutate<{ id: string; documentHash: string }>("POST", `${base}/${id}/sign`, undefined);
  },

  // Damage overlay (item 12 of the spec) — operator-only on mobile (staff
  // review of the same data happens on Tenant Web, via its own routes —
  // /api/findings is a flat route there, not nested under
  // /api/inspections/:id, so these three don't take a "staff" scope
  // variant the way the other inspection methods do). Signed URL to
  // review a captured photo, create the finding with its overlay_region,
  // then link the specific photo to it.
  inspectionMediaUrl: (inspectionId: string, mediaId: string) =>
    request<{ url: string }>(
      "GET",
      `/api/mobile/operator-inspections/${inspectionId}/media/${mediaId}/url`,
    ),
  createFinding: (
    inspectionId: string,
    input: {
      itemId?: string;
      description: string;
      severity: "low" | "medium" | "high" | "critical";
      overlayRegion?: { type: "rectangle"; x: number; y: number; width: number; height: number };
    },
  ) =>
    mutate<{ id: string; status: string }>(
      "POST",
      `/api/mobile/operator-inspections/${inspectionId}/findings`,
      input,
    ),
  linkMediaToFinding: (inspectionId: string, mediaId: string, findingId: string | null) =>
    mutate<{ ok: true }>(
      "PATCH",
      `/api/mobile/operator-inspections/${inspectionId}/media/${mediaId}`,
      { findingId },
    ),

  // Multipart upload — the only endpoint that isn't JSON, so it bypasses
  // request()/mutate() entirely and builds its own fetch call, reusing
  // authHeader() for the same Firebase/Supabase branching every other call
  // gets. photoUri is a local file:// URI (from expo-camera's
  // takePictureAsync or an already-picked file); expo-file-system's File
  // class implements Blob so it can go straight into FormData.
  async uploadInspectionMedia(
    inspectionId: string,
    photoUri: string,
    options: {
      itemId?: string;
      mimeType?: string;
      fileName?: string;
      latitude?: number;
      longitude?: number;
      scope?: "staff" | "operator";
    } = {},
  ): Promise<{ id: string; storagePath: string }> {
    if (!API_BASE) throw new ApiError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
    const headers = await authHeader();

    const form = new FormData();
    // React Native's FormData accepts this {uri, name, type} shape
    // directly (unlike web FormData, which needs a real Blob/File) — the
    // long-standing RN idiom, still current per the SDK 56 docs fetched
    // for this module (expo-file-system's new File class is Blob-shaped
    // for web `fetch`, but isn't needed here since RN's own fetch
    // polyfill already knows this {uri,name,type} shape).
    form.append("file", {
      uri: photoUri,
      name: options.fileName ?? `photo-${Date.now()}.jpg`,
      type: options.mimeType ?? "image/jpeg",
    } as unknown as Blob);
    if (options.itemId) form.append("itemId", options.itemId);
    if (options.latitude !== undefined) form.append("latitude", String(options.latitude));
    if (options.longitude !== undefined) form.append("longitude", String(options.longitude));
    form.append("captureSource", "mobile_camera");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // uploads get more time than REQUEST_TIMEOUT_MS
    let res: Response;
    try {
      const base =
        options.scope === "operator" ? "/api/mobile/operator-inspections" : "/api/inspections";
      res = await fetch(`${API_BASE}${base}/${inspectionId}/media`, {
        method: "POST",
        headers: { Accept: "application/json", ...headers }, // no Content-Type — fetch sets the multipart boundary itself
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiError("O envio da foto demorou demais.");
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
        /* ignore parse failure */
      }
      throw new ApiError(message, res.status);
    }
    const json = (await res.json()) as { data: { id: string; storagePath: string } };
    return json.data;
  },
};

export { ApiError };
