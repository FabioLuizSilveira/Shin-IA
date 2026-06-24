import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled", "failed"],
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operations")
    .select(
      `id, type, status, scheduled_starts_at, scheduled_ends_at,
       started_at, completed_at, created_at, metadata,
       resources ( id, name, type, status )`,
    )
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { status: string };
  const newStatus = body.status;

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  // Fetch current operation
  const { data: op } = await admin
    .from("operations")
    .select("id, status, type")
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .single();

  if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Validate transition
  const allowed = ALLOWED_TRANSITIONS[op.status as string] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from '${op.status as string}' to '${newStatus}'` },
      { status: 422 },
    );
  }

  // Build update payload
  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "in_progress") update.started_at = new Date().toISOString();
  if (newStatus === "completed" || newStatus === "failed" || newStatus === "cancelled") {
    update.completed_at = new Date().toISOString();
  }

  const { data: updated, error } = await admin
    .from("operations")
    .update(update)
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notification
  const statusLabels: Record<string, string> = {
    in_progress: "iniciada",
    completed: "concluída",
    cancelled: "cancelada",
    failed: "falhou",
  };
  const priorities: Record<string, "low" | "normal" | "high" | "critical"> = {
    completed: "normal",
    cancelled: "high",
    failed: "critical",
    in_progress: "low",
  };
  await createNotification({
    tenantId,
    subject: `Operação ${statusLabels[newStatus] ?? newStatus}`,
    body: `Operação de ${op.type as string} foi ${statusLabels[newStatus] ?? newStatus}.`,
    priority: priorities[newStatus] ?? "normal",
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("operations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
