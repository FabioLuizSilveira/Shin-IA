import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope, type TenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

function appUrl(): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  return process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${root}`;
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

const SELECT =
  "id, provider_name, webhook_token, webhook_secret, is_active, last_received_at, created_at";

// Lazily creates the tenant's fleet integration row on first access —
// every tenant gets exactly one (unique index on tenant_id), so there's no
// separate "create" step for the UI to call before showing the webhook URL.
async function getOrCreate(db: TenantScope["db"], tenantId: string) {
  const { data: existing, error } = await db
    .from("fleet_integrations")
    .select(SELECT)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await db
    .from("fleet_integrations")
    .insert({ tenant_id: tenantId, webhook_token: generateToken() })
    .select(SELECT)
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  try {
    const integration = await getOrCreate(scope.db, scope.tenantId);
    return NextResponse.json({
      data: {
        ...integration,
        webhookUrl: `${appUrl()}/api/webhooks/fleet-location/${integration.webhook_token}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    provider_name?: string;
    is_active?: boolean;
    regenerate_token?: boolean;
    regenerate_secret?: boolean;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.provider_name !== undefined) update.provider_name = body.provider_name.trim() || null;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.regenerate_token) update.webhook_token = generateToken();
  if (body.regenerate_secret) update.webhook_secret = generateToken();

  try {
    await getOrCreate(scope.db, scope.tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await scope.db
    .from("fleet_integrations")
    .update(update)
    .eq("tenant_id", scope.tenantId)
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: { ...data, webhookUrl: `${appUrl()}/api/webhooks/fleet-location/${data.webhook_token}` },
  });
}
