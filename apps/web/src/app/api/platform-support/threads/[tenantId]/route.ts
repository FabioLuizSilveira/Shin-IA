import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requirePlatformRole } from "@/lib/platform-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

const SELECT = "id, sender_role, body, created_at, read_by_tenant_at, read_by_platform_at";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { tenantId } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_messages")
    .select(SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { tenantId } = await params;

  const body = (await req.json()) as { body?: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("support_messages")
    .insert({
      tenant_id: tenantId,
      sender_role: "platform",
      sender_user_id: guard.userId,
      body: body.body.trim(),
      read_by_platform_at: now,
      read_by_tenant_at: null,
    })
    .select(SELECT)
    .single();
  if (error) return internalError(error);

  await createNotification({
    tenantId,
    subject: "Nova mensagem da Shinã",
    body: body.body.trim(),
    priority: "normal",
  });

  return NextResponse.json({ data }, { status: 201 });
}

// Marks every tenant->platform message in this thread as read — called
// when platform staff open the thread.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { tenantId } = await params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_messages")
    .update({ read_by_platform_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("sender_role", "tenant")
    .is("read_by_platform_at", null);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
