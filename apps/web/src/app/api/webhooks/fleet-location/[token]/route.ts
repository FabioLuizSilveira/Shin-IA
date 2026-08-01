import { NextResponse, type NextRequest } from "next/server";
import { GeofenceEngine } from "@shina/tracking-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGeofenceRepository, createTrackingEventRepository } from "@/lib/geofence-repository";

export const dynamic = "force-dynamic";

// Called server-to-server by the tenant's own GPS/telemetry provider — no
// Supabase session ever exists here, the webhook token in the URL is the
// only credential. Path lives under /api/webhooks so middleware's existing
// APP_PUBLIC_PATHS exemption (added for the Stripe webhook) already skips
// auth for it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: integration, error: integrationError } = await admin
    .from("fleet_integrations")
    .select("id, tenant_id, is_active")
    .eq("webhook_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (integrationError) {
    return NextResponse.json({ error: integrationError.message }, { status: 500 });
  }
  if (!integration) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!integration.is_active) {
    return NextResponse.json({ error: "Integration is inactive" }, { status: 403 });
  }

  let body: {
    resource_id?: string;
    latitude?: number;
    longitude?: number;
    recorded_at?: string;
  };
  try {
    body = (await req.json()) as typeof body;
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
    .select("id")
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
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

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

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
