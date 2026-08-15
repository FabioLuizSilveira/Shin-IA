import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveAssetsVisibility } from "@/lib/mobile-assets-scope";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const SELECT =
  "id, name, serial_number, category, status, branch_id, asset_type_id, metadata, created_at, asset_types(name)";

interface AssetDetailRow {
  id: string;
  name: string;
  serial_number: string | null;
  category: string;
  status: string;
  branch_id: string;
  asset_type_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  asset_types: { name: string } | null;
}

// No trackingSummary here (unlike api/mobile/operations/[id]) — assets and
// resources are separate, unlinked tables in this schema (resource_locations
// is keyed by resource_id, and nothing connects an asset row to a
// resource_id). Inventing that link isn't in scope this wave; when a real
// asset<->resource relationship exists, this is where it would be added.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = context.db.from("assets").select(SELECT).eq("id", id).is("deleted_at", null);

  if (context.userType === "tenant_user") {
    query = query.eq("tenant_id", context.tenantId);
  } else {
    const visibility = await resolveAssetsVisibility(context);
    const ids = visibility?.kind === "ids" ? visibility.assetIds : [];
    if (!ids.includes(id)) {
      // Same IDOR-hygiene rule as api/mobile/operations/[id]: never
      // distinguish "not yours" from "doesn't exist".
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
  }

  const { data: rawAsset, error } = await query.maybeSingle();
  if (error) return internalError(error);
  if (!rawAsset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const { asset_types, ...asset } = rawAsset as unknown as AssetDetailRow;
  return NextResponse.json({ data: { ...asset, type_name: asset_types?.name } });
}
