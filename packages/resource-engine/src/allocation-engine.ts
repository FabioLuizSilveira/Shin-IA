import type {
  Resource,
  ResourceAllocation,
  ResourceRepository,
  AllocationRepository,
  ResourceCalendarRepository,
  ResourceQuery,
  MatchResult,
} from "./types.js";
import { AvailabilityChecker } from "./availability-checker.js";
import { CapabilityMatcher } from "./capability-matcher.js";

export interface AllocationEngineDeps {
  resourceRepository: ResourceRepository;
  allocationRepository: AllocationRepository;
  calendarRepository: ResourceCalendarRepository;
}

export interface AllocateInput {
  operationId: string;
  tenantId: string;
  resourceId: string;
  startAt: string;
  endAt: string;
  allocatedBy: string;
  metadata?: Record<string, unknown>;
}

export interface FindAndAllocateInput {
  operationId: string;
  query: ResourceQuery;
  allocatedBy: string;
  metadata?: Record<string, unknown>;
}

export interface AllocationResult {
  allocation: ResourceAllocation;
  resource: Resource;
}

export class AllocationEngine {
  private resources: ResourceRepository;
  private allocations: AllocationRepository;
  private availabilityChecker: AvailabilityChecker;
  private capabilityMatcher: CapabilityMatcher;

  constructor(deps: AllocationEngineDeps) {
    this.resources = deps.resourceRepository;
    this.allocations = deps.allocationRepository;
    this.availabilityChecker = new AvailabilityChecker({
      allocationRepository: deps.allocationRepository,
      calendarRepository: deps.calendarRepository,
    });
    this.capabilityMatcher = new CapabilityMatcher();
  }

  async allocate(input: AllocateInput): Promise<AllocationResult> {
    const resource = await this.resources.findById(input.resourceId);
    if (!resource) throw new Error(`Resource '${input.resourceId}' not found`);
    if (resource.tenantId !== input.tenantId) throw new Error("Resource does not belong to tenant");

    const availability = await this.availabilityChecker.checkAvailability(
      resource,
      input.startAt,
      input.endAt,
    );
    if (!availability.available) {
      throw new Error(`Resource is not available: ${availability.conflictReason}`);
    }

    const allocation: ResourceAllocation = {
      id: crypto.randomUUID(),
      resourceId: input.resourceId,
      operationId: input.operationId,
      tenantId: input.tenantId,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "active",
      allocatedBy: input.allocatedBy,
      allocatedAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };

    const updated: Resource = {
      ...resource,
      status: "allocated",
      updatedAt: new Date().toISOString(),
    };

    const [savedAlloc] = await Promise.all([
      this.allocations.save(allocation),
      this.resources.update(updated),
    ]);

    return { allocation: savedAlloc, resource: updated };
  }

  async deallocate(allocationId: string, deallocatedBy: string): Promise<void> {
    const allocation = await this.allocations.findById(allocationId);
    if (!allocation) throw new Error(`Allocation '${allocationId}' not found`);
    if (allocation.status !== "active") {
      throw new Error(`Cannot deallocate allocation in status '${allocation.status}'`);
    }

    const resource = await this.resources.findById(allocation.resourceId);

    await this.allocations.update({
      ...allocation,
      status: "completed",
      metadata: { ...allocation.metadata, deallocatedBy, deallocatedAt: new Date().toISOString() },
    });

    if (resource) {
      const activeAllocations = await this.allocations.findActiveByResource(resource.id);
      const remainingActive = activeAllocations.filter((a) => a.id !== allocationId);
      if (remainingActive.length === 0) {
        await this.resources.update({
          ...resource,
          status: "available",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  async findAvailableResources(query: ResourceQuery): Promise<MatchResult[]> {
    const tenantResources = query.branchId
      ? await this.resources.findByBranch(query.tenantId, query.branchId)
      : await this.resources.findByTenant(query.tenantId);

    const matched = this.capabilityMatcher.match(tenantResources, query);

    const availabilityWindows = await this.availabilityChecker.checkMultiple(
      matched.map((m) => m.resource),
      query.availableFrom,
      query.availableUntil,
    );

    const availableIds = new Set(
      availabilityWindows.filter((w) => w.available).map((w) => w.resourceId),
    );

    return matched.filter((m) => availableIds.has(m.resource.id));
  }

  async findAndAllocate(input: FindAndAllocateInput): Promise<AllocationResult | null> {
    const available = await this.findAvailableResources(input.query);
    if (available.length === 0) return null;

    const best = available[0]!;
    return this.allocate({
      operationId: input.operationId,
      tenantId: input.query.tenantId,
      resourceId: best.resource.id,
      startAt: input.query.availableFrom,
      endAt: input.query.availableUntil,
      allocatedBy: input.allocatedBy,
      metadata: input.metadata,
    });
  }

  async detectConflicts(
    resourceId: string,
    startAt: string,
    endAt: string,
  ): Promise<ResourceAllocation[]> {
    return this.allocations.findConflicting(resourceId, startAt, endAt);
  }
}
