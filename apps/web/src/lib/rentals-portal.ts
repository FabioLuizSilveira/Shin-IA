// Web customer portal data layer — was a direct-Supabase, RLS-only client
// (same architecture as apps/mobile/src/lib/rentals.ts), migrated to go
// through requireMobileContext()-guarded API routes instead. Reason: RLS
// scoping trusts a live Supabase session's auth.uid(), which a Firebase
// session doesn't have — confirmed live this session (a Firebase-
// authenticated Customer Demo login showed an empty portal, exactly the
// silent-failure mode the identity migration's "critical audit finding"
// predicted). requireMobileContext() already resolves the caller's
// identity through the active IdentityProvider (Supabase or Firebase),
// so routing through it here closes that gap for both providers at once.
// Every exported function below keeps its original signature — no caller
// (apps/web/src/app/(customer)/rentals/**) needed to change.

export interface RentalAsset {
  id: string;
  quantity: number;
  assets: {
    id: string;
    name: string;
    category: string;
    status: string;
    metadata: { photo_url?: string } | null;
  } | null;
}

export interface Rental {
  id: string;
  tenant_id: string;
  type: string;
  status: string;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
  contract_assets: RentalAsset[];
  template_id: string | null;
  template_version_id: string | null;
  snapshot_id: string | null;
}

export interface ContractSnapshot {
  id: string;
  rendered_content: string;
  content_hash: string;
}

export interface ServiceRequest {
  id: string;
  type: "extension" | "issue";
  message: string;
  status: "pending" | "approved" | "rejected" | "resolved";
  created_at: string;
}

async function getJson<T>(path: string, fallback: T, errorMessage: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    if (res.status === 404) return fallback;
    console.error("[rentals-portal]", path, res.status);
    throw new Error(errorMessage);
  }
  const json = await res.json().catch(() => ({}));
  return (json.data ?? fallback) as T;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Falha ao processar a solicitação.");
  return json.data as T;
}

export async function fetchMyRentals(): Promise<Rental[]> {
  return getJson("/api/mobile/customer/contracts", [], "Não foi possível carregar seus contratos.");
}

export async function fetchMyRentalCustomerId(): Promise<string> {
  const data = await getJson<{ customerId: string } | null>(
    "/api/mobile/customer/me",
    null,
    "Não foi possível identificar seu cadastro.",
  );
  if (!data) throw new Error("Sessão expirada. Faça login novamente.");
  return data.customerId;
}

export async function fetchServiceRequests(contractId: string): Promise<ServiceRequest[]> {
  return getJson(
    `/api/mobile/customer/contracts/${contractId}/service-requests`,
    [],
    "Não foi possível carregar os pedidos.",
  );
}

// Takes a contractId (not a snapshot id) — the route resolves the
// snapshot via the contract, since ownership can only be verified through
// the contract's organization_id. The one caller ([id]/contract/page.tsx)
// was updated to pass r.id instead of r.snapshot_id accordingly.
export async function fetchContractSnapshot(contractId: string): Promise<ContractSnapshot> {
  const data = await getJson<{ snapshot: ContractSnapshot } | null>(
    `/api/mobile/customer/contracts/${contractId}/snapshot`,
    null,
    "Não foi possível carregar o contrato.",
  );
  if (!data) throw new Error("Não foi possível carregar o contrato.");
  return data.snapshot;
}

export async function fetchDataProcessingLegalBasis(contractId: string): Promise<string | null> {
  const data = await getJson<{ dataProcessingLegalBasis: string | null } | null>(
    `/api/mobile/customer/contracts/${contractId}/snapshot`,
    null,
    "",
  ).catch(() => null);
  return data?.dataProcessingLegalBasis ?? null;
}

export async function acceptContract(
  contractId: string,
  input: { dataProcessingConsent?: boolean } = {},
): Promise<void> {
  const res = await fetch(`/api/customer-contracts/${contractId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Não foi possível registrar o aceite.");
  }
}

export async function createServiceRequest(input: {
  tenantContractId: string;
  rentalCustomerId: string;
  tenantId: string;
  type: "extension" | "issue";
  message: string;
}) {
  // rentalCustomerId/tenantId are accepted for call-site compatibility but
  // never sent — the server derives both fresh from the verified session,
  // never from client input (see [id]/service-requests/route.ts).
  await postJson(`/api/mobile/customer/contracts/${input.tenantContractId}/service-requests`, {
    type: input.type,
    message: input.message,
  });
}

export interface UpgradeOption {
  id: string;
  name: string;
  serial_number: string | null;
  metadata: { photo_url?: string; brand?: string; model?: string; weekly_rate?: number };
}

export async function fetchUpgradeOptions(
  tenantId: string,
  minWeeklyRate: number,
): Promise<UpgradeOption[]> {
  return getJson(
    `/api/mobile/customer/upgrade-options?tenantId=${encodeURIComponent(tenantId)}&minWeeklyRate=${minWeeklyRate}`,
    [],
    "Não foi possível carregar os veículos disponíveis.",
  );
}

export interface CustomerInvoice {
  id: string;
  status: string;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at: string | null;
}

export async function fetchMyInvoices(): Promise<CustomerInvoice[]> {
  return getJson("/api/mobile/customer/invoices", [], "Não foi possível carregar suas faturas.");
}

export interface Reservation {
  id: string;
  tenant_id: string;
  asset_id: string;
  period_starts_at: string;
  period_ends_at: string;
  total_amount: number;
  total_currency: string;
  deposit_amount: number;
  balance_amount: number;
  status: "pending_deposit" | "reserved" | "completed" | "forfeited" | "cancelled";
  assets: { name: string } | null;
}

export async function fetchMyReservations(): Promise<Reservation[]> {
  return getJson(
    "/api/mobile/customer/reservations",
    [],
    "Não foi possível carregar suas reservas.",
  );
}

export async function renewalCheckout(contractId: string): Promise<{ url: string }> {
  return postJson("/api/mobile/customer/renewal-checkout", { contractId });
}

export async function fetchAssetAvailability(
  assetId: string,
): Promise<{ start: string; end: string }[]> {
  const res = await fetch(`/api/mobile/customer/asset-availability?assetId=${assetId}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (json.data ?? []) as { start: string; end: string }[];
}

export async function createReservation(input: {
  assetId: string;
  startsAt: string;
  endsAt: string;
}): Promise<{
  url: string;
  reservationId: string;
  deposit: number;
  balance: number;
  total: number;
}> {
  return postJson("/api/mobile/customer/reservations", input);
}

export async function reservationBalanceCheckout(reservationId: string): Promise<{ url: string }> {
  return postJson(`/api/mobile/customer/reservations/${reservationId}/balance-checkout`);
}
