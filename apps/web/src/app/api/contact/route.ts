import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";
import { appUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

// Sentinel used elsewhere in this codebase for a system/no-real-actor
// created_by (infraction-deadlines.ts's cron sweep uses the same value) --
// crm_leads.created_by is not-null and a public form submission has no
// real platform staff user behind it.
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

const RATE_LIMIT = { maxRequests: 5, windowMs: 10 * 60 * 1000 }; // 5 per 10min per IP

// Configurable so this doesn't need a code change if the inbox changes --
// falls back to the address already shown on the contact page itself.
const SALES_NOTIFICATION_EMAIL = process.env.SALES_NOTIFICATION_EMAIL ?? "diego@shinaia.com.br";

interface ContactBody {
  name?: string;
  email?: string;
  company?: string;
  message?: string;
  phone?: string;
  profile?: "locador" | "locatario";
  fleet_size?: number;
  source?: string;
}

const PROFILE_LABEL: Record<string, string> = {
  locador: "Locador (tem frota)",
  locatario: "Locatário (quer alugar)",
};

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
  const phone = body?.phone?.trim();
  const profile = body?.profile;
  const fleetSize = body?.fleet_size;
  // message is required for the "Fale com nossa equipe" form (a free-text
  // question needs a question); the "Agendar Demo" modal has no message
  // field at all, phone stands in for it there — one of the two is always
  // required so every lead has *something* beyond bare contact info.
  if (!name || !email || (!message && !phone)) {
    return NextResponse.json(
      { error: "name, email and (message or phone) are required" },
      { status: 400 },
    );
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
      contact_phone: phone || null,
      estimated_fleet_size: profile === "locador" ? (fleetSize ?? null) : null,
      segment: profile ? (PROFILE_LABEL[profile] ?? profile) : null,
      source: "website",
      status: "new",
      created_by: SYSTEM_ACTOR_ID,
    });
    if (insertError) return internalError(insertError);

    await admin.from("crm_lead_activities").insert({
      id: crypto.randomUUID(),
      lead_id: leadId,
      type: "status_change",
      description: message
        ? "Lead criado a partir do formulário de contato do site."
        : "Lead criado a partir do formulário de agendamento de demo do site.",
      from_status: null,
      to_status: "new",
      created_by: SYSTEM_ACTOR_ID,
    });

    // Fire-and-forget -- a stuck/failed email must never delay or fail the
    // visitor's own submission. Only on a genuinely new lead (item above),
    // never on a re-submission appended to one already sitting in the CRM,
    // so sales doesn't get a second email for the same person retrying.
    void sendEmail(SALES_NOTIFICATION_EMAIL, "new_lead", {
      company_name: company || name,
      contact_name: name,
      contact_email: email,
      message: message || `Pedido de demonstração. Telefone: ${phone ?? "não informado"}.`,
      lead_url: appUrl(`/platform/crm`),
    });
  }

  const noteParts = [
    message,
    phone && `Telefone: ${phone}`,
    profile && `Perfil: ${PROFILE_LABEL[profile] ?? profile}`,
    profile === "locador" && fleetSize && `Frota estimada: até ${fleetSize} carros`,
  ].filter(Boolean);

  await admin.from("crm_lead_activities").insert({
    id: crypto.randomUUID(),
    lead_id: leadId,
    type: "note",
    description: noteParts.join(" — "),
    created_by: SYSTEM_ACTOR_ID,
  });

  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
