import { NextResponse } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import {
  AD_PLATFORMS,
  PLATFORM_CONFIG,
  isPlatformConfigured,
  missingEnvVars,
} from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_ad_integrations")
      .select("platform, account_id, account_name, status, last_synced_at, metadata")
      .eq("workspace_id", ctx.workspaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));

    const result = AD_PLATFORMS.map((platform) => {
      const configured = isPlatformConfigured(platform);
      const row = byPlatform.get(platform);
      return {
        platform,
        label: PLATFORM_CONFIG[platform].label,
        configured,
        missingEnv: configured ? [] : missingEnvVars(platform),
        status: configured ? (row?.status ?? "disconnected") : "not_configured",
        accountName: row?.account_name ?? null,
        lastSyncedAt: row?.last_synced_at ?? null,
        metrics: row?.metadata?.last_insights ?? null,
      };
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
