import { shinaia, ApiError } from "./shinaia-api";

// Same RLS→API migration as apps/web's rentals-portal.ts (see that file's
// header comment for the full reasoning): a Firebase session has no
// auth.uid() RLS can key off, so a direct-PostgREST client here silently
// returned empty data under Firebase (confirmed live this session — the
// Customer Demo login worked but showed no rentals). Every exported
// function below keeps its original signature and now goes through
// shinaia-api.ts's request()/get() helpers instead of the supabase client
// directly, so no screen needed to change.

function toUserError(error: unknown, fallback: string): Error {
  console.error("[rentals]", error);
  return error instanceof ApiError ? error : new Error(fallback);
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

export async function fetchMyRentals(): Promise<Rental[]> {
  try {
    const { data } = await shinaia.customerContracts();
    return data as Rental[];
  } catch (err) {
    throw toUserError(err, "Não foi possível carregar seus contratos.");
  }
}

export async function fetchMyRentalCustomerId(): Promise<string> {
  try {
    const { data } = await shinaia.customerMe();
    if (!data) throw new Error("Not signed in");
    return data.customerId;
  } catch (err) {
    throw toUserError(err, "Não foi possível identificar seu cadastro.");
  }
}

export async function fetchServiceRequests(contractId: string): Promise<ServiceRequest[]> {
  try {
    const { data } = await shinaia.customerServiceRequests(contractId);
    return data as ServiceRequest[];
  } catch (err) {
    throw toUserError(err, "Não foi possível carregar os pedidos.");
  }
}

export async function createServiceRequest(input: {
  tenantContractId: string;
  rentalCustomerId: string;
  tenantId: string;
  type: "extension" | "issue";
  message: string;
}) {
  // rentalCustomerId/tenantId kept in the signature for call-site
  // compatibility but never sent — the server derives both fresh from the
  // verified session (see apps/web's api/mobile/customer/contracts/[id]/
  // service-requests/route.ts, shared by web and mobile).
  try {
    await shinaia.customerCreateServiceRequest(input.tenantContractId, {
      type: input.type,
      message: input.message,
    });
  } catch (err) {
    throw toUserError(err, "Não foi possível enviar seu pedido.");
  }
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
  try {
    const { data } = await shinaia.customerUpgradeOptions(tenantId, minWeeklyRate);
    return data as UpgradeOption[];
  } catch (err) {
    throw toUserError(err, "Não foi possível carregar os veículos disponíveis.");
  }
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
  try {
    const { data } = await shinaia.customerInvoices();
    return data as CustomerInvoice[];
  } catch (err) {
    throw toUserError(err, "Não foi possível carregar suas faturas.");
  }
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
  try {
    const { data } = await shinaia.customerReservations();
    return data as Reservation[];
  } catch (err) {
    throw toUserError(err, "Não foi possível carregar suas reservas.");
  }
}
