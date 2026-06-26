import { createAdminClient } from "@/lib/supabase/admin";

interface CreateNotificationInput {
  tenantId: string;
  subject: string;
  body: string;
  priority?: "low" | "normal" | "high" | "critical";
}

export async function createNotification({
  tenantId,
  subject,
  body,
  priority = "normal",
}: CreateNotificationInput) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    recipient_external_ref: "demo-user",
    channel: "in_app",
    priority,
    subject,
    body,
    status: "pending",
  });
}
