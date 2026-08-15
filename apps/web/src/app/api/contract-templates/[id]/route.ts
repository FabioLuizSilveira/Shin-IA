import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface ClauseRow {
  is_mandatory: boolean;
  condition: unknown;
  sort_order: number;
  tenant_contract_clauses: { key: string; category: string; title: string } | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.contract_templates.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: template, error: templateError } = await scope.db
    .from("tenant_contract_templates")
    .select("id, tenant_id, key, party_type, name, status")
    .eq("id", id)
    .maybeSingle();
  if (templateError) return internalError(templateError);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: clauses, error: clausesError } = await scope.db
    .from("tenant_contract_template_clauses")
    .select("is_mandatory, condition, sort_order, tenant_contract_clauses(key, category, title)")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });
  if (clausesError) return internalError(clausesError);

  const { data: versions, error: versionsError } = await scope.db
    .from("tenant_contract_versions")
    .select("id, version, status, effective_at, content_hash")
    .eq("template_id", id)
    .order("version", { ascending: false });
  if (versionsError) return internalError(versionsError);

  return NextResponse.json({
    data: {
      template,
      clauses: (clauses ?? []) as unknown as ClauseRow[],
      versions: versions ?? [],
    },
  });
}
