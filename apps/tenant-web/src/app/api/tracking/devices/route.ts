import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/tracking/devices — list all devices for tenant
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracking_devices")
    .select(
      "id, external_id, imei, serial, type, status, last_seen_at, resource_id, provider, metadata",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/tracking/devices — provision a new device
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  let body: {
    externalId?: string;
    imei?: string;
    serial?: string;
    type?: string;
    provider?: string;
    resourceId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.externalId) {
    return NextResponse.json({ error: "externalId is required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracking_devices")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      external_id: body.externalId,
      imei: body.imei ?? null,
      serial: body.serial ?? null,
      type: body.type ?? "vehicle",
      provider: body.provider ?? "custom",
      status: "offline",
      resource_id: body.resourceId ?? null,
    })
    .select("id, external_id, type, status, provider")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
