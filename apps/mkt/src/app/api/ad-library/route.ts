import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { sanitizePostgrestFilterValue } from "@/lib/postgrest-filter";

export const dynamic = "force-dynamic";

// GET /api/ad-library?q=&platform=&brand= — search the workspace's ad index
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim();
    const platform = searchParams.get("platform");
    const brand = searchParams.get("brand")?.trim();

    const supabase = await createClient();
    let query = supabase
      .from("mkt_ad_library_entries")
      .select("*")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (platform) query = query.eq("platform", platform);
    if (brand) query = query.ilike("brand_name", `%${brand}%`);
    if (q) {
      const safeQ = sanitizePostgrestFilterValue(q);
      query = query.or(
        `headline.ilike.%${safeQ}%,body_copy.ilike.%${safeQ}%,brand_name.ilike.%${safeQ}%`,
      );
    }

    const { data, error } = await query;
    if (error) return internalError(error);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// POST /api/ad-library — index an ad manually (or via the chrome extension later)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      platform?: string;
      brand_name?: string;
      brand_domain?: string;
      creative_url?: string;
      creative_type?: string;
      headline?: string;
      body_copy?: string;
      cta?: string;
      landing_url?: string;
    };

    if (!body.brand_name?.trim() || !body.platform) {
      return NextResponse.json({ error: "brand_name and platform are required" }, { status: 422 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_ad_library_entries")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        platform: body.platform,
        brand_name: body.brand_name.trim(),
        brand_domain: body.brand_domain ?? null,
        creative_url: body.creative_url ?? null,
        creative_type: body.creative_type ?? "image",
        headline: body.headline ?? null,
        body_copy: body.body_copy ?? null,
        cta: body.cta ?? null,
        landing_url: body.landing_url ?? null,
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) return internalError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
