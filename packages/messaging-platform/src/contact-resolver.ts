import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParticipantType } from "./types.js";

// ContactResolver — spec section 9. Not a parallel CRM: resolves a raw
// external phone number against the REAL, already-tenant-scoped identity
// tables (rental_customers+rental_customer_organizations, operators,
// persons, organizations), never invents a new contact store. Every
// lookup is tenant-scoped — never a global phone search.
//
// Phone matching is by the last 8 digits (robust against +55/DDI/DDD
// formatting variance across these tables, none of which store a
// normalized phone column) — a SQL ILIKE prefilter, then an exact
// digits-only comparison in application code so a coincidental substring
// match never silently resolves to the wrong person (spec section 9:
// "Nunca associar automaticamente com baixa confiança").

export type ResolvedContactType = "customer" | "operator" | "lead" | "unknown";

export interface ResolvedContact {
  type: ResolvedContactType;
  customerId: string | null;
  operatorId: string | null;
  personId: string | null;
  organizationId: string | null;
  displayName: string | null;
}

function normalizeDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function lastDigits(phone: string, n = 8): string {
  const digits = normalizeDigits(phone);
  return digits.slice(-n);
}

function matches(candidate: string | null, externalWaId: string): boolean {
  const a = normalizeDigits(candidate);
  const b = normalizeDigits(externalWaId);
  if (!a || !b) return false;
  // compare on the shorter suffix length so a stored number without a
  // country code still matches a wa_id that includes one, and vice-versa.
  const len = Math.min(a.length, b.length, 11);
  return a.slice(-len) === b.slice(-len);
}

export async function resolveContactByPhone(
  db: SupabaseClient,
  tenantId: string,
  externalWaId: string,
): Promise<ResolvedContact> {
  const unknown: ResolvedContact = {
    type: "unknown",
    customerId: null,
    operatorId: null,
    personId: null,
    organizationId: null,
    displayName: null,
  };
  const suffix = lastDigits(externalWaId);
  if (!suffix) return unknown;

  // 1. rental customer (external end-customer), scoped to this tenant via
  //    rental_customer_organizations.
  const { data: customerLinks } = await db
    .from("rental_customer_organizations")
    .select("rental_customer_id, rental_customers(id, full_name, phone)")
    .eq("tenant_id", tenantId);
  for (const link of customerLinks ?? []) {
    const embedded = (
      link as {
        rental_customers?:
          | { id: string; full_name: string | null; phone: string | null }
          | Array<{ id: string; full_name: string | null; phone: string | null }>;
      }
    ).rental_customers;
    const customer = Array.isArray(embedded) ? embedded[0] : embedded;
    if (customer && matches(customer.phone, externalWaId)) {
      return {
        type: "customer",
        customerId: customer.id,
        operatorId: null,
        personId: null,
        organizationId: null,
        displayName: customer.full_name,
      };
    }
  }

  // 2. operator (tenant's own driver/field staff).
  const { data: operators } = await db
    .from("operators")
    .select("id, full_name, phone")
    .eq("tenant_id", tenantId)
    .ilike("phone", `%${suffix}`);
  const operator = (operators ?? []).find((o) => matches(o.phone, externalWaId));
  if (operator) {
    return {
      type: "operator",
      customerId: null,
      operatorId: operator.id,
      personId: null,
      organizationId: null,
      displayName: operator.full_name,
    };
  }

  // 3. person (tenant contact/staff record).
  const { data: persons } = await db
    .from("persons")
    .select("id, first_name, last_name, phone")
    .eq("tenant_id", tenantId)
    .ilike("phone", `%${suffix}`);
  const person = (persons ?? []).find((p) => matches(p.phone, externalWaId));
  if (person) {
    return {
      type: "lead",
      customerId: null,
      operatorId: null,
      personId: person.id,
      organizationId: null,
      displayName: [person.first_name, person.last_name].filter(Boolean).join(" ") || null,
    };
  }

  // 4. organization (company-level contact, e.g. a supplier/partner WhatsApp).
  const { data: organizations } = await db
    .from("organizations")
    .select("id, name, phone")
    .eq("tenant_id", tenantId)
    .ilike("phone", `%${suffix}`);
  const organization = (organizations ?? []).find((o) => matches(o.phone, externalWaId));
  if (organization) {
    return {
      type: "lead",
      customerId: null,
      operatorId: null,
      personId: null,
      organizationId: organization.id,
      displayName: organization.name,
    };
  }

  return unknown;
}

export function resolvedContactParticipantType(type: ResolvedContactType): ParticipantType {
  switch (type) {
    case "customer":
      return "customer";
    case "operator":
      return "operator";
    default:
      return "unknown_contact";
  }
}
