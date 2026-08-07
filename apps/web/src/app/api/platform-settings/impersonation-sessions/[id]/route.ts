import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

// Lets any platform admin revoke another admin's still-active impersonation
// session — e.g. someone forgot to end it. Distinct from the self-service
// /api/impersonation/end, which only ever ends the caller's own session
// (identified by their own cookie) and can't target an arbitrary id.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: session, error: fetchError } = await admin
    .from("impersonation_sessions")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 422 });
  }

  const { error } = await admin
    .from("impersonation_sessions")
    .update({ status: "revoked", ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
