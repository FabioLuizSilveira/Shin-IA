import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveAssetsVisibility } from "@/lib/mobile-assets-scope";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Blueprint-friendly by construction: filters and the select shape only ever
// touch generic columns (category, status, asset_type_id) — never a
// hardcoded asset type/blueprint branch. Same justification as
// api/mobile/operations: /api/assets is hard-gated to requireTenantScope()
// (tenant staff only), so customer/operator identities need a separate
// route, not a reimplementation for aesthetics.
const SELECT =
  "id, name, serial_number, category, status, branch_id, asset_type_id, asset_types(name)";

export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const category = params.get("category");
  const status = params.get("status");
  const branchId = params.get("branchId");

  let query = context.db.from("assets").select(SELECT).is("deleted_at", null);

  if (context.userType === "tenant_user") {
    query = query.eq("tenant_id", context.tenantId);
    if (branchId) query = query.eq("branch_id", branchId);
  } else {
    const visibility = await resolveAssetsVisibility(context);
    const ids = visibility?.kind === "ids" ? visibility.assetIds : [];
    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }
    query = query.in("id", ids);
  }

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({
    data:
      (data as unknown as { asset_types: { name: string } | null }[] | null)?.map((row) => {
        const { asset_types, ...rest } = row;
        return { ...rest, type_name: asset_types?.name };
      }) ?? [],
  });
}
