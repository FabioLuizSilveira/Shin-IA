import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Sentinel used elsewhere in this codebase for a system/no-real-actor
// created_by (infraction-deadlines.ts's cron sweep uses the same value) --
// crm_leads.created_by is not-null and a public form submission has no
// real platform staff user behind it.
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

const RATE_LIMIT = { maxRequests: 5, windowMs: 10 * 60 * 1000 }; // 5 per 10min per IP

interface ContactBody {
  name?: string;
  email?: string;
  company?: string;
  message?: string;
}

// POST /api/contact — public, no auth (listed in middleware.ts's
// APP_PUBLIC_PATHS; also unconditionally reachable via the root/marketing
// domain regardless of that list, same as every other /api route hit from
// shinaia.com.br). Backs the "Fale com nossa equipe" form on the public
// site: every real submission becomes a real crm_leads row (source
// "website") instead of the form's previous fake setTimeout that never
// sent anything anywhere. The submitted message becomes the lead's first
// activity, so the salesperson who picks it up sees exactly what the
// visitor wrote, not just contact info with no context.
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = checkRateLimit(
    `contact:${clientIp(req)}`,
    RATE_LIMIT.maxRequests,
    RATE_LIMIT.windowMs,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => null)) as ContactBody | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim();
  const message = body?.message?.trim();
  const company = body?.company?.trim();
  if (!name || !email || !message) {
    return NextResponse.json({ error: "name, email and message are required" }, { status: 400 });
  }
  // Cheap sanity check, not full RFC 5322 validation -- good enough to
  // reject obvious junk without rejecting a real address the browser's own
  // type="email" already nudged toward being valid.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Same lead re-submitting the form (a common real pattern: filled it,
  // didn't hear back, filled it again) adds to the existing lead's
  // activity trail instead of creating a duplicate -- only while it's
  // still in the "new" stage nobody has acted on yet; once a salesperson
  // has moved it forward, a new submission from the same email starts a
  // fresh lead rather than silently reopening a deal in progress.
  const { data: existing } = await admin
    .from("crm_leads")
    .select("id")
    .eq("contact_email", email)
    .eq("status", "new")
    .eq("source", "website")
    .is("deleted_at", null)
    .maybeSingle();

  const leadId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    const { error: insertError } = await admin.from("crm_leads").insert({
      id: leadId,
      company_name: company || name,
      contact_name: name,
      contact_email: email,
      source: "website",
      status: "new",
      created_by: SYSTEM_ACTOR_ID,
    });
    if (insertError) return internalError(insertError);

    await admin.from("crm_lead_activities").insert({
      id: crypto.randomUUID(),
      lead_id: leadId,
      type: "status_change",
      description: "Lead criado a partir do formulário de contato do site.",
      from_status: null,
      to_status: "new",
      created_by: SYSTEM_ACTOR_ID,
    });
  }

  await admin.from("crm_lead_activities").insert({
    id: crypto.randomUUID(),
    lead_id: leadId,
    type: "note",
    description: message,
    created_by: SYSTEM_ACTOR_ID,
  });

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
