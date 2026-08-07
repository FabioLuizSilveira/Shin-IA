import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { isAdPlatform } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isAdPlatform(platform)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }

  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { error } = await supabase
      .from("mkt_ad_integrations")
      .update({
        status: "disconnected",
        access_token_enc: null,
        refresh_token_enc: null,
        token_expires_at: null,
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("platform", platform);

    if (error) return internalError(error);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
