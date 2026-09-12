import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentPurpose, ConsentStatus } from "./types.js";

// WAVE 2 — Consent / LGPD (spec section 14). Purposes are NEVER merged:
// granting operational consent never implies marketing consent, and vice
// versa — evaluateSendPolicy() (policy-engine.ts) already enforces this at
// send time; these are just the write paths + a read helper for the Inbox
// UI. Every write is itself an audit event (grantConsent/revokeConsent
// return the created row id so the caller can logActivity() it).

export interface ConsentRecord {
  id: string;
  tenantId: string;
  personId: string | null;
  channel: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source: string;
  evidence: Record<string, unknown> | null;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface ConsentRow {
  id: string;
  tenant_id: string;
  person_id: string | null;
  channel: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source: string;
  evidence: Record<string, unknown> | null;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function rowToConsent(r: ConsentRow): ConsentRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    personId: r.person_id,
    channel: r.channel,
    purpose: r.purpose,
    status: r.status,
    source: r.source,
    evidence: r.evidence,
    grantedAt: r.granted_at,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
  };
}

export async function grantConsent(
  db: SupabaseClient,
  input: {
    tenantId: string;
    personId: string;
    purpose: ConsentPurpose;
    source: string;
    evidence?: Record<string, unknown>;
  },
): Promise<ConsentRecord> {
  const { data, error } = await db
    .from("communication_consents")
    .insert({
      tenant_id: input.tenantId,
      person_id: input.personId,
      channel: "whatsapp",
      purpose: input.purpose,
      status: "granted",
      source: input.source,
      evidence: input.evidence ?? null,
      granted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to grant consent");
  return rowToConsent(data as ConsentRow);
}

export async function revokeConsent(
  db: SupabaseClient,
  input: { tenantId: string; personId: string; purpose: ConsentPurpose; source: string },
): Promise<ConsentRecord> {
  const { data, error } = await db
    .from("communication_consents")
    .insert({
      tenant_id: input.tenantId,
      person_id: input.personId,
      channel: "whatsapp",
      purpose: input.purpose,
      status: "revoked",
      source: input.source,
      revoked_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to revoke consent");
  return rowToConsent(data as ConsentRow);
}

/** The most recent consent decision per purpose, tenant+person-scoped. */
export async function getConsentHistory(
  db: SupabaseClient,
  tenantId: string,
  personId: string,
): Promise<ConsentRecord[]> {
  const { data, error } = await db
    .from("communication_consents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ConsentRow[] | null)?.map(rowToConsent) ?? [];
}
