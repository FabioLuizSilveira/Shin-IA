import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";
import type { LeadSource } from "@shina/crm-engine";

export const dynamic = "force-dynamic";

// GET /api/platform-crm/leads — lista de leads comerciais da sessão
// plataforma. Mesmo padrão de auth de /api/tenants: requirePlatformRole()
// só (nenhuma rota platform-side existente hoje checa permission key
// fina, platform_permissions/platform_role_permissions só alimentam a UI
// de configuração de papéis — este módulo não inventa um enforcement que
// mais nada usa).
export async function GET(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const status = req.nextUrl.searchParams.get("status");
  const assignedTo = req.nextUrl.searchParams.get("assignedTo");

  let query = admin
    .from("crm_leads")
    .select(
      "id, company_name, contact_name, contact_email, contact_phone, source, status, segment, " +
        "estimated_fleet_size, estimated_mrr_cents, assigned_to, converted_tenant_id, created_at, updated_at",
    )
    .is("deleted_at", null);
  if (status) query = query.eq("status", status);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateLeadBody {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  source?: LeadSource;
  segment?: string;
  estimatedFleetSize?: number;
  estimatedMrrCents?: number;
  assignedTo?: string;
}

// POST /api/platform-crm/leads — registro manual (item central do
// pedido: "controlar o processo de captação"). Sem importação/CSV/
// integração de formulário do site nesta rodada -- documentado como
// próximo passo natural, não construído por decisão de escopo.
export async function POST(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as CreateLeadBody | null;
  if (!body?.companyName || !body.contactName) {
    return NextResponse.json(
      { error: "companyName and contactName are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const leadId = crypto.randomUUID();
  const { error } = await admin.from("crm_leads").insert({
    id: leadId,
    company_name: body.companyName,
    contact_name: body.contactName,
    contact_email: body.contactEmail ?? null,
    contact_phone: body.contactPhone ?? null,
    source: body.source ?? "other",
    segment: body.segment ?? null,
    estimated_fleet_size: body.estimatedFleetSize ?? null,
    estimated_mrr_cents: body.estimatedMrrCents ?? null,
    assigned_to: body.assignedTo ?? null,
    status: "new",
    created_by: guard.userId,
  });
  if (error) return internalError(error);

  // O próprio registro do lead já conta como a primeira atividade do
  // funil -- facilita ver "quando esse lead entrou" no histórico sem
  // precisar de uma segunda leitura contra crm_leads.created_at.
  await admin.from("crm_lead_activities").insert({
    id: crypto.randomUUID(),
    lead_id: leadId,
    type: "status_change",
    description: "Lead criado.",
    from_status: null,
    to_status: "new",
    created_by: guard.userId,
  });

  return NextResponse.json({ data: { id: leadId } }, { status: 201 });
}
