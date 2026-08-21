import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { sanitizePostgrestFilterValue } from "@/lib/postgrest-filter";

export const dynamic = "force-dynamic";

// Backs the ⌘K command menu's search-as-you-type. Workspace-scoped (mkt's
// isolation boundary, see getMktContext()), capped at 5 rows per entity.
const LIMIT = 5;

export async function GET(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({
        data: { campaigns: [], brandKits: [], generatedAds: [], clonedAds: [] },
      });
    }
    const term = `%${sanitizePostgrestFilterValue(q)}%`;
    const supabase = await createClient();

    const [campaigns, brandKits, generatedAds, clonedAds] = await Promise.all([
      supabase
        .from("mkt_campaigns")
        .select("id, name, platform, status")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("name", term)
        .limit(LIMIT),
      supabase
        .from("mkt_brand_kits")
        .select("id, name")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("name", term)
        .limit(LIMIT),
      supabase
        .from("mkt_generated_ads")
        .select("id, headline, platform, status")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("headline", term)
        .limit(LIMIT),
      supabase
        .from("mkt_cloned_ads")
        .select("id, adapted_headline, status")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("adapted_headline", term)
        .limit(LIMIT),
    ]);

    for (const r of [campaigns, brandKits, generatedAds, clonedAds]) {
      if (r.error) return internalError(r.error);
    }

    return NextResponse.json({
      data: {
        campaigns: campaigns.data ?? [],
        brandKits: brandKits.data ?? [],
        generatedAds: generatedAds.data ?? [],
        clonedAds: clonedAds.data ?? [],
      },
    });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
