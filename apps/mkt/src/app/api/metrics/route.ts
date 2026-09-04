import { NextResponse } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();

    const count = (table: string, filters?: Record<string, string>) => {
      let q = supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspaceId);
      for (const [k, v] of Object.entries(filters ?? {})) q = q.eq(k, v);
      return q;
    };

    const [
      campaigns,
      generated,
      cloned,
      pendingDrafts,
      competitors,
      swipeItems,
      brandKits,
      usage,
      workspace,
    ] = await Promise.all([
      count("mkt_campaigns"),
      count("mkt_generated_ads"),
      count("mkt_cloned_ads"),
      count("mkt_drafts", { status: "pending" }),
      count("mkt_competitor_monitors"),
      count("mkt_swipe_files"),
      count("mkt_brand_kits"),
      supabase
        .from("ai_gateway_usage")
        .select("tokens_in, tokens_out")
        .eq("workspace_id", ctx.workspaceId),
      supabase
        .from("mkt_workspaces")
        .select("plan, credits_limit")
        .eq("id", ctx.workspaceId)
        .single(),
    ]);

    const tokensUsed = (usage.data ?? []).reduce(
      (sum, u) => sum + (u.tokens_in ?? 0) + (u.tokens_out ?? 0),
      0,
    );

    return NextResponse.json({
      data: {
        campaigns: campaigns.count ?? 0,
        generated_ads: generated.count ?? 0,
        cloned_ads: cloned.count ?? 0,
        pending_drafts: pendingDrafts.count ?? 0,
        competitors: competitors.count ?? 0,
        swipe_items: swipeItems.count ?? 0,
        brand_kits: brandKits.count ?? 0,
        tokens_used: tokensUsed,
        credits_limit: workspace.data?.credits_limit ?? 0,
        plan: workspace.data?.plan ?? "free",
      },
    });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
