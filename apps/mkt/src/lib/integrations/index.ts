import type { AdPlatform } from "./config";
import type { ExchangeResult, InsightsResult } from "./types";
import * as meta from "./meta";
import * as google from "./google";
import * as tiktok from "./tiktok";
import * as linkedin from "./linkedin";

interface PlatformClient {
  getAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangeResult>;
  fetchInsights(accessToken: string, accountId: string): Promise<InsightsResult>;
}

const CLIENTS: Record<AdPlatform, PlatformClient> = { meta, google, tiktok, linkedin };

export function getPlatformClient(platform: AdPlatform): PlatformClient {
  return CLIENTS[platform];
}

export {
  AD_PLATFORMS,
  PLATFORM_CONFIG,
  isAdPlatform,
  isPlatformConfigured,
  missingEnvVars,
} from "./config";
export type { AdPlatform } from "./config";
