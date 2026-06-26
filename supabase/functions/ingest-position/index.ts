// Edge Function: ingest-position
// Receives GPS position from tracking devices via HTTP POST
// Validates HMAC signature, normalises payload, stores in tracking_positions,
// and broadcasts to Supabase Realtime for the live map.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──────────────────────────────────────────────────────────────────────

interface IngestPayload {
  deviceId?: string;
  externalDeviceId?: string;
  provider?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  fixedAt?: string;
  telemetry?: Array<{
    key: string;
    value: number | boolean | string;
    unit?: string;
  }>;
}

interface TrackingDeviceRow {
  id: string;
  tenant_id: string;
  status: string;
  resource_id: string | null;
}

// ── HMAC validation ───────────────────────────────────────────────────────────

async function validateHmac(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature.toLowerCase();
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Signature",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rawBody = await req.text();
  let payload: IngestPayload;

  try {
    payload = JSON.parse(rawBody) as IngestPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (!payload.latitude || !payload.longitude) {
    return Response.json({ error: "latitude and longitude are required" }, { status: 422 });
  }

  const externalId = payload.deviceId ?? payload.externalDeviceId;
  if (!externalId) {
    return Response.json({ error: "deviceId or externalDeviceId is required" }, { status: 422 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const hmacSecret = Deno.env.get("TRACKING_HMAC_SECRET") ?? "";

  const admin = createClient(supabaseUrl, serviceKey);

  // Optional HMAC validation (skip if no secret configured — dev mode)
  if (hmacSecret) {
    const sig = req.headers.get("x-signature");
    const valid = await validateHmac(rawBody, sig, hmacSecret);
    if (!valid) {
      console.warn("[ingest-position] invalid HMAC signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Resolve device
  const { data: device, error: deviceError } = await admin
    .from("tracking_devices")
    .select("id, tenant_id, status, resource_id")
    .eq("external_id", externalId)
    .eq("status", "online")
    .maybeSingle();

  if (deviceError) {
    console.error("[ingest-position] db error:", deviceError.message);
    return Response.json({ error: "DB error" }, { status: 500 });
  }

  // Auto-provision unknown devices in dev mode (no hmacSecret)
  let resolvedDevice: TrackingDeviceRow | null = device as TrackingDeviceRow | null;

  if (!resolvedDevice) {
    if (!hmacSecret) {
      // Dev mode: auto-create device
      const { data: newDevice } = await admin
        .from("tracking_devices")
        .insert({
          id: crypto.randomUUID(),
          external_id: externalId,
          tenant_id: Deno.env.get("DEV_TENANT_ID") ?? "00000000-0000-0000-0000-000000000000",
          provider: payload.provider ?? "custom",
          status: "online",
          type: "vehicle",
        })
        .select("id, tenant_id, status, resource_id")
        .single();
      resolvedDevice = newDevice as TrackingDeviceRow | null;
    } else {
      console.warn("[ingest-position] unknown device:", externalId);
      return Response.json({ error: "Device not registered" }, { status: 404 });
    }
  }

  if (!resolvedDevice) {
    return Response.json({ error: "Failed to resolve device" }, { status: 500 });
  }

  const receivedAt = new Date().toISOString();
  const positionId = crypto.randomUUID();

  // Insert position
  const { error: posError } = await admin.from("tracking_positions").insert({
    id: positionId,
    device_id: resolvedDevice.id,
    tenant_id: resolvedDevice.tenant_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    altitude: payload.altitude ?? null,
    speed: payload.speed ?? null,
    heading: payload.heading ?? null,
    accuracy: payload.accuracy ?? null,
    fixed_at: payload.fixedAt ?? receivedAt,
    received_at: receivedAt,
    raw_payload: payload,
  });

  if (posError) {
    console.error("[ingest-position] position insert error:", posError.message);
    return Response.json({ error: posError.message }, { status: 500 });
  }

  // Insert telemetry readings
  if (payload.telemetry?.length) {
    const readings = payload.telemetry.map((t) => ({
      id: crypto.randomUUID(),
      device_id: resolvedDevice!.id,
      tenant_id: resolvedDevice!.tenant_id,
      position_id: positionId,
      key: t.key,
      value: String(t.value),
      unit: t.unit ?? null,
      measured_at: receivedAt,
      received_at: receivedAt,
    }));
    await admin.from("telemetry_readings").insert(readings);
  }

  // Update device last_seen_at
  await admin
    .from("tracking_devices")
    .update({ last_seen_at: receivedAt, status: "online" })
    .eq("id", resolvedDevice.id);

  // Broadcast to Realtime channel (live map)
  const broadcastPayload = {
    deviceId: resolvedDevice.id,
    resourceId: resolvedDevice.resource_id,
    tenantId: resolvedDevice.tenant_id,
    lat: payload.latitude,
    lng: payload.longitude,
    speed: payload.speed ?? 0,
    heading: payload.heading ?? 0,
    receivedAt,
  };

  try {
    const channel = admin.channel(`tracking:${resolvedDevice.tenant_id}`);
    await channel.send({
      type: "broadcast",
      event: "position",
      payload: broadcastPayload,
    });
  } catch (broadcastErr) {
    // Non-fatal — position was saved
    console.warn("[ingest-position] broadcast failed:", broadcastErr);
  }

  console.log(
    `[ingest-position] ok device=${resolvedDevice.id} lat=${payload.latitude} lng=${payload.longitude}`,
  );

  return Response.json({ success: true, positionId }, { status: 200 });
});
