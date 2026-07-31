import { supabase } from "./supabase";

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
  if (error) throw error;
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
  if (error) throw error;
  return data.id;
}

export async function fetchServiceRequests(contractId: string): Promise<ServiceRequest[]> {
  const { data, error } = await supabase
    .from("rental_service_requests")
    .select("id, type, message, status, created_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw error;
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
  if (error) throw error;
}
