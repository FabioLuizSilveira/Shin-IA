import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation-cookie";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (sessionId) {
    const admin = createAdminClient();
    const { data: ended } = await admin
      .from("impersonation_sessions")
      .update({ status: "revoked", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("platform_actor_id", session.user.id)
      .select("tenant_id")
      .maybeSingle();
    if (ended) {
      void logActivity(admin, {
        tenantId: ended.tenant_id,
        actorId: session.user.id,
        entityType: "impersonation_session",
        entityId: sessionId,
        action: "ended",
      });
    }
  }
  cookieStore.delete(IMPERSONATION_COOKIE);

  return NextResponse.json({ data: { ok: true } });
}
