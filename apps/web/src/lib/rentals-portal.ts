import { createClient } from "@/lib/supabase/client";

// Web mirror of apps/mobile/src/lib/rentals.ts — same tables, same RLS-only
// authorization model (see supabase/migrations/20260055000000_rental_customers.sql):
// a rental customer's session has no tenant_id/platform_role JWT claim at
// all (those only ever apply to tenant staff / platform admins), so every
// query here relies entirely on Postgres RLS scoping by auth.uid(), exactly
// like the mobile app. This is a stopgap web portal for rental customers
// while native app store approval is pending — same backend, same
// authorization, just a responsive page instead of an Expo build.

export interface RentalAsset {
  id: string;
  quantity: number;
  assets: { id: string; name: string; category: string; status: string } | null;
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

const RENTAL_SELECT =
  "id, tenant_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, " +
  "template_id, template_version_id, snapshot_id, " +
  "contract_assets(id, quantity, assets(id, name, category, status))";

// No server-side API layer for this portal (same architectural choice as
// apps/mobile) — talks directly to PostgREST via RLS, so raw Postgres
// errors never reach the UI verbatim (mirrors the mobile app's BAIXO-20
// fix): logged for debugging, replaced with a generic message.
function toUserError(error: unknown, fallback: string): Error {
  console.error("[rentals-portal]", error);
  return new Error(fallback);
}

export async function fetchMyRentals(): Promise<Rental[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(RENTAL_SELECT)
    .order("period_starts_at", { ascending: false });
  if (error) throw toUserError(error, "Não foi possível carregar seus contratos.");
  return (data ?? []) as unknown as Rental[];
}

export async function fetchMyRentalCustomerId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Faça login novamente.");

  const { data, error } = await supabase
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw toUserError(error, "Não foi possível identificar seu cadastro.");
  return data.id;
}

export async function fetchServiceRequests(contractId: string): Promise<ServiceRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rental_service_requests")
    .select("id, type, message, status, created_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw toUserError(error, "Não foi possível carregar os pedidos.");
  return data ?? [];
}

export async function fetchContractSnapshot(snapshotId: string): Promise<ContractSnapshot> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tenant_contract_snapshots")
    .select("id, rendered_content, content_hash")
    .eq("id", snapshotId)
    .single();
  if (error) throw toUserError(error, "Não foi possível carregar o contrato.");
  return data;
}

export async function fetchDataProcessingLegalBasis(contractId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tenant_contract_requirements")
    .select("data_processing_legal_basis")
    .eq("contract_id", contractId)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.data_processing_legal_basis ?? null;
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
  const supabase = createClient();
  const { error } = await supabase.from("rental_service_requests").insert({
    contract_id: input.tenantContractId,
    rental_customer_id: input.rentalCustomerId,
    tenant_id: input.tenantId,
    type: input.type,
    message: input.message,
  });
  if (error) throw toUserError(error, "Não foi possível enviar o pedido.");
}
