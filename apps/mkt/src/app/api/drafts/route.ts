import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { applyDraft, rejectDraft } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const status = req.nextUrl.searchParams.get("status") ?? "pending";
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_drafts")
      .select("*")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// POST { id, decision: "approve" | "reject", note? }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      id?: string;
      decision?: "approve" | "reject";
      note?: string;
    };
    if (!body.id || !body.decision) {
      return NextResponse.json({ error: "id and decision are required" }, { status: 422 });
    }

    const result =
      body.decision === "approve"
        ? await applyDraft(ctx, body.id)
        : await rejectDraft(ctx, body.id, body.note);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
