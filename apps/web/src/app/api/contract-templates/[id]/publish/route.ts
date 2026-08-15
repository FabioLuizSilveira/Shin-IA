import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// Publishes a new immutable version of a template, snapshotting its current
// clause configuration (mandatory + conditional) — the prior published
// version is superseded but never mutated (item 6: "não permitir alteração
// retroativa de contrato já aceito"), matching the same discipline as
// commercial_flow.sql's plan_versions/contract_versions.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.contract_templates.publish"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: template } = await scope.db
    .from("tenant_contract_templates")
    .select("id, tenant_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (template.tenant_id !== null && template.tenant_id !== scope.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: clauses, error: clausesError } = await scope.db
    .from("tenant_contract_template_clauses")
    .select("is_mandatory, condition, sort_order, tenant_contract_clauses(key, category)")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (clausesError) return internalError(clausesError);

  const resolvedClauses = (
    (clauses ?? []) as unknown as {
      is_mandatory: boolean;
      condition: unknown;
      tenant_contract_clauses: { key: string; category: string } | null;
    }[]
  ).map((c) => ({
    clause_key: c.tenant_contract_clauses?.key,
    category: c.tenant_contract_clauses?.category,
    is_mandatory: c.is_mandatory,
    condition: c.condition,
  }));

  const { data: lastVersion } = await scope.db
    .from("tenant_contract_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  await scope.db
    .from("tenant_contract_versions")
    .update({ status: "superseded" })
    .eq("template_id", templateId)
    .eq("status", "published");

  const { data: created, error: insertError } = await scope.db
    .from("tenant_contract_versions")
    .insert({
      template_id: templateId,
      version: nextVersion,
      resolved_clauses: resolvedClauses,
      effective_at: new Date().toISOString(),
      status: "published",
    })
    .select("id, version")
    .single();
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "contract_template",
    entityId: templateId,
    action: "contract_template.published",
    metadata: { version: nextVersion },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
