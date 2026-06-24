import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvailabilityChecker } from "../availability-checker.js";
import { CapabilityMatcher } from "../capability-matcher.js";
import { AllocationEngine } from "../allocation-engine.js";
import type {
  Resource,
  ResourceAllocation,
  ResourceCalendarEntry,
  ResourceRepository,
  AllocationRepository,
  ResourceCalendarRepository,
  ResourceQuery,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = "2026-01-01T08:00:00Z";
const end = "2026-01-01T18:00:00Z";

const makeResource = (overrides: Partial<Resource> = {}): Resource => ({
  id: "res-1",
  tenantId: "tenant-1",
  branchId: "branch-1",
  type: "forklift",
  subtype: "electric",
  name: "Forklift A",
  capabilities: ["heavy_lift", "forklift_operation"],
  status: "available",
  metadata: {},
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides,
});

const makeAllocation = (overrides: Partial<ResourceAllocation> = {}): ResourceAllocation => ({
  id: "alloc-1",
  resourceId: "res-1",
  operationId: "op-1",
  tenantId: "tenant-1",
  startAt: now,
  endAt: end,
  status: "active",
  allocatedBy: "user-1",
  allocatedAt: now,
  metadata: {},
  ...overrides,
});

// ─── Mock Repos ───────────────────────────────────────────────────────────────

function makeResourceRepo(resource: Resource | null = makeResource()): ResourceRepository {
  return {
    findById: vi.fn().mockResolvedValue(resource),
    findByTenant: vi.fn().mockResolvedValue(resource ? [resource] : []),
    findByBranch: vi.fn().mockResolvedValue(resource ? [resource] : []),
    save: vi.fn().mockImplementation((r: Resource) => Promise.resolve(r)),
    update: vi.fn().mockImplementation((r: Resource) => Promise.resolve(r)),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAllocationRepo(
  allocation: ResourceAllocation | null = null,
  conflicts: ResourceAllocation[] = [],
  active: ResourceAllocation[] = [],
): AllocationRepository {
  return {
    findById: vi.fn().mockResolvedValue(allocation),
    findActiveByResource: vi.fn().mockResolvedValue(active),
    findByOperation: vi.fn().mockResolvedValue([]),
    findConflicting: vi.fn().mockResolvedValue(conflicts),
    save: vi.fn().mockImplementation((a: ResourceAllocation) => Promise.resolve(a)),
    update: vi.fn().mockImplementation((a: ResourceAllocation) => Promise.resolve(a)),
  };
}

function makeCalendarRepo(conflicts: ResourceCalendarEntry[] = []): ResourceCalendarRepository {
  return {
    findByResource: vi.fn().mockResolvedValue([]),
    findConflicting: vi.fn().mockResolvedValue(conflicts),
    save: vi.fn().mockImplementation((e: ResourceCalendarEntry) => Promise.resolve(e)),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── AvailabilityChecker Tests ────────────────────────────────────────────────

describe("AvailabilityChecker", () => {
  let allocRepo: AllocationRepository;
  let calRepo: ResourceCalendarRepository;
  let checker: AvailabilityChecker;

  beforeEach(() => {
    allocRepo = makeAllocationRepo();
    calRepo = makeCalendarRepo();
    checker = new AvailabilityChecker({
      allocationRepository: allocRepo,
      calendarRepository: calRepo,
    });
  });

  it("returns available when no conflicts", async () => {
    const result = await checker.checkAvailability(makeResource(), now, end);
    expect(result.available).toBe(true);
  });

  it("returns unavailable when resource is in maintenance", async () => {
    const result = await checker.checkAvailability(
      makeResource({ status: "maintenance" }),
      now,
      end,
    );
    expect(result.available).toBe(false);
    expect(result.conflictReason).toContain("maintenance");
  });

  it("returns unavailable when resource is inactive", async () => {
    const result = await checker.checkAvailability(makeResource({ status: "inactive" }), now, end);
    expect(result.available).toBe(false);
  });

  it("returns unavailable when there is an active allocation conflict", async () => {
    allocRepo = makeAllocationRepo(null, [makeAllocation()]);
    checker = new AvailabilityChecker({
      allocationRepository: allocRepo,
      calendarRepository: calRepo,
    });

    const result = await checker.checkAvailability(makeResource(), now, end);
    expect(result.available).toBe(false);
    expect(result.conflictingAllocationId).toBe("alloc-1");
  });

  it("ignores cancelled/completed allocation conflicts", async () => {
    allocRepo = makeAllocationRepo(null, [makeAllocation({ status: "completed" })]);
    checker = new AvailabilityChecker({
      allocationRepository: allocRepo,
      calendarRepository: calRepo,
    });

    const result = await checker.checkAvailability(makeResource(), now, end);
    expect(result.available).toBe(true);
  });

  it("returns unavailable when calendar block exists", async () => {
    const entry: ResourceCalendarEntry = {
      id: "cal-1",
      resourceId: "res-1",
      tenantId: "tenant-1",
      startAt: now,
      endAt: end,
      type: "maintenance",
      reason: "Scheduled maintenance",
      createdBy: "user-1",
    };
    calRepo = makeCalendarRepo([entry]);
    checker = new AvailabilityChecker({
      allocationRepository: allocRepo,
      calendarRepository: calRepo,
    });

    const result = await checker.checkAvailability(makeResource(), now, end);
    expect(result.available).toBe(false);
    expect(result.conflictReason).toContain("Scheduled maintenance");
  });

  it("checkMultiple checks all resources", async () => {
    const resources = [makeResource({ id: "res-1" }), makeResource({ id: "res-2" })];
    const results = await checker.checkMultiple(resources, now, end);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.available)).toBe(true);
  });

  it("overlaps static method works correctly", () => {
    // a: [08:00, 18:00], b: [10:00, 12:00] → overlaps
    expect(AvailabilityChecker.overlaps("08:00", "18:00", "10:00", "12:00")).toBe(true);
    // a: [08:00, 10:00], b: [10:00, 12:00] → adjacent, no overlap
    expect(AvailabilityChecker.overlaps("08:00", "10:00", "10:00", "12:00")).toBe(false);
    // a: [08:00, 09:00], b: [10:00, 12:00] → no overlap
    expect(AvailabilityChecker.overlaps("08:00", "09:00", "10:00", "12:00")).toBe(false);
  });
});

// ─── CapabilityMatcher Tests ──────────────────────────────────────────────────

describe("CapabilityMatcher", () => {
  const matcher = new CapabilityMatcher();

  const resources: Resource[] = [
    makeResource({ id: "res-1", capabilities: ["heavy_lift", "forklift_operation", "outdoor"] }),
    makeResource({ id: "res-2", capabilities: ["heavy_lift"] }),
    makeResource({ id: "res-3", capabilities: ["forklift_operation"], status: "inactive" }),
    makeResource({ id: "res-4", tenantId: "other-tenant", capabilities: ["heavy_lift"] }),
    makeResource({ id: "res-5", branchId: "other-branch", capabilities: ["heavy_lift"] }),
  ];

  const baseQuery: ResourceQuery = {
    tenantId: "tenant-1",
    availableFrom: now,
    availableUntil: end,
  };

  it("filters by tenant", () => {
    const results = matcher.match(resources, baseQuery);
    expect(results.every((r) => r.resource.tenantId === "tenant-1")).toBe(true);
    expect(results.find((r) => r.resource.id === "res-4")).toBeUndefined();
  });

  it("filters out inactive resources", () => {
    const results = matcher.match(resources, baseQuery);
    expect(results.find((r) => r.resource.id === "res-3")).toBeUndefined();
  });

  it("filters by branchId when specified", () => {
    const results = matcher.match(resources, { ...baseQuery, branchId: "branch-1" });
    expect(results.find((r) => r.resource.id === "res-5")).toBeUndefined();
  });

  it("filters by type when specified", () => {
    const vehicleResources = [
      ...resources,
      makeResource({ id: "truck-1", type: "vehicle", subtype: "truck", capabilities: [] }),
    ];
    const results = matcher.match(vehicleResources, { ...baseQuery, type: "vehicle" });
    expect(results).toHaveLength(1);
    expect(results[0]?.resource.id).toBe("truck-1");
  });

  it("filters by subtypes when specified", () => {
    const results = matcher.match(resources, { ...baseQuery, subtypes: ["electric"] });
    expect(results.every((r) => r.resource.subtype === "electric")).toBe(true);
  });

  it("filters by required capabilities", () => {
    const results = matcher.match(resources, {
      ...baseQuery,
      requiredCapabilities: ["heavy_lift"],
    });
    expect(results.every((r) => r.matchedCapabilities.includes("heavy_lift"))).toBe(true);
    expect(results.find((r) => r.resource.id === "res-3")).toBeUndefined(); // inactive
  });

  it("scores resources by capability match", () => {
    const results = matcher.match(resources, {
      ...baseQuery,
      requiredCapabilities: ["heavy_lift"],
    });
    // res-2 has only heavy_lift (perfect match), res-1 has extra capabilities
    const res1 = results.find((r) => r.resource.id === "res-1");
    const res2 = results.find((r) => r.resource.id === "res-2");
    expect(res2!.score).toBeGreaterThan(res1!.score); // focused match scores higher
  });

  it("findBestMatch returns highest scoring match", () => {
    const best = matcher.findBestMatch(resources, {
      ...baseQuery,
      requiredCapabilities: ["heavy_lift"],
    });
    expect(best).not.toBeNull();
    expect(best!.resource.id).toBe("res-2");
  });

  it("findBestMatch returns null for empty list", () => {
    expect(matcher.findBestMatch([], baseQuery)).toBeNull();
  });

  it("reports missing capabilities", () => {
    const results = matcher.match(resources, {
      ...baseQuery,
      requiredCapabilities: ["heavy_lift", "does_not_exist"],
    });
    // No resource has "does_not_exist" → no matches (required: true by default)
    expect(results).toHaveLength(0);
  });
});

// ─── AllocationEngine Tests ───────────────────────────────────────────────────

describe("AllocationEngine", () => {
  let resRepo: ResourceRepository;
  let allocRepo: AllocationRepository;
  let calRepo: ResourceCalendarRepository;
  let engine: AllocationEngine;

  beforeEach(() => {
    resRepo = makeResourceRepo();
    allocRepo = makeAllocationRepo();
    calRepo = makeCalendarRepo();
    engine = new AllocationEngine({
      resourceRepository: resRepo,
      allocationRepository: allocRepo,
      calendarRepository: calRepo,
    });
  });

  describe("allocate", () => {
    it("allocates an available resource", async () => {
      const result = await engine.allocate({
        operationId: "op-1",
        tenantId: "tenant-1",
        resourceId: "res-1",
        startAt: now,
        endAt: end,
        allocatedBy: "user-1",
      });

      expect(result.allocation.status).toBe("active");
      expect(result.allocation.resourceId).toBe("res-1");
      expect(resRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: "allocated" }));
    });

    it("throws when resource not found", async () => {
      resRepo = makeResourceRepo(null);
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });
      await expect(
        engine.allocate({
          operationId: "op-1",
          tenantId: "tenant-1",
          resourceId: "missing",
          startAt: now,
          endAt: end,
          allocatedBy: "u",
        }),
      ).rejects.toThrow("not found");
    });

    it("throws when resource belongs to different tenant", async () => {
      resRepo = makeResourceRepo(makeResource({ tenantId: "other-tenant" }));
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });
      await expect(
        engine.allocate({
          operationId: "op-1",
          tenantId: "tenant-1",
          resourceId: "res-1",
          startAt: now,
          endAt: end,
          allocatedBy: "u",
        }),
      ).rejects.toThrow("tenant");
    });

    it("throws when resource is not available", async () => {
      allocRepo = makeAllocationRepo(null, [makeAllocation()]);
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });
      await expect(
        engine.allocate({
          operationId: "op-2",
          tenantId: "tenant-1",
          resourceId: "res-1",
          startAt: now,
          endAt: end,
          allocatedBy: "u",
        }),
      ).rejects.toThrow("not available");
    });
  });

  describe("deallocate", () => {
    it("deallocates an active allocation", async () => {
      allocRepo = makeAllocationRepo(makeAllocation(), [], []);
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });

      await engine.deallocate("alloc-1", "user-1");
      expect(allocRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
      expect(resRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: "available" }));
    });

    it("throws when allocation not found", async () => {
      await expect(engine.deallocate("missing", "user-1")).rejects.toThrow("not found");
    });

    it("throws when allocation is not active", async () => {
      allocRepo = makeAllocationRepo(makeAllocation({ status: "completed" }));
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });
      await expect(engine.deallocate("alloc-1", "user-1")).rejects.toThrow("Cannot deallocate");
    });

    it("keeps resource allocated if other active allocations remain", async () => {
      const otherActive = makeAllocation({ id: "alloc-2" });
      allocRepo = makeAllocationRepo(makeAllocation(), [], [otherActive]);
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });

      await engine.deallocate("alloc-1", "user-1");
      expect(resRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("findAvailableResources", () => {
    it("returns matched available resources", async () => {
      const query: ResourceQuery = {
        tenantId: "tenant-1",
        availableFrom: now,
        availableUntil: end,
        requiredCapabilities: ["heavy_lift"],
      };
      const results = await engine.findAvailableResources(query);
      expect(results.length).toBeGreaterThan(0);
    });

    it("uses branchId filter when provided", async () => {
      const query: ResourceQuery = {
        tenantId: "tenant-1",
        branchId: "branch-1",
        availableFrom: now,
        availableUntil: end,
      };
      await engine.findAvailableResources(query);
      expect(resRepo.findByBranch).toHaveBeenCalled();
    });
  });

  describe("findAndAllocate", () => {
    it("finds and allocates the best matching resource", async () => {
      const result = await engine.findAndAllocate({
        operationId: "op-1",
        query: { tenantId: "tenant-1", availableFrom: now, availableUntil: end },
        allocatedBy: "user-1",
      });
      expect(result).not.toBeNull();
      expect(result!.allocation.status).toBe("active");
    });

    it("returns null when no resources available", async () => {
      resRepo = makeResourceRepo(null);
      engine = new AllocationEngine({
        resourceRepository: resRepo,
        allocationRepository: allocRepo,
        calendarRepository: calRepo,
      });

      const result = await engine.findAndAllocate({
        operationId: "op-1",
        query: { tenantId: "tenant-1", availableFrom: now, availableUntil: end },
        allocatedBy: "user-1",
      });
      expect(result).toBeNull();
    });
  });

  describe("detectConflicts", () => {
    it("delegates to allocation repository", async () => {
      await engine.detectConflicts("res-1", now, end);
      expect(allocRepo.findConflicting).toHaveBeenCalledWith("res-1", now, end);
    });
  });
});
