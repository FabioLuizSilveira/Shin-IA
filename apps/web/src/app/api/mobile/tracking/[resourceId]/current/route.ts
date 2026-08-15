import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveTrackingVisibility } from "@/lib/mobile-tracking-scope";
import { auditMobileAction } from "@/lib/mobile-audit";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

interface LocationRow {
  resource_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  source: string;
  raw_payload: Record<string, unknown> | null;
  resources: { id: string; name: string; type: string; status: string } | null;
}

// Wave 3 Phase C — never returns provider credentials, device tokens, or
// internal provider account ids (fleet_integrations.webhook_secret/
// provider_name are never selected here). Only canonical fields the schema
// actually has; speed/ignition are surfaced ONLY when present in the
// webhook's raw_payload for that fix — not invented when a provider never
// sent them (no dedicated columns exist for either).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibility = await resolveTrackingVisibility(context);
  if (visibility?.kind === "ids" && !visibility.resourceIds.includes(resourceId)) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let query = context.db
    .from("resource_locations")
    .select(
      "resource_id, latitude, longitude, recorded_at, source, raw_payload, resources(id, name, type, status)",
    )
    .eq("resource_id", resourceId)
    .order("recorded_at", { ascending: false })
    .limit(1);
  if (visibility?.kind === "tenant") {
    query = query.eq("tenant_id", visibility.tenantId);
  }

  const { data: rawRow, error } = await query.maybeSingle();
  if (error) return internalError(error);
  if (!rawRow) {
    return NextResponse.json({ data: null });
  }
  const row = rawRow as unknown as LocationRow;

  const payload = row.raw_payload ?? {};
  const speed = typeof payload.speed === "number" ? payload.speed : undefined;
  const ignition = typeof payload.ignition === "boolean" ? payload.ignition : undefined;

  // No tenantIdOverride: tenant_user/operator already carry a tenantId
  // (auditMobileAction resolves it automatically); a customer context spans
  // potentially multiple tenants with no single "the" tenant to attribute
  // this view to, so it's skipped for customer — same documented limitation
  // as every other customer-context audit call this session.
  void auditMobileAction(context.db, context, {
    action: "tracking.viewed",
    resource: "resource_location",
    resourceId,
    result: "allowed",
  });

  return NextResponse.json({
    data: {
      resourceId: row.resource_id,
      resource: row.resources,
      latitude: row.latitude,
      longitude: row.longitude,
      recordedAt: row.recorded_at,
      lastCommunicationAt: row.recorded_at,
      source: row.source,
      ...(speed !== undefined ? { speed } : {}),
      ...(ignition !== undefined ? { ignition } : {}),
    },
  });
}
