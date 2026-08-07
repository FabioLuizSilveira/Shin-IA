import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { requireTenantScope } from "@/lib/tenant-context";
import type { Invoice } from "@/types/domain";

export const dynamic = "force-dynamic";

const SELECT =
  "id, billing_account_id, status, total_amount, total_currency, due_date, paid_at, created_at, billing_accounts(id, cycle, organizations(id, name))";

export async function GET(req: NextRequest) {
  const scopeParam = new URL(req.url).searchParams.get("scope");

  if (scopeParam === "platform") {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeSessionClaims(session.access_token) : {};
    if (!claims.platform_role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("invoices")
      .select(SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return internalError(error);
    return NextResponse.json({ data: data as unknown as Invoice[] });
  }

  const tenantScope = await requireTenantScope();
  if ("error" in tenantScope) {
    return NextResponse.json({ error: tenantScope.error }, { status: tenantScope.status });
  }

  const { data, error } = await tenantScope.db
    .from("invoices")
    .select(SELECT)
    .eq("tenant_id", tenantScope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data as unknown as Invoice[] });
}
