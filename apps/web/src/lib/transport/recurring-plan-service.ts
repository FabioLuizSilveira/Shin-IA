import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 3 — Multi-Operation Business Architecture v2: Operation Runtime.
// Corporate/recurring fretamento (spec section 16): TransportContract ->
// RecurringServicePlan -> Route -> Schedule -> Trip Instances. Trip
// instances are GENERATED for a bounded horizon (generateTripInstances is
// pure — no DB access), never pre-created for the plan's whole lifetime —
// avoids exploding the operations table with rows nobody asked for yet
// (spec: "Evitar explosão de registros sem necessidade").

export interface ScheduleEntry {
  /** 0 = Sunday, matching JS Date#getDay(). */
  dayOfWeek: number;
  departureTime: string; // "HH:MM"
  estimatedArrivalTime?: string; // "HH:MM"
}

export interface RecurringServicePlanInput {
  tenantId: string;
  operationProfileId?: string | null;
  routeId?: string | null;
  customerOrganizationId?: string | null;
  schedule: ScheduleEntry[];
  startsOn: string; // "YYYY-MM-DD"
  endsOn?: string | null;
}

export type RecurringServicePlanStatus = "active" | "paused" | "ended";

export interface RecurringServicePlan {
  id: string;
  tenantId: string;
  operationProfileId: string | null;
  routeId: string | null;
  customerOrganizationId: string | null;
  schedule: ScheduleEntry[];
  startsOn: string;
  endsOn: string | null;
  status: RecurringServicePlanStatus;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  tenant_id: string;
  operation_profile_id: string | null;
  route_id: string | null;
  customer_organization_id: string | null;
  schedule: ScheduleEntry[];
  starts_on: string;
  ends_on: string | null;
  status: RecurringServicePlanStatus;
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): RecurringServicePlan {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    operationProfileId: r.operation_profile_id,
    routeId: r.route_id,
    customerOrganizationId: r.customer_organization_id,
    schedule: r.schedule ?? [],
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function createRecurringServicePlan(
  db: SupabaseClient,
  input: RecurringServicePlanInput,
): Promise<RecurringServicePlan> {
  const { data, error } = await db
    .from("recurring_service_plans")
    .insert({
      tenant_id: input.tenantId,
      operation_profile_id: input.operationProfileId ?? null,
      route_id: input.routeId ?? null,
      customer_organization_id: input.customerOrganizationId ?? null,
      schedule: input.schedule,
      starts_on: input.startsOn,
      ends_on: input.endsOn ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create recurring service plan");
  return fromRow(data as Row);
}

export async function setRecurringServicePlanStatus(
  db: SupabaseClient,
  tenantId: string,
  planId: string,
  status: RecurringServicePlanStatus,
): Promise<RecurringServicePlan> {
  const { data, error } = await db
    .from("recurring_service_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to update recurring service plan status");
  return fromRow(data as Row);
}

export interface GeneratedTripInstance {
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduleEntry: ScheduleEntry;
}

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Pure — no DB access. Expands a RecurringServicePlan's weekly schedule into
 * concrete trip time windows within [from, from + horizonDays), clipped to
 * the plan's own [startsOn, endsOn] range and to `status === "active"`.
 * When a schedule entry has no estimatedArrivalTime, a 60-minute default
 * duration is used (operations.scheduled_starts_at < scheduled_ends_at is a
 * hard DB constraint — a trip instance can never have a zero-length window).
 */
export function generateTripInstances(
  plan: RecurringServicePlan,
  options: { from: Date; horizonDays: number },
): GeneratedTripInstance[] {
  if (plan.status !== "active") return [];
  if (options.horizonDays <= 0) return [];

  const startsOn = new Date(plan.startsOn + "T00:00:00");
  const endsOn = plan.endsOn ? new Date(plan.endsOn + "T23:59:59") : null;
  const instances: GeneratedTripInstance[] = [];

  for (let dayOffset = 0; dayOffset < options.horizonDays; dayOffset++) {
    const day = new Date(options.from);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    if (day < startsOn) continue;
    if (endsOn && day > endsOn) continue;

    const dayOfWeek = day.getDay();
    for (const entry of plan.schedule) {
      if (entry.dayOfWeek !== dayOfWeek) continue;
      const departure = parseTimeOnDate(day, entry.departureTime);
      const arrival = entry.estimatedArrivalTime
        ? parseTimeOnDate(day, entry.estimatedArrivalTime)
        : new Date(departure.getTime() + 60 * 60 * 1000);
      instances.push({
        scheduledStartsAt: departure.toISOString(),
        scheduledEndsAt: (arrival > departure
          ? arrival
          : new Date(departure.getTime() + 60 * 60 * 1000)
        ).toISOString(),
        scheduleEntry: entry,
      });
    }
  }

  return instances;
}
