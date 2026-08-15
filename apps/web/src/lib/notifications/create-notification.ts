import { createAdminClient } from "@/lib/supabase/admin";

interface CreateNotificationInput {
  tenantId: string;
  subject: string;
  body: string;
  priority?: "low" | "normal" | "high" | "critical";
  // Wave 3 Phase D — optional individual targeting, additive to the existing
  // tenant-broadcast default. Reuses the existing recipient_external_ref
  // free-text column (no schema migration needed) with a small "kind:id"
  // convention, read back by GET /api/mobile/notifications. The caller
  // always determines the recipient server-side (e.g. "this customer whose
  // document was just approved") — this function never accepts a raw
  // string recipient from a request body.
  recipient?: { customerId: string } | { operatorId: string };
}

// Defaults to broadcasting to the whole tenant team when no `recipient` is
// given — there's no reliable per-staff-member identity to target here
// (persons.auth_user_id is unpopulated by the real signup flow; only
// user_profiles is, and it has no notification-preference concept).
// recipient_external_ref is set to a stable per-tenant value (not the
// previous hardcoded "demo-user", which meant every tenant wrote to the
// same fake recipient) purely to satisfy the table's "person_id or
// recipient_external_ref" constraint.
export async function createNotification({
  tenantId,
  subject,
  body,
  priority = "normal",
  recipient,
}: CreateNotificationInput) {
  const recipientExternalRef = recipient
    ? "customerId" in recipient
      ? `customer:${recipient.customerId}`
      : `operator:${recipient.operatorId}`
    : `tenant:${tenantId}`;

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    recipient_external_ref: recipientExternalRef,
    channel: "in_app",
    priority,
    subject,
    body,
    status: "pending",
  });
  if (error) console.error("[create-notification]", error.message);
}
