import { NextResponse, type NextRequest } from "next/server";
import { isAdPlatform, isPlatformConfigured, getPlatformClient } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "mkt_oauth_state";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const { origin } = new URL(request.url);

  if (!isAdPlatform(platform)) {
    return NextResponse.redirect(`${origin}/integrations?error=unknown_platform`);
  }
  if (!isPlatformConfigured(platform)) {
    return NextResponse.redirect(
      `${origin}/integrations?error=not_configured&platform=${platform}`,
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = getPlatformClient(platform).getAuthorizeUrl(state);

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, `${platform}:${state}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
