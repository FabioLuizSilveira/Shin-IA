import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { createDraft } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_campaigns")
      .select("*")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false });
    if (error) return internalError(error);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// POST — request a campaign creation DRAFT (safety layer: needs approval)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      name?: string;
      platform?: string;
      objective?: string;
      budget_daily?: number;
      budget_total?: number;
      start_date?: string;
      end_date?: string;
      brand_kit_id?: string;
      targeting?: Record<string, unknown>;
    };

    if (!body.name?.trim() || !body.platform) {
      return NextResponse.json({ error: "name and platform are required" }, { status: 422 });
    }

    const result = await createDraft(ctx, {
      entityType: "campaign",
      action: "create",
      payload: {
        name: body.name.trim(),
        platform: body.platform,
        objective: body.objective ?? null,
        budget_daily: body.budget_daily,
        budget_total: body.budget_total,
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
        brand_kit_id: body.brand_kit_id ?? null,
        targeting: body.targeting ?? {},
      },
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ data: { draft_id: result.id, status: "pending" } }, { status: 202 });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
