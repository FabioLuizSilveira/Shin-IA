import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("geofences")
    .select("*")
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

interface CreateBody {
  name?: string;
  description?: string;
  shape?: "circle" | "polygon";
  center_lat?: number;
  center_lng?: number;
  radius_meters?: number;
  polygon_coordinates?: Array<{ lat: number; lng: number }>;
  resource_ids?: string[];
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as CreateBody;
  if (!body.name?.trim() || (body.shape !== "circle" && body.shape !== "polygon")) {
    return NextResponse.json(
      { error: "name and shape (circle|polygon) are required" },
      { status: 422 },
    );
  }
  if (
    body.shape === "circle" &&
    (typeof body.center_lat !== "number" ||
      typeof body.center_lng !== "number" ||
      typeof body.radius_meters !== "number")
  ) {
    return NextResponse.json(
      { error: "circle geofences require center_lat, center_lng and radius_meters" },
      { status: 422 },
    );
  }
  if (
    body.shape === "polygon" &&
    (!body.polygon_coordinates || body.polygon_coordinates.length < 3)
  ) {
    return NextResponse.json(
      { error: "polygon geofences require at least 3 polygon_coordinates" },
      { status: 422 },
    );
  }

  const { data, error } = await scope.db
    .from("geofences")
    .insert({
      tenant_id: scope.tenantId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      shape: body.shape,
      center_lat: body.center_lat ?? null,
      center_lng: body.center_lng ?? null,
      radius_meters: body.radius_meters ?? null,
      polygon_coordinates: body.polygon_coordinates ?? null,
      resource_ids: body.resource_ids ?? [],
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
