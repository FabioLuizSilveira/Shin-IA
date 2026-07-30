// TikTok Marketing API — OAuth (Business Center authorization flow) + basic
// reporting. Docs: https://business-api.tiktok.com/portal/docs
import { PLATFORM_CONFIG } from "./config";
import type { ExchangeResult, InsightsResult } from "./types";

const cfg = PLATFORM_CONFIG.tiktok;

export function getAuthorizeUrl(state: string): string {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("app_id", process.env.TIKTOK_APP_ID ?? "");
  url.searchParams.set("state", state);
  url.searchParams.set(
    "redirect_uri",
    process.env.NEXT_PUBLIC_MKT_URL
      ? `${process.env.NEXT_PUBLIC_MKT_URL}/api/integrations/tiktok/callback`
      : "http://localhost:3003/api/integrations/tiktok/callback",
  );
  return url.toString();
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.TIKTOK_APP_ID,
      secret: process.env.TIKTOK_APP_SECRET,
      auth_code: code,
    }),
  });
  if (!res.ok) throw new Error(`tiktok token exchange failed: ${await res.text()}`);
  const json = (await res.json()) as {
    data?: { access_token: string; advertiser_ids?: string[] };
  };
  const advertiserId = json.data?.advertiser_ids?.[0];
  return {
    accessToken: json.data?.access_token ?? "",
    accountId: advertiserId,
    accountName: advertiserId ? `Advertiser ${advertiserId}` : undefined,
  };
}

export async function fetchInsights(
  accessToken: string,
  advertiserId: string,
): Promise<InsightsResult> {
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/");
  url.searchParams.set("advertiser_id", advertiserId);
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("dimensions", JSON.stringify(["advertiser_id"]));
  url.searchParams.set("metrics", JSON.stringify(["impressions", "clicks", "spend"]));
  url.searchParams.set("data_level", "AUCTION_ADVERTISER");

  const res = await fetch(url.toString(), {
    headers: { "Access-Token": accessToken },
  });
  if (!res.ok) throw new Error(`tiktok insights fetch failed: ${await res.text()}`);
  const json = (await res.json()) as {
    data?: { list?: { metrics?: { impressions?: string; clicks?: string; spend?: string } }[] };
  };
  const row = json.data?.list?.[0]?.metrics;
  return {
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    spend: Number(row?.spend ?? 0),
    currency: "BRL",
  };
}
