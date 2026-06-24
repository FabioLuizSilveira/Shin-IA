export type PartnerTier = "bronze" | "silver" | "gold" | "platinum";
export type PartnerStatus = "pending" | "active" | "suspended" | "terminated";
export type PluginStatus = "draft" | "submitted" | "approved" | "rejected" | "deprecated";
export type OpportunityStatus = "open" | "matched" | "accepted" | "declined" | "closed";
export type OperatorStatus = "active" | "inactive" | "banned";

export interface Partner {
  id: string;
  name: string;
  tier: PartnerTier;
  status: PartnerStatus;
  capabilities: string[];
  regions: string[];
  rating: number;
  joinedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  partnerId: string;
  description: string;
  status: PluginStatus;
  capabilities: string[];
  config?: Record<string, unknown>;
  publishedAt?: string;
  deprecatedAt?: string;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  requiredCapabilities: string[];
  region: string;
  estimatedValue: number;
  status: OpportunityStatus;
  matchedPartnerId?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface OperatorProfile {
  id: string;
  tenantId: string;
  name: string;
  status: OperatorStatus;
  skills: string[];
  region: string;
  rating: number;
  jobsCompleted: number;
  registeredAt: string;
}

export interface MatchScore {
  partnerId: string;
  score: number;
  reasons: string[];
}
