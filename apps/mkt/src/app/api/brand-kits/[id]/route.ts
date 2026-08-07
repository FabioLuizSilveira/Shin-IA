import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "name",
  "logo_url",
  "logo_dark_url",
  "palette",
  "fonts",
  "tone_of_voice",
  "tagline",
  "description",
  "website_url",
  "is_default",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) updates[field] = body[field];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no editable fields provided" }, { status: 422 });
    }
    updates.updated_at = new Date().toISOString();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_brand_kits")
      .update(updates)
      .eq("id", params.id)
      .eq("workspace_id", ctx.workspaceId)
      .select("*")
      .single();

    if (error) return internalError(error);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { error } = await supabase
      .from("mkt_brand_kits")
      .delete()
      .eq("id", params.id)
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
