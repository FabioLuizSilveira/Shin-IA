import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "@shina/commercial-platform";

// WAVE 5 — Multi-Operation Business Architecture v2: secure customer trip
// tracking links (spec section 27). Mirrors api/inspections/[id]/report/
// shares/route.ts's mechanism exactly — the token is returned once, at
// creation; the DB only ever stores its SHA-256 hash, so a DB dump can
// never become trip-tracking access. tenant-scoped (operation_id FK +
// tenant_id) and resource-scoped (the read side only ever exposes THIS
// trip's status, never other tenant data).

const DEFAULT_TTL_HOURS = 48;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export interface TripTrackingShare {
  id: string;
  url: string;
  expiresAt: string;
}

export async function createTripTrackingShare(
  db: SupabaseClient,
  input: {
    tenantId: string;
    operationId: string;
    createdBy: string;
    ttlHours?: number;
    appUrl: (path: string) => string;
  },
): Promise<TripTrackingShare> {
  const ttlHours = input.ttlHours && input.ttlHours > 0 ? input.ttlHours : DEFAULT_TTL_HOURS;
  const token = generateToken();
  const tokenHash = await hashContent(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("trip_tracking_shares")
    .insert({
      tenant_id: input.tenantId,
      operation_id: input.operationId,
      token_hash: tokenHash,
      created_by: input.createdBy,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("failed to create trip tracking share");

  return { id: data.id as string, url: input.appUrl(`/share/trip-tracking/${token}`), expiresAt };
}

export async function revokeTripTrackingShare(
  db: SupabaseClient,
  tenantId: string,
  shareId: string,
): Promise<void> {
  const { error } = await db
    .from("trip_tracking_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("tenant_id", tenantId)
    .is("revoked_at", null);
  if (error) throw error;
}

export interface TripStatusForCustomer {
  operationId: string;
  status: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  vehicleName: string | null;
}

/**
 * The PUBLIC (unauthenticated) read path. Deliberately returns only the
 * minimal fields a customer needs (spec: "sem expor outros dados") — never
 * the tenant's other trips, the driver's identity, or any customer PII
 * beyond what the trip itself carries. An expired or revoked token is
 * rejected with the same "not found" a nonexistent token gets, so this
 * never leaks which case applies (same discipline as the inspection-report
 * share reader).
 */
/** Internal-only wrapper — `tenantId` is for the caller's own audit logging, never part of the public-facing payload (see the /api/share/trip-tracking/[token] route, which destructures this and returns only `trip`). */
export interface ResolvedTripTrackingShare {
  tenantId: string;
  trip: TripStatusForCustomer;
}

export async function resolveTripTrackingShare(
  db: SupabaseClient,
  token: string,
): Promise<ResolvedTripTrackingShare | null> {
  const tokenHash = await hashContent(token);
  const { data: share, error } = await db
    .from("trip_tracking_shares")
    .select("id, tenant_id, operation_id, expires_at, revoked_at, access_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!share) return null;
  if (share.revoked_at || new Date(share.expires_at as string) < new Date()) return null;

  const { data: op, error: opError } = await db
    .from("operations")
    .select("id, status, scheduled_starts_at, scheduled_ends_at, asset_id, assets(name)")
    .eq("id", share.operation_id)
    .eq("tenant_id", share.tenant_id)
    .maybeSingle();
  if (opError) throw opError;
  if (!op) return null;

  void db
    .from("trip_tracking_shares")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (share.access_count as number) + 1,
    })
    .eq("id", share.id as string);

  return {
    tenantId: share.tenant_id as string,
    trip: {
      operationId: op.id as string,
      status: op.status as string,
      scheduledStartsAt: op.scheduled_starts_at as string,
      scheduledEndsAt: op.scheduled_ends_at as string,
      vehicleName:
        ((op as unknown as { assets: { name: string } | null }).assets?.name as string) ?? null,
    },
  };
}
