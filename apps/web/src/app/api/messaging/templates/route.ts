import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { createTemplateDraft, listTemplates } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.template.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await listTemplates(scope.db, scope.tenantId) });
  } catch (err) {
    return internalError(err);
  }
}

interface CreateBody {
  name?: string;
  language?: string;
  category?: string;
  components?: unknown[];
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.template.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name || !body.language || !body.category) {
    return NextResponse.json(
      { error: "name, language e category são obrigatórios" },
      { status: 422 },
    );
  }

  try {
    const template = await createTemplateDraft(scope.db, {
      tenantId: scope.tenantId,
      name: body.name,
      language: body.language,
      category: body.category,
      components: body.components ?? [],
    });
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_template",
      entityId: template.id,
      action: MESSAGING_AUDIT_EVENTS.TEMPLATE_CREATED,
    });
    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
