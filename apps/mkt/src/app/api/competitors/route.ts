import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_competitor_monitors")
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
      brand_name?: string;
      brand_domain?: string;
      platforms?: string[];
    };
    if (!body.brand_name?.trim()) {
      return NextResponse.json({ error: "brand_name is required" }, { status: 422 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_competitor_monitors")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        brand_name: body.brand_name.trim(),
        brand_domain: body.brand_domain ?? null,
        platforms: body.platforms ?? ["meta"],
        created_by: ctx.userId,
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

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("mkt_competitor_monitors")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
