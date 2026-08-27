import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveDeadline,
  deadlineStatusFor,
  type InfractionDeadlineType,
} from "@shina/infractions-engine";
import { createNotification } from "@/lib/notifications/create-notification";
import { logActivity } from "@/lib/activity-log";

// Item 16/17 of the spec — one infraction can carry several deadlines
// (driver identification, defense, discount, due date). Each is only
// created when the provider/document actually supplied a date — never
// invented (resolveDeadline() already enforces that; this just maps the
// four date fields already on `infractions` onto real deadline rows).
const DEADLINE_FIELDS: { column: string; type: InfractionDeadlineType }[] = [
  { column: "driver_identification_deadline", type: "driver_identification" },
  { column: "defense_deadline", type: "defense" },
  { column: "discount_deadline", type: "discount" },
  { column: "payment_deadline", type: "due" },
];

export async function createDeadlinesForCase(
  db: SupabaseClient,
  tenantId: string,
  caseId: string,
  infraction: Record<string, string | null>,
): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (const field of DEADLINE_FIELDS) {
    const rawDate = infraction[field.column];
    if (!rawDate) continue;
    const resolved = resolveDeadline({
      deadlineType: field.type,
      dueAt: new Date(rawDate).toISOString(),
    });
    if (!resolved) continue;
    rows.push({
      tenant_id: tenantId,
      case_id: caseId,
      deadline_type: field.type,
      due_at: resolved.dueAt,
      status: "open",
      source: resolved.source,
      rule_version: resolved.ruleVersion,
      base_date: resolved.baseDate,
    });
  }
  if (rows.length === 0) return 0;
  const { error } = await db.from("infraction_deadlines").insert(rows);
  if (error) throw error;
  return rows.length;
}

// Default alert windows (item 18 — "avalie defaults seguros: 7/3/1 dias")
// until a tenant can configure their own antecedência.
const DUE_SOON_WINDOW_DAYS = 7;
const ALERT_THRESHOLDS_DAYS = [7, 3, 1];

// The daily sweep (Fase E's cron): recomputes every open deadline's
// status against "now", and fires exactly one notification per threshold
// crossing (never re-notifies for a threshold already alerted — tracked
// via deadline.notes, appended as a small marker log rather than a new
// table, since this is the only place that needs it).
export async function sweepInfractionDeadlines(db: SupabaseClient): Promise<{
  checked: number;
  dueSoon: number;
  overdue: number;
  notified: number;
}> {
  const now = new Date();
  const { data: deadlines, error } = await db
    .from("infraction_deadlines")
    .select("id, tenant_id, case_id, deadline_type, due_at, status, alerted_thresholds")
    .in("status", ["open", "due_soon"]);
  if (error) throw error;

  let dueSoonCount = 0;
  let overdueCount = 0;
  let notified = 0;

  for (const deadline of deadlines ?? []) {
    const nextStatus = deadlineStatusFor(deadline.due_at, now, DUE_SOON_WINDOW_DAYS);
    if (nextStatus === "due_soon") dueSoonCount += 1;
    if (nextStatus === "overdue") overdueCount += 1;

    const alertedThresholds: number[] = Array.isArray(deadline.alerted_thresholds)
      ? (deadline.alerted_thresholds as number[])
      : [];

    const daysRemaining = Math.ceil(
      (new Date(deadline.due_at).getTime() - now.getTime()) / 86400000,
    );
    const crossedThreshold = ALERT_THRESHOLDS_DAYS.find(
      (t) => daysRemaining <= t && !alertedThresholds.includes(t),
    );
    const justWentOverdue = nextStatus === "overdue" && deadline.status !== "overdue";

    if (nextStatus !== deadline.status) {
      await db
        .from("infraction_deadlines")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", deadline.id);
    }

    if ((crossedThreshold !== undefined || justWentOverdue) && deadline.tenant_id) {
      const subject = justWentOverdue
        ? "Prazo de infração vencido"
        : "Prazo de infração se aproximando";
      const body = justWentOverdue
        ? `Um prazo (${deadline.deadline_type}) venceu sem ação.`
        : `Um prazo (${deadline.deadline_type}) vence em até ${crossedThreshold} dia(s).`;
      void createNotification({
        tenantId: deadline.tenant_id,
        subject,
        body,
        priority: justWentOverdue ? "high" : "normal",
      });
      void logActivity(db, {
        tenantId: deadline.tenant_id,
        actorId: "00000000-0000-0000-0000-000000000000",
        entityType: "infraction_deadline",
        entityId: deadline.id,
        action: justWentOverdue ? "deadline_overdue" : "deadline_due_soon",
        metadata: { deadlineType: deadline.deadline_type, daysRemaining },
      });
      notified += 1;
      if (crossedThreshold !== undefined) {
        await db
          .from("infraction_deadlines")
          .update({ alerted_thresholds: [...alertedThresholds, crossedThreshold] })
          .eq("id", deadline.id);
      }
    }
  }

  return {
    checked: deadlines?.length ?? 0,
    dueSoon: dueSoonCount,
    overdue: overdueCount,
    notified,
  };
}
