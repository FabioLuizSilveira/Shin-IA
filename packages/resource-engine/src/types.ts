// ─── Resource Types ───────────────────────────────────────────────────────────

export type ResourceType =
  | "vehicle"
  | "forklift"
  | "crane"
  | "munk"
  | "grua"
  | "agricultural_machine"
  | "operator"
  | "driver"
  | "technician"
  | "custom";

export type ResourceStatus = "available" | "allocated" | "maintenance" | "inactive";

export interface Resource {
  id: string;
  tenantId: string;
  branchId: string;
  type: ResourceType;
  subtype: string;
  name: string;
  capabilities: string[];
  status: ResourceStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ─── Allocation ───────────────────────────────────────────────────────────────

export type AllocationStatus = "active" | "completed" | "cancelled";

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  operationId: string;
  tenantId: string;
  startAt: string;
  endAt: string;
  status: AllocationStatus;
  allocatedBy: string;
  allocatedAt: string;
  metadata: Record<string, unknown>;
}

// ─── Calendar / Availability ──────────────────────────────────────────────────

export interface ResourceCalendarEntry {
  id: string;
  resourceId: string;
  tenantId: string;
  startAt: string;
  endAt: string;
  type: "blocked" | "maintenance" | "reserved";
  reason: string;
  createdBy: string;
}

export interface AvailabilityWindow {
  resourceId: string;
  startAt: string;
  endAt: string;
  available: boolean;
  conflictReason?: string;
  conflictingAllocationId?: string;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface CapabilityRequirement {
  capability: string;
  required: boolean;
}

export interface ResourceQuery {
  tenantId: string;
  branchId?: string;
  type?: ResourceType;
  subtypes?: string[];
  requiredCapabilities?: string[];
  availableFrom: string;
  availableUntil: string;
}

export interface MatchResult {
  resource: Resource;
  score: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface ResourceRepository {
  findById(id: string): Promise<Resource | null>;
  findByTenant(tenantId: string): Promise<Resource[]>;
  findByBranch(tenantId: string, branchId: string): Promise<Resource[]>;
  save(resource: Resource): Promise<Resource>;
  update(resource: Resource): Promise<Resource>;
  softDelete(id: string): Promise<void>;
}

export interface AllocationRepository {
  findById(id: string): Promise<ResourceAllocation | null>;
  findActiveByResource(resourceId: string): Promise<ResourceAllocation[]>;
  findByOperation(operationId: string): Promise<ResourceAllocation[]>;
  findConflicting(
    resourceId: string,
    startAt: string,
    endAt: string,
  ): Promise<ResourceAllocation[]>;
  save(allocation: ResourceAllocation): Promise<ResourceAllocation>;
  update(allocation: ResourceAllocation): Promise<ResourceAllocation>;
}

export interface ResourceCalendarRepository {
  findByResource(resourceId: string): Promise<ResourceCalendarEntry[]>;
  findConflicting(
    resourceId: string,
    startAt: string,
    endAt: string,
  ): Promise<ResourceCalendarEntry[]>;
  save(entry: ResourceCalendarEntry): Promise<ResourceCalendarEntry>;
  delete(id: string): Promise<void>;
}
