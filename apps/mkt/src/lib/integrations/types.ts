export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  accountId?: string;
  accountName?: string;
}

export interface InsightsResult {
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
}
