// Google Ads API — standard Google OAuth2 + Ads API v17 for account discovery
// and reporting. Requires GOOGLE_ADS_DEVELOPER_TOKEN in addition to the OAuth
// client id/secret (Google Ads-specific requirement, checked as extraEnv).
// Docs: https://developers.google.com/google-ads/api/docs/oauth/overview
import { PLATFORM_CONFIG, callbackRedirectUri } from "./config";
import type { ExchangeResult, InsightsResult } from "./types";

const ADS_API_VERSION = "v17";
const cfg = PLATFORM_CONFIG.google;

export function getAuthorizeUrl(state: string): string {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", process.env.GOOGLE_ADS_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", callbackRedirectUri("google"));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", cfg.scopes.join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      code,
      redirect_uri: callbackRedirectUri("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const customersRes = await fetch(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${json.access_token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
      },
    },
  );
  const customersJson = (await customersRes.json()) as { resourceNames?: string[] };
  const firstResource = customersJson.resourceNames?.[0];
  const customerId = firstResource?.split("/")[1];

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    accountId: customerId,
    accountName: customerId ? `Cliente ${customerId}` : undefined,
  };
}

export async function fetchInsights(
  accessToken: string,
  customerId: string,
): Promise<InsightsResult> {
  const query =
    "SELECT metrics.impressions, metrics.clicks, metrics.cost_micros FROM customer WHERE segments.date DURING LAST_7_DAYS";
  const res = await fetch(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!res.ok) throw new Error(`google insights fetch failed: ${await res.text()}`);
  const json = (await res.json()) as {
    results?: { metrics?: { impressions?: string; clicks?: string; costMicros?: string } }[];
  }[];
  const row = json[0]?.results?.[0]?.metrics;
  return {
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    spend: Number(row?.costMicros ?? 0) / 1_000_000,
    currency: "BRL",
  };
}
