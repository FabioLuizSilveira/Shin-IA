import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { auditMobileAction } from "@/lib/mobile-audit";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Wave 3 Phase D — logout support: disables (never hard-deletes) a device's
// push registration. Ownership enforced in the query itself (user_id must
// match the caller) — a device belonging to another user responds 404, same
// IDOR hygiene as every other mobile detail route this wave.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await context.db
    .from("mobile_devices")
    .update({ enabled: false, push_token: null, updated_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  void auditMobileAction(context.db, context, {
    action: "mobile_device.disabled",
    resource: "mobile_device",
    resourceId: data.id,
    result: "allowed",
  });

  return NextResponse.json({ data: { ok: true } });
}
