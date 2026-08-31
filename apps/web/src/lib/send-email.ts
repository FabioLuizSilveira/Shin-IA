// Thin wrapper around the real supabase/functions/send-email Edge Function
// -- same fetch shape packages/notification-engine's SupabaseEmailDispatcher
// already uses, duplicated here rather than adding a workspace dependency
// on that package for one call site (it carries a whole channel-registry
// abstraction apps/web doesn't otherwise use). Never throws: a failed
// email must never break the caller's own request (a visitor submitting
// the contact form doesn't care whether the internal notification email
// succeeded).
export async function sendEmail(
  to: string,
  template: "welcome" | "invite" | "operation_alert" | "invoice_due" | "new_lead",
  data: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, template, data }),
    });
    if (!res.ok) {
      console.error("[send-email] edge function returned", res.status, await res.text());
    }
  } catch (err) {
    console.error("[send-email] failed to invoke edge function:", err);
  }
}
