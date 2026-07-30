// LinkedIn Marketing API — standard OAuth2 + Ads reporting.
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
import { PLATFORM_CONFIG, callbackRedirectUri } from "./config";
import type { ExchangeResult, InsightsResult } from "./types";

const LINKEDIN_VERSION = "202401";
const cfg = PLATFORM_CONFIG.linkedin;

export function getAuthorizeUrl(state: string): string {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", callbackRedirectUri("linkedin"));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", cfg.scopes.join(" "));
  return url.toString();
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackRedirectUri("linkedin"),
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) throw new Error(`linkedin token exchange failed: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };

  const accountsRes = await fetch("https://api.linkedin.com/rest/adAccounts?q=search", {
    headers: {
      Authorization: `Bearer ${json.access_token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const accountsJson = (await accountsRes.json()) as {
    elements?: { id: number; name: string }[];
  };
  const firstAccount = accountsJson.elements?.[0];

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
    accountId: firstAccount ? String(firstAccount.id) : undefined,
    accountName: firstAccount?.name,
  };
}

export async function fetchInsights(
  accessToken: string,
  accountId: string,
): Promise<InsightsResult> {
  const url = new URL("https://api.linkedin.com/rest/adAnalytics");
  url.searchParams.set("q", "analytics");
  url.searchParams.set("pivot", "ACCOUNT");
  url.searchParams.set("timeGranularity", "ALL");
  url.searchParams.set("accounts[0]", `urn:li:sponsoredAccount:${accountId}`);
  url.searchParams.set("fields", "impressions,clicks,costInLocalCurrency");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
  });
  if (!res.ok) throw new Error(`linkedin insights fetch failed: ${await res.text()}`);
  const json = (await res.json()) as {
    elements?: { impressions?: number; clicks?: number; costInLocalCurrency?: string }[];
  };
  const row = json.elements?.[0];
  return {
    impressions: row?.impressions ?? 0,
    clicks: row?.clicks ?? 0,
    spend: Number(row?.costInLocalCurrency ?? 0),
    currency: "BRL",
  };
}
