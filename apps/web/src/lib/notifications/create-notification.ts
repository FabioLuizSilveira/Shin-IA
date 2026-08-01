import { createAdminClient } from "@/lib/supabase/admin";

interface CreateNotificationInput {
  tenantId: string;
  subject: string;
  body: string;
  priority?: "low" | "normal" | "high" | "critical";
}

// Broadcasts to the whole tenant team, not a specific person — there's no
// reliable per-staff-member identity to target here (persons.auth_user_id
// is unpopulated by the real signup flow; only user_profiles is, and it has
// no notification-preference concept). recipient_external_ref is set to a
// stable per-tenant value (not the previous hardcoded "demo-user", which
// meant every tenant wrote to the same fake recipient) purely to satisfy
// the table's "person_id or recipient_external_ref" constraint.
export async function createNotification({
  tenantId,
  subject,
  body,
  priority = "normal",
}: CreateNotificationInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    recipient_external_ref: `tenant:${tenantId}`,
    channel: "in_app",
    priority,
    subject,
    body,
    status: "pending",
  });
  if (error) console.error("[create-notification]", error.message);
}
