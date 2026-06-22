export type SecurityLevel = "low" | "medium" | "high" | "critical";
export type ThreatCategory =
  | "injection"
  | "auth"
  | "exposure"
  | "xxe"
  | "access_control"
  | "misconfiguration"
  | "xss"
  | "deserialization"
  | "components"
  | "logging";
export type IsolationResult = "isolated" | "leaked" | "unknown";
export type AuditEventType = "auth" | "access" | "data_change" | "config_change" | "security_event";

export interface JwtClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  exp: number;
  iat: number;
  iss?: string;
  delegatedBy?: string;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface RLSPolicy {
  tenantId: string;
  table: string;
  column: string;
  value: string;
}

export interface ThreatFinding {
  id: string;
  category: ThreatCategory;
  level: SecurityLevel;
  description: string;
  mitigated: boolean;
  mitigationNote?: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  actorId: string;
  eventType: AuditEventType;
  resource: string;
  action: string;
  outcome: "success" | "failure";
  timestamp: string;
  metadata?: Record<string, unknown>;
  checksum?: string;
}

export interface SecurityViolation {
  rule: string;
  severity: SecurityLevel;
  detail: string;
}
