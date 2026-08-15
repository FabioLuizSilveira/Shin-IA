import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { auditMobileAction } from "@/lib/mobile-audit";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS = new Set(["ios", "android"]);

// Wave 3 Phase D — push registration foundation only, no push provider
// (Expo/FCM/APNs) wired up yet. Any authenticated mobile identity can
// register a device (not just customer/operator) — a tenant_user staff
// member using the mobile app needs push too. user_id is ALWAYS
// context.userId (resolved server-side from the session) — never accepted
// from the body, closing the "forged user_id on device registration"
// security test explicitly called out in the wave's spec.
export async function POST(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    deviceId?: string;
    pushToken?: string;
    platform?: string;
    appVersion?: string;
  };
  if (!body.deviceId || !body.platform || !VALID_PLATFORMS.has(body.platform)) {
    return NextResponse.json(
      { error: "deviceId and a valid platform (ios|android) are required" },
      { status: 422 },
    );
  }

  // Unique index is on device_id alone, not (user_id, device_id) — a device
  // re-registering under a different account (e.g. logout then a different
  // person logs into the same physical device) reassigns ownership on
  // conflict, matching how most push systems behave ("last login owns the
  // token"). This can never leak the previous owner's data: RLS scopes
  // every read/write to the CURRENT row's user_id, so the old owner simply
  // stops receiving push until they log in and re-register.
  const { data, error } = await context.db
    .from("mobile_devices")
    .upsert(
      {
        user_id: context.userId,
        device_id: body.deviceId,
        push_token: body.pushToken ?? null,
        platform: body.platform,
        app_version: body.appVersion ?? null,
        last_seen_at: new Date().toISOString(),
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    )
    .select("id, device_id, platform, enabled")
    .single();
  if (error) return internalError(error);

  void auditMobileAction(context.db, context, {
    action: "mobile_device.registered",
    resource: "mobile_device",
    resourceId: data.id,
    result: "allowed",
  });

  return NextResponse.json({ data }, { status: 201 });
}
