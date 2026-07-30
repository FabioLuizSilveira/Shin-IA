// Meta Marketing API (Graph API) — OAuth + basic insights.
// Docs: https://developers.facebook.com/docs/marketing-api/overview
import { PLATFORM_CONFIG, callbackRedirectUri } from "./config";
import type { ExchangeResult, InsightsResult } from "./types";

const GRAPH_VERSION = "v21.0";
const cfg = PLATFORM_CONFIG.meta;

export function getAuthorizeUrl(state: string): string {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", callbackRedirectUri("meta"));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", cfg.scopes.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const url = new URL(cfg.tokenUrl);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", callbackRedirectUri("meta"));
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`meta token exchange failed: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };

  const accountsRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name&access_token=${json.access_token}`,
  );
  const accountsJson = (await accountsRes.json()) as {
    data?: { id: string; name: string }[];
  };
  const firstAccount = accountsJson.data?.[0];

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
    accountId: firstAccount?.id,
    accountName: firstAccount?.name,
  };
}

export async function fetchInsights(
  accessToken: string,
  accountId: string,
): Promise<InsightsResult> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights?fields=impressions,clicks,spend&access_token=${accessToken}`,
  );
  if (!res.ok) throw new Error(`meta insights fetch failed: ${await res.text()}`);
  const json = (await res.json()) as {
    data?: { impressions?: string; clicks?: string; spend?: string }[];
  };
  const row = json.data?.[0];
  return {
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    spend: Number(row?.spend ?? 0),
    currency: "BRL",
  };
}
