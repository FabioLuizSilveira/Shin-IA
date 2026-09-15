import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTripTrackingShare } from "@/lib/transport/trip-tracking-share";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

// GET /api/share/trip-tracking/:token — the ONLY unauthenticated route that
// can return trip status (spec section 27). Mirrors api/share/
// inspection-report/[token]/route.ts's shape: token compared by hash,
// expired/revoked rejected as a generic 404 (never distinguishes "unknown"
// from "expired"/"revoked" — same anti-leak discipline).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  try {
    const resolved = await resolveTripTrackingShare(admin, token);
    if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Same nil-UUID sentinel as report_share_accessed — there's no
    // authenticated user for a public link click.
    void logActivity(admin, {
      tenantId: resolved.tenantId,
      actorId: "00000000-0000-0000-0000-000000000000",
      entityType: "operation",
      entityId: resolved.trip.operationId,
      action: MESSAGING_AUDIT_EVENTS.TRIP_TRACKING_LINK_ACCESSED,
      metadata: { status: resolved.trip.status },
    });

    return NextResponse.json({ data: resolved.trip });
  } catch (err) {
    return internalError(err);
  }
}
