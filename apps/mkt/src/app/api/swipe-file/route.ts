import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_swipe_files")
      .select("*, ad: mkt_ad_library_entries(*)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return internalError(error);
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
      ad_library_id?: string;
      custom_ad_url?: string;
      title?: string;
      notes?: string;
      tags?: string[];
      folder?: string;
    };

    if (!body.ad_library_id && !body.custom_ad_url) {
      return NextResponse.json(
        { error: "ad_library_id or custom_ad_url is required" },
        { status: 422 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_swipe_files")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        ad_library_id: body.ad_library_id ?? null,
        custom_ad_url: body.custom_ad_url ?? null,
        title: body.title ?? null,
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        folder: body.folder ?? null,
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

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("mkt_swipe_files")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId);

    if (error) return internalError(error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
