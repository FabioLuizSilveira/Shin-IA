import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { GeofenceEngine } from "@shina/tracking-engine";
import { computeOdometerDelta } from "@shina/maintenance-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGeofenceRepository, createTrackingEventRepository } from "@/lib/geofence-repository";

export const dynamic = "force-dynamic";

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Called server-to-server by the tenant's own GPS/telemetry provider — no
// Supabase session ever exists here, the webhook token in the URL is the
// only credential. Path lives under /api/webhooks so middleware's existing
// APP_PUBLIC_PATHS exemption (added for the Asaas webhook) already skips
// auth for it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: integration, error: integrationError } = await admin
    .from("fleet_integrations")
    .select("id, tenant_id, is_active, webhook_secret")
    .eq("webhook_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (integrationError) {
    return internalError(integrationError);
  }
  if (!integration) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!integration.is_active) {
    return NextResponse.json({ error: "Integration is inactive" }, { status: 403 });
  }

  // Security fix (MÉD-16): the URL token alone doesn't cover the request
  // body with a signature — a leaked token (proxy logs, Referer) lets an
  // attacker inject arbitrary coordinates indefinitely. When the sender
  // includes X-Signature (HMAC-SHA256 of the raw body, hex, using the
  // integration's webhook_secret), it's verified and mismatches are
  // rejected. Kept optional per-request rather than mandatory: this is a
  // bring-your-own-webhook integration and making it mandatory today would
  // break every already-configured external GPS provider that doesn't
  // sign yet — see tenant-settings/fleet-integration for where the secret
  // is exposed so a tenant can opt their provider into signing.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-signature");
  if (signatureHeader) {
    const expected = await hmacSha256Hex(integration.webhook_secret, rawBody);
    if (!timingSafeEqual(expected, signatureHeader)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: {
    resource_id?: string;
    latitude?: number;
    longitude?: number;
    recorded_at?: string;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.resource_id ||
    typeof body.latitude !== "number" ||
    typeof body.longitude !== "number"
  ) {
    return NextResponse.json(
      { error: "resource_id, latitude and longitude are required" },
      { status: 422 },
    );
  }
  if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
    return NextResponse.json({ error: "latitude/longitude out of range" }, { status: 422 });
  }

  const { data: resource } = await admin
    .from("resources")
    .select("id, asset_id")
    .eq("id", body.resource_id)
    .eq("tenant_id", integration.tenant_id)
    .maybeSingle();
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

  // Fetch the previous fix before inserting the new one — GeofenceEngine
  // needs both points to tell "entered" from "already inside".
  const { data: previous } = await admin
    .from("resource_locations")
    .select("latitude, longitude, recorded_at")
    .eq("tenant_id", integration.tenant_id)
    .eq("resource_id", body.resource_id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recordedAt = body.recorded_at ?? new Date().toISOString();
  const { error: insertError } = await admin.from("resource_locations").insert({
    tenant_id: integration.tenant_id,
    resource_id: body.resource_id,
    latitude: body.latitude,
    longitude: body.longitude,
    recorded_at: recordedAt,
    source: "webhook",
    raw_payload: body,
  });
  if (insertError) return internalError(insertError);

  await admin
    .from("fleet_integrations")
    .update({ last_received_at: new Date().toISOString() })
    .eq("id", integration.id);

  const toTrackingPosition = (lat: number, lng: number, at: string) => ({
    id: crypto.randomUUID(),
    deviceId: body.resource_id!,
    tenantId: integration.tenant_id,
    latitude: lat,
    longitude: lng,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    fixedAt: at,
    receivedAt: at,
    rawPayload: {},
  });

  const geofenceEngine = new GeofenceEngine(
    createGeofenceRepository(admin, integration.tenant_id),
    createTrackingEventRepository(admin, integration.tenant_id),
  );
  await geofenceEngine.checkPosition(
    body.resource_id,
    integration.tenant_id,
    toTrackingPosition(body.latitude, body.longitude, recordedAt),
    previous
      ? toTrackingPosition(previous.latitude, previous.longitude, previous.recorded_at)
      : null,
  );

  // Etapa 10 (Tracking -> Manutenção): opt-in odometer sync -- only for
  // resources a tenant has explicitly linked to a fleet asset (resources
  // and assets are separate entities with no other bridge, see the
  // migration's comment). computeOdometerDelta() rejects GPS noise and
  // implausible jumps on its own; this route only ever adds an accepted
  // delta, never a raw/unfiltered one.
  if (resource.asset_id && previous) {
    const delta = computeOdometerDelta(
      { latitude: previous.latitude, longitude: previous.longitude, fixedAt: previous.recorded_at },
      { latitude: body.latitude, longitude: body.longitude, fixedAt: recordedAt },
    );
    if (delta.accepted) {
      const { data: asset } = await admin
        .from("assets")
        .select("odometer")
        .eq("id", resource.asset_id)
        .eq("tenant_id", integration.tenant_id)
        .maybeSingle();
      if (asset) {
        const nextOdometer = (asset.odometer ?? 0) + delta.distanceKm;
        await admin
          .from("assets")
          .update({ odometer: nextOdometer, updated_at: new Date().toISOString() })
          .eq("id", resource.asset_id)
          .eq("tenant_id", integration.tenant_id);
      }
    }
  }

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
