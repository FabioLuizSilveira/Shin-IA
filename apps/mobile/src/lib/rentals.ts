import { supabase } from "./supabase";

// Mobile talks directly to PostgREST (see apps/mobile architecture notes) — there is
// no Next.js API layer to sanitize errors the way lib/api-error.ts's internalError()
// does for apps/web and apps/mkt. Raw PostgREST/Postgres errors can include RLS-denial
// details or internal table/column names, so they're logged for debugging but never
// forwarded verbatim to the UI.
function toUserError(error: unknown, fallback: string): Error {
  console.error("[rentals]", error);
  return new Error(fallback);
}

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
  "contract_assets(id, quantity, assets(id, name, category, status))";

// RLS (contracts_select_rental_customer / contract_assets_select_rental_customer /
// assets_select_rental_customer, see 20260055000000_rental_customers.sql)
// scopes this to only the contracts of organizations the signed-in customer
// is linked to — no tenant_id filter needed client-side.
export async function fetchMyRentals(): Promise<Rental[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select(RENTAL_SELECT)
    .order("period_starts_at", { ascending: false });
  if (error) throw toUserError(error, "Não foi possível carregar seus contratos.");
  return (data ?? []) as unknown as Rental[];
}

export async function fetchMyRentalCustomerId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw toUserError(error, "Não foi possível identificar seu cadastro.");
  return data.id;
}

export async function fetchServiceRequests(contractId: string): Promise<ServiceRequest[]> {
  const { data, error } = await supabase
    .from("rental_service_requests")
    .select("id, type, message, status, created_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw toUserError(error, "Não foi possível carregar os pedidos.");
  return data ?? [];
}

export async function createServiceRequest(input: {
  tenantContractId: string;
  rentalCustomerId: string;
  tenantId: string;
  type: "extension" | "issue";
  message: string;
}) {
  const { error } = await supabase.from("rental_service_requests").insert({
    contract_id: input.tenantContractId,
    rental_customer_id: input.rentalCustomerId,
    tenant_id: input.tenantId,
    type: input.type,
    message: input.message,
  });
  if (error) throw toUserError(error, "Não foi possível enviar seu pedido.");
}

export interface UpgradeOption {
  id: string;
  name: string;
  serial_number: string | null;
  metadata: { photo_url?: string; brand?: string; model?: string; weekly_rate?: number };
}

// assets_select_rental_customer_catalog (20260090000000) scopes this to
// status='available' assets within a tenant the customer already rents
// from — never the whole fleet, and never anything currently rented out.
// weekly_rate >= the current rental's own rate is what makes this "equal
// or higher value" rather than a generic browse-everything list — done
// client-side because PostgREST's gte()/order() on a jsonb->>text column
// compares lexicographically (as a string), not numerically: "750.00"
// sorts *above* "1000.00" that way, letting cheaper cars slip through a
// server-side gte filter meant to exclude them.
export async function fetchUpgradeOptions(
  tenantId: string,
  minWeeklyRate: number,
): Promise<UpgradeOption[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, name, serial_number, metadata")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .eq("category", "vehicle");
  if (error) throw toUserError(error, "Não foi possível carregar os veículos disponíveis.");
  return ((data ?? []) as unknown as UpgradeOption[])
    .filter((a) => Number(a.metadata?.weekly_rate ?? 0) >= minWeeklyRate)
    .sort((a, b) => Number(a.metadata?.weekly_rate ?? 0) - Number(b.metadata?.weekly_rate ?? 0));
}

export interface CustomerInvoice {
  id: string;
  status: string;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at: string | null;
}

// invoices_select_rental_customer (20260090000000) — the customer's own
// invoices only, via their billing_accounts' organization link.
export async function fetchMyInvoices(): Promise<CustomerInvoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, status, total_amount, total_currency, due_date, paid_at")
    .order("due_date", { ascending: false })
    .limit(10);
  if (error) throw toUserError(error, "Não foi possível carregar suas faturas.");
  return (data ?? []) as unknown as CustomerInvoice[];
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

// rental_reservations_select_rental_customer (20260091000000) — the
// customer's own booking holds, real deposit/balance state driven entirely
// by the Stripe webhook (see api/webhooks/stripe), never written from here.
export async function fetchMyReservations(): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from("rental_reservations")
    .select(
      "id, tenant_id, asset_id, period_starts_at, period_ends_at, total_amount, total_currency, " +
        "deposit_amount, balance_amount, status, assets(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw toUserError(error, "Não foi possível carregar suas reservas.");
  return (data ?? []) as unknown as Reservation[];
}
