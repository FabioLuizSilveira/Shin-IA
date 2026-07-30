import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { isAdPlatform, getPlatformClient } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "mkt_oauth_state";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const { origin, searchParams } = new URL(request.url);

  if (!isAdPlatform(platform)) {
    return NextResponse.redirect(`${origin}/integrations?error=unknown_platform`);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !savedState || savedState !== `${platform}:${state}`) {
    return NextResponse.redirect(`${origin}/integrations?error=invalid_state&platform=${platform}`);
  }

  try {
    const ctx = await getMktContext();
    const result = await getPlatformClient(platform).exchangeCode(code);

    const accessTokenEnc = await encryptSecret(result.accessToken);
    const refreshTokenEnc = result.refreshToken ? await encryptSecret(result.refreshToken) : null;
    const tokenExpiresAt = result.expiresInSeconds
      ? new Date(Date.now() + result.expiresInSeconds * 1000).toISOString()
      : null;

    const supabase = await createClient();
    const { error } = await supabase.from("mkt_ad_integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        platform,
        account_id: result.accountId ?? null,
        account_name: result.accountName ?? null,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: tokenExpiresAt,
        status: "connected",
        created_by: ctx.userId,
      },
      { onConflict: "workspace_id,platform" },
    );

    if (error) {
      return NextResponse.redirect(`${origin}/integrations?error=save_failed&platform=${platform}`);
    }

    const res = NextResponse.redirect(`${origin}/integrations?connected=${platform}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.redirect(`${origin}/login?next=/integrations`);
    }
    return NextResponse.redirect(
      `${origin}/integrations?error=exchange_failed&platform=${platform}`,
    );
  }
}
