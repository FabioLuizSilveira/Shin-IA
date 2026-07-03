// MCP tool definitions for the Ads MCP Server.
// Invariant: no tool publishes directly — every mutating tool creates a draft
// that requires human approval in the dashboard (or via approve_draft, which
// itself requires an authenticated human session, never an agent token).

export interface MktMcpTool {
  name: string;
  description: string;
  mutating: boolean;
  inputSchema: Record<string, unknown>;
}

export const MKT_MCP_TOOLS: MktMcpTool[] = [
  {
    name: "list_campaigns",
    description: "List ad campaigns in the workspace, optionally filtered by platform or status.",
    mutating: false,
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["meta", "google", "tiktok", "linkedin"] },
        status: { type: "string" },
      },
    },
  },
  {
    name: "get_performance",
    description: "Get performance metrics (impressions, clicks, spend, CTR) for campaigns or ads.",
    mutating: false,
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        date_range: { type: "string", description: "e.g. last_7d, last_30d" },
      },
    },
  },
  {
    name: "search_ad_library",
    description: "Search competitor ads in the ad library by brand, platform, or keywords.",
    mutating: false,
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        platform: { type: "string" },
        keywords: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_drafts_pending_approval",
    description: "List drafts waiting for human approval.",
    mutating: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_ad_copy",
    description: "Generate ad copy with AI using the workspace brand kit. Does not publish.",
    mutating: false,
    inputSchema: {
      type: "object",
      required: ["platform", "objective", "product"],
      properties: {
        platform: { type: "string" },
        objective: { type: "string" },
        product: { type: "string" },
        tone: { type: "string" },
      },
    },
  },
  {
    name: "create_campaign_draft",
    description: "Create a campaign DRAFT. Requires human approval before anything is published.",
    mutating: true,
    inputSchema: {
      type: "object",
      required: ["platform", "name", "objective"],
      properties: {
        platform: { type: "string", enum: ["meta", "google", "tiktok", "linkedin"] },
        name: { type: "string" },
        objective: { type: "string" },
        budget_daily: { type: "number" },
        start_date: { type: "string" },
        targeting: { type: "object" },
      },
    },
  },
  {
    name: "create_ad_draft",
    description: "Create an ad DRAFT inside a campaign. Requires human approval.",
    mutating: true,
    inputSchema: {
      type: "object",
      required: ["campaign_id", "headline", "destination_url"],
      properties: {
        campaign_id: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        cta: { type: "string" },
        destination_url: { type: "string" },
        creative_description: { type: "string" },
      },
    },
  },
  {
    name: "update_budget_draft",
    description: "Create a budget-change DRAFT for a campaign. Requires human approval.",
    mutating: true,
    inputSchema: {
      type: "object",
      required: ["campaign_id", "new_budget"],
      properties: {
        campaign_id: { type: "string" },
        new_budget: { type: "number" },
      },
    },
  },
  {
    name: "pause_campaign_draft",
    description: "Create a pause DRAFT for a campaign. Requires human approval.",
    mutating: true,
    inputSchema: {
      type: "object",
      required: ["campaign_id"],
      properties: { campaign_id: { type: "string" } },
    },
  },
];
