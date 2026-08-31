import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";
import type { ActivityType } from "@shina/crm-engine";

export const dynamic = "force-dynamic";

interface CreateActivityBody {
  type?: ActivityType;
  description?: string;
}

// POST /api/platform-crm/leads/:id/activities — registra uma nota,
// ligação, e-mail ou reunião (o "evolução" do pedido: cada contato com o
// lead vira uma linha permanente, nunca sobrescreve a anterior). Mudança
// de status tem seu próprio caminho (PATCH .../leads/:id), que já grava
// a atividade correspondente sozinho -- este endpoint nunca aceita
// type="status_change" diretamente, pra não haver dois jeitos de fazer a
// mesma coisa com histórico inconsistente entre eles.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("crm_leads")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (leadError) return internalError(leadError);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as CreateActivityBody | null;
  if (!body?.type || !body.description?.trim()) {
    return NextResponse.json({ error: "type and description are required" }, { status: 400 });
  }
  if (body.type === "status_change") {
    return NextResponse.json(
      { error: "status_change activities are created via PATCH /leads/:id, not here" },
      { status: 400 },
    );
  }

  const activityId = crypto.randomUUID();
  const { error } = await admin.from("crm_lead_activities").insert({
    id: activityId,
    lead_id: id,
    type: body.type,
    description: body.description.trim(),
    created_by: guard.userId,
  });
  if (error) return internalError(error);

  return NextResponse.json({ data: { id: activityId } }, { status: 201 });
}
