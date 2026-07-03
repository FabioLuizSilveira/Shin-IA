// ── Core context ──────────────────────────────────────────────────────────────

export type MktMode = "standalone" | "plugin";

export type MktPlan = "free" | "starter" | "pro" | "business" | "enterprise";

export interface MktContext {
  mode: MktMode;
  tenantId: string;
  workspaceId: string;
  userId: string;
  /** Set when the action originates from an MCP agent, e.g. "mcp:claude" */
  agentId?: string;
  plan: MktPlan;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface MktWorkspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  plan: MktPlan;
  mode: MktMode;
  creditsUsed: number;
  creditsLimit: number;
  settings: Record<string, unknown>;
}

// ── Brand kit ─────────────────────────────────────────────────────────────────

export interface BrandColor {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "background" | "text";
}

export interface MktBrandKit {
  id: string;
  workspaceId: string;
  tenantId: string;
  name: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  palette: BrandColor[];
  fonts: { heading?: string; body?: string };
  toneOfVoice?: string;
  tagline?: string;
  description?: string;
  websiteUrl?: string;
  productImages: string[];
  isDefault: boolean;
}

// ── Safety layer ──────────────────────────────────────────────────────────────

export type DraftEntityType = "campaign" | "ad_set" | "ad" | "budget" | "integration";

export type DraftAction = "create" | "update" | "delete" | "publish" | "pause" | "budget_change";

export type DraftStatus = "pending" | "approved" | "rejected" | "applied" | "rolled_back";

export interface MktDraft {
  id: string;
  workspaceId: string;
  tenantId: string;
  entityType: DraftEntityType;
  entityId?: string;
  action: DraftAction;
  payload: Record<string, unknown>;
  diff?: { before: Record<string, unknown>; after: Record<string, unknown> };
  status: DraftStatus;
  requestedBy: string;
  agentId?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

// ── AI providers ──────────────────────────────────────────────────────────────

export type MktAIProviderName =
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepseek"
  | "mistral"
  | "groq"
  | "openrouter"
  | "ollama";

export type MktAIOperation = "generate_ad" | "clone_ad" | "copy" | "strategy" | "vision" | "embed";

export interface MktAIProviderConfig {
  provider: MktAIProviderName;
  defaultModel?: string;
  baseUrl?: string;
  isDefault: boolean;
  isActive: boolean;
  monthlyLimitUsd?: number;
}

export interface MktAIUsageRecord {
  workspaceId: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  provider: MktAIProviderName;
  model: string;
  operation: MktAIOperation;
  tokensIn: number;
  tokensOut: number;
  costUsd?: number;
  durationMs?: number;
  entityType?: string;
  entityId?: string;
}

// ── Ad platforms ──────────────────────────────────────────────────────────────

export type AdPlatform = "meta" | "google" | "tiktok" | "linkedin";

export type AdCreativeType = "image" | "video" | "carousel";
