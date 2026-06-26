import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { getTenantId } from "@/lib/auth/get-tenant-id";

export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "terminated"],
  active: ["suspended", "terminated", "expired"],
  suspended: ["active", "terminated"],
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const TENANT_ID = await getTenantId();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contracts")
    .select("*, organizations(id, name, type, document, email)")
    .eq("id", params.id)
    .eq("tenant_id", TENANT_ID)
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

  const TENANT_ID = await getTenantId();
  const body = (await req.json()) as { status?: string };
  const admin = createAdminClient();

  if (body.status) {
    const { data: current } = await admin
      .from("contracts")
      .select("status, type, value_amount")
      .eq("id", params.id)
      .eq("tenant_id", TENANT_ID)
      .single();

    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed = TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${current.status}' to '${body.status}'` },
        { status: 422 },
      );
    }

    const statusLabels: Record<string, string> = {
      active: "ativado",
      terminated: "encerrado",
      suspended: "suspenso",
      expired: "expirado",
    };
    const priorities: Record<string, "low" | "normal" | "high" | "critical"> = {
      active: "normal",
      terminated: "high",
      suspended: "high",
      expired: "normal",
    };

    await createNotification({
      tenantId: TENANT_ID,
      subject: `Contrato ${statusLabels[body.status] ?? body.status}`,
      body: `Contrato de ${current.type} no valor de R$ ${Number(current.value_amount).toLocaleString("pt-BR")} foi ${statusLabels[body.status] ?? body.status}.`,
      priority: priorities[body.status] ?? "normal",
    });
  }

  const { data, error } = await admin
    .from("contracts")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", TENANT_ID)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
