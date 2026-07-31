import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { error: insertError } = await admin.from("resource_locations").insert({
    tenant_id: integration.tenant_id,
    resource_id: body.resource_id,
    latitude: body.latitude,
    longitude: body.longitude,
    recorded_at: body.recorded_at ?? new Date().toISOString(),
    source: "webhook",
    raw_payload: body,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await admin
    .from("fleet_integrations")
    .update({ last_received_at: new Date().toISOString() })
    .eq("id", integration.id);

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
