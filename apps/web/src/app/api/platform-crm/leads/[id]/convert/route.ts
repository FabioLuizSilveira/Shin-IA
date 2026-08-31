import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";
import { provisionTenant } from "@/lib/tenant-provisioning";
import { appUrl } from "@/lib/domain";
import { internalError } from "@/lib/api-error";
import type { TenantPlan } from "@/types/domain";

export const dynamic = "force-dynamic";

interface ConvertLeadBody {
  slug?: string;
  plan?: TenantPlan;
  adminEmail?: string;
  adminFullName?: string;
}

// POST /api/platform-crm/leads/:id/convert — o desfecho real de "captação
// de leads": transforma um lead ganho num tenant de verdade, reaproveitando
// provisionTenant() (o mesmo caminho que POST /api/tenants e o wizard
// público de onboarding já usam) em vez de duplicar a lógica de
// tenant/branch/role/convite. Só permitido a partir de "won" -- converter
// antes disso pularia o próprio funil que este módulo existe pra impor.
// Idempotente por construção: crm_leads_converted_tenant_id_idx é um
// índice único, então um lead já convertido nunca gera um segundo tenant
// por engano (a segunda tentativa falha no update abaixo).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("crm_leads")
    .select("id, status, company_name, contact_name, contact_email, converted_tenant_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (leadError) return internalError(leadError);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.converted_tenant_id) {
    return NextResponse.json(
      { error: "Lead already converted", tenantId: lead.converted_tenant_id },
      { status: 409 },
    );
  }
  if (lead.status !== "won") {
    return NextResponse.json(
      { error: `only a 'won' lead can be converted (current status: ${lead.status})` },
      { status: 422 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConvertLeadBody;
  const adminEmail = body.adminEmail ?? lead.contact_email;
  const adminFullName = body.adminFullName ?? lead.contact_name;
  if (!body.slug || !adminEmail) {
    return NextResponse.json(
      { error: "slug is required, and adminEmail is required when the lead has none on file" },
      { status: 400 },
    );
  }

  try {
    const result = await provisionTenant(admin, {
      name: lead.company_name,
      slug: body.slug,
      plan: body.plan ?? "starter",
      status: "active",
      branchName: `Sede ${lead.company_name}`,
      branchCode: "HQ-001",
      branchMetadata: { type: "headquarters", country: "BR" },
      adminEmail,
      adminFullName,
      inviteRedirectTo: appUrl("/dashboard"),
    });

    const { error: linkError } = await admin
      .from("crm_leads")
      .update({
        converted_tenant_id: result.tenantId,
        converted_at: new Date().toISOString(),
        converted_by: guard.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("converted_tenant_id", null); // race guard -- see file header
    if (linkError) return internalError(linkError);

    await admin.from("crm_lead_activities").insert({
      id: crypto.randomUUID(),
      lead_id: id,
      type: "note",
      description: `Convertido em tenant "${lead.company_name}" (slug: ${body.slug}).`,
      created_by: guard.userId,
    });

    return NextResponse.json({ data: { tenantId: result.tenantId, slug: result.slug } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to convert lead";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
