import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";
import { canTransitionLead, type LeadStatus } from "@shina/crm-engine";

export const dynamic = "force-dynamic";

// GET /api/platform-crm/leads/:id — detalhe + histórico de atividades.
// Resolve o e-mail de assigned_to/created_by via admin.auth.admin.
// getUserById() -- staff Shinã não tem uma tabela de perfil própria
// (platform_user_roles usa auth.users.id direto), mesmo padrão já usado
// em platform-settings/impersonation-sessions.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("crm_leads")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return internalError(error);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data: activities } = await admin
    .from("crm_lead_activities")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const staffIds = [...new Set([lead.assigned_to, lead.created_by].filter(Boolean))] as string[];
  const staffEmails: Record<string, string> = {};
  await Promise.all(
    staffIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) staffEmails[userId] = data.user.email;
    }),
  );

  return NextResponse.json({
    data: { lead, activities: activities ?? [], staffEmails },
  });
}

interface PatchLeadBody {
  status?: LeadStatus;
  lostReason?: string;
  assignedTo?: string | null;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  segment?: string;
  estimatedFleetSize?: number;
  estimatedMrrCents?: number;
  note?: string; // when status changes, an optional note travels with it
}

// PATCH /api/platform-crm/leads/:id — edição de campos e/ou transição de
// status. Uma transição de status inválida é rejeitada explicitamente
// (422), nunca silenciosamente ignorada -- lição direta do bug real
// encontrado no Infractions Engine (uma rota que engolia uma transição
// inválida sem avisar ninguém).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: current, error: fetchError } = await admin
    .from("crm_leads")
    .select("id, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchLeadBody;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.companyName !== undefined) patch.company_name = body.companyName;
  if (body.contactName !== undefined) patch.contact_name = body.contactName;
  if (body.contactEmail !== undefined) patch.contact_email = body.contactEmail;
  if (body.contactPhone !== undefined) patch.contact_phone = body.contactPhone;
  if (body.segment !== undefined) patch.segment = body.segment;
  if (body.estimatedFleetSize !== undefined) patch.estimated_fleet_size = body.estimatedFleetSize;
  if (body.estimatedMrrCents !== undefined) patch.estimated_mrr_cents = body.estimatedMrrCents;
  if (body.assignedTo !== undefined) patch.assigned_to = body.assignedTo;

  if (body.status && body.status !== current.status) {
    if (!canTransitionLead(current.status as LeadStatus, body.status)) {
      return NextResponse.json(
        { error: `cannot transition from ${current.status} to ${body.status}` },
        { status: 422 },
      );
    }
    patch.status = body.status;
    if (body.status === "lost") patch.lost_reason = body.lostReason ?? null;
    else patch.lost_reason = null;
  }

  const { error: updateError } = await admin
    .from("crm_leads")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null);
  if (updateError) return internalError(updateError);

  if (body.status && body.status !== current.status) {
    await admin.from("crm_lead_activities").insert({
      id: crypto.randomUUID(),
      lead_id: id,
      type: "status_change",
      description: body.note?.trim() || `Status alterado para ${body.status}.`,
      from_status: current.status,
      to_status: body.status,
      created_by: guard.userId,
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
