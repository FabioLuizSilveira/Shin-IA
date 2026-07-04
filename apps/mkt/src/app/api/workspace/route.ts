import { NextResponse } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_workspaces")
      .select("*")
      .eq("id", ctx.workspaceId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
