import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { isAdPlatform, getPlatformClient } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isAdPlatform(platform)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }

  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data: integration, error: fetchError } = await supabase
      .from("mkt_ad_integrations")
      .select("account_id, access_token_enc, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("platform", platform)
      .maybeSingle();

    if (fetchError) return internalError(fetchError);
    if (!integration || integration.status !== "connected" || !integration.access_token_enc) {
      return NextResponse.json({ error: "integration not connected" }, { status: 409 });
    }
    if (!integration.account_id) {
      return NextResponse.json(
        { error: "no ad account linked to this integration" },
        { status: 422 },
      );
    }

    const accessToken = await decryptSecret(integration.access_token_enc);
    const insights = await getPlatformClient(platform).fetchInsights(
      accessToken,
      integration.account_id,
    );

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("mkt_ad_integrations")
      .update({
        last_synced_at: now,
        metadata: { last_insights: insights, synced_at: now },
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("platform", platform);

    if (updateError) return internalError(updateError);

    return NextResponse.json({ data: insights });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
