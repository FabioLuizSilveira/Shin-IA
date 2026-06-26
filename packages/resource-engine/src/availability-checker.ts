import type {
  Resource,
  AllocationRepository,
  ResourceCalendarRepository,
  AvailabilityWindow,
} from "./types.js";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface AvailabilityCheckerDeps {
  allocationRepository: AllocationRepository;
  calendarRepository: ResourceCalendarRepository;
}

export class AvailabilityChecker {
  private allocations: AllocationRepository;
  private calendar: ResourceCalendarRepository;

  constructor(deps: AvailabilityCheckerDeps) {
    this.allocations = deps.allocationRepository;
    this.calendar = deps.calendarRepository;
  }

  async checkAvailability(
    resource: Resource,
    startAt: string,
    endAt: string,
  ): Promise<AvailabilityWindow> {
    if (resource.status === "maintenance" || resource.status === "inactive") {
      return {
        resourceId: resource.id,
        startAt,
        endAt,
        available: false,
        conflictReason: `Resource is ${resource.status}`,
      };
    }

    const [conflictingAllocs, calendarConflicts] = await Promise.all([
      this.allocations.findConflicting(resource.id, startAt, endAt),
      this.calendar.findConflicting(resource.id, startAt, endAt),
    ]);

    const activeAllocs = conflictingAllocs.filter((a) => a.status === "active");

    if (activeAllocs.length > 0) {
      return {
        resourceId: resource.id,
        startAt,
        endAt,
        available: false,
        conflictReason: "Resource has an active allocation in this period",
        conflictingAllocationId: activeAllocs[0]!.id,
      };
    }

    if (calendarConflicts.length > 0) {
      return {
        resourceId: resource.id,
        startAt,
        endAt,
        available: false,
        conflictReason: `Calendar block: ${calendarConflicts[0]!.reason}`,
      };
    }

    return { resourceId: resource.id, startAt, endAt, available: true };
  }

  async checkMultiple(
    resources: Resource[],
    startAt: string,
    endAt: string,
  ): Promise<AvailabilityWindow[]> {
    return Promise.all(resources.map((r) => this.checkAvailability(r, startAt, endAt)));
  }

  // Pure date utility exposed for testing
  static overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return overlaps(aStart, aEnd, bStart, bEnd);
  }
}
