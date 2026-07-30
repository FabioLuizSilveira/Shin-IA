// Static per-platform OAuth config. Client id/secret live in env vars, never
// in the database — only the resulting access/refresh tokens are persisted
// (encrypted) in mkt_ad_integrations once a workspace connects an account.

export type AdPlatform = "meta" | "google" | "tiktok" | "linkedin";

export const AD_PLATFORMS: AdPlatform[] = ["meta", "google", "tiktok", "linkedin"];

interface PlatformConfig {
  label: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraEnv?: string[];
  scopes: string[];
  authorizeUrl: string;
  tokenUrl: string;
}

export const PLATFORM_CONFIG: Record<AdPlatform, PlatformConfig> = {
  meta: {
    label: "Meta Ads",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    scopes: ["ads_read", "ads_management"],
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  },
  google: {
    label: "Google Ads",
    clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
    clientSecretEnv: "GOOGLE_ADS_CLIENT_SECRET",
    extraEnv: ["GOOGLE_ADS_DEVELOPER_TOKEN"],
    scopes: ["https://www.googleapis.com/auth/adwords"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  },
  tiktok: {
    label: "TikTok Ads",
    clientIdEnv: "TIKTOK_APP_ID",
    clientSecretEnv: "TIKTOK_APP_SECRET",
    scopes: [],
    authorizeUrl: "https://business-api.tiktok.com/portal/auth",
    tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
  },
  linkedin: {
    label: "LinkedIn Ads",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    scopes: ["r_ads", "r_ads_reporting"],
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  },
};

export function isAdPlatform(value: string): value is AdPlatform {
  return (AD_PLATFORMS as string[]).includes(value);
}

function requiredEnvVars(platform: AdPlatform): string[] {
  const cfg = PLATFORM_CONFIG[platform];
  return [cfg.clientIdEnv, cfg.clientSecretEnv, ...(cfg.extraEnv ?? [])];
}

export function missingEnvVars(platform: AdPlatform): string[] {
  return requiredEnvVars(platform).filter((name) => !process.env[name]);
}

export function isPlatformConfigured(platform: AdPlatform): boolean {
  return missingEnvVars(platform).length === 0;
}

export function callbackRedirectUri(platform: AdPlatform): string {
  const base = process.env.NEXT_PUBLIC_MKT_URL ?? "http://localhost:3003";
  return `${base}/api/integrations/${platform}/callback`;
}
