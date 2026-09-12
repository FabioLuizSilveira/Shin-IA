import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateStatus } from "./types.js";

// WAVE 2 — Message Templates (spec section 15). Meta remains the sole
// authority over approval — this module NEVER flips a template to
// `approved` on its own; that only happens once a real
// TEMPLATE_APPROVED/TEMPLATE_REJECTED signal comes back from the provider
// (a webhook field this package does not parse yet — Meta's template
// status-update webhook shape was not verified against current docs this
// session, so it is intentionally NOT implemented rather than guessed;
// same posture as connectAccount() being blocked). submitTemplateForApproval
// only flips the LOCAL status to "submitted" — it does not call Meta's
// template-creation endpoint yet (POST /{waba-id}/message_templates was
// not verified either).

export interface MessageTemplateRecord {
  id: string;
  tenantId: string | null;
  provider: string;
  providerTemplateId: string | null;
  name: string;
  language: string;
  category: string | null;
  version: number;
  status: TemplateStatus;
  components: unknown[];
  createdAt: string;
}

interface TemplateRow {
  id: string;
  tenant_id: string | null;
  provider: string;
  provider_template_id: string | null;
  name: string;
  language: string;
  category: string | null;
  version: number;
  status: TemplateStatus;
  components: unknown[];
  created_at: string;
}

function rowToTemplate(r: TemplateRow): MessageTemplateRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    provider: r.provider,
    providerTemplateId: r.provider_template_id,
    name: r.name,
    language: r.language,
    category: r.category,
    version: r.version,
    status: r.status,
    components: r.components,
    createdAt: r.created_at,
  };
}

export async function createTemplateDraft(
  db: SupabaseClient,
  input: {
    tenantId: string;
    name: string;
    language: string;
    category: string;
    components: unknown[];
  },
): Promise<MessageTemplateRecord> {
  const { data, error } = await db
    .from("message_templates")
    .insert({
      tenant_id: input.tenantId,
      provider: "whatsapp",
      name: input.name,
      language: input.language,
      category: input.category,
      components: input.components,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create template draft");
  return rowToTemplate(data as TemplateRow);
}

/** Flips the LOCAL status to "submitted" only — see module comment. Real
 *  Meta submission is a separate, not-yet-implemented step. */
export async function submitTemplateForApproval(
  db: SupabaseClient,
  input: { tenantId: string; templateId: string },
): Promise<MessageTemplateRecord> {
  const { data: current } = await db
    .from("message_templates")
    .select("status")
    .eq("id", input.templateId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!current) throw new Error("template not found");
  if (current.status !== "draft") {
    throw new Error(`cannot submit a template in status "${current.status}"`);
  }
  const { data, error } = await db
    .from("message_templates")
    .update({ status: "submitted" })
    .eq("id", input.templateId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to submit template");
  return rowToTemplate(data as TemplateRow);
}

/** Called ONLY from a verified provider webhook event — never from a
 *  tenant-facing route. `providerTemplateId` anchors the row to the real
 *  Meta template so future sends reference the approved version. */
export async function applyTemplateStatusFromProvider(
  db: SupabaseClient,
  input: {
    templateId: string;
    status: Extract<TemplateStatus, "approved" | "rejected" | "paused" | "disabled">;
    providerTemplateId?: string | null;
  },
): Promise<void> {
  await db
    .from("message_templates")
    .update({
      status: input.status,
      ...(input.providerTemplateId ? { provider_template_id: input.providerTemplateId } : {}),
    })
    .eq("id", input.templateId);
}

export async function listTemplates(
  db: SupabaseClient,
  tenantId: string,
): Promise<MessageTemplateRecord[]> {
  const { data, error } = await db
    .from("message_templates")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TemplateRow[] | null)?.map(rowToTemplate) ?? [];
}
