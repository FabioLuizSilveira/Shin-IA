import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_brand_kits")
      .select("*")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      name?: string;
      logo_url?: string;
      palette?: { name: string; hex: string; role: string }[];
      fonts?: { heading?: string; body?: string };
      tone_of_voice?: string;
      tagline?: string;
      description?: string;
      website_url?: string;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }

    const supabase = await createClient();
    const { count } = await supabase
      .from("mkt_brand_kits")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId);

    const { data, error } = await supabase
      .from("mkt_brand_kits")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        name: body.name.trim(),
        logo_url: body.logo_url ?? null,
        palette: body.palette ?? [],
        fonts: body.fonts ?? {},
        tone_of_voice: body.tone_of_voice ?? null,
        tagline: body.tagline ?? null,
        description: body.description ?? null,
        website_url: body.website_url ?? null,
        is_default: (count ?? 0) === 0,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
