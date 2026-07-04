import { createClient } from "@/lib/supabase/server";
import { validateDraftRequest, type DraftAction, type DraftEntityType } from "@shina/marketing-ai";
import type { MktRequestContext } from "@/lib/context";

// Server-side safety layer: every mutation destined to an ad platform is
// recorded as a pending draft plus an audit trail entry. Applying a draft
// happens only through approveDraft, called by an authenticated human.

export async function createDraft(
  ctx: MktRequestContext,
  input: {
    entityType: DraftEntityType;
    action: DraftAction;
    payload: Record<string, unknown>;
    entityId?: string;
    agentId?: string;
  },
): Promise<{ id: string } | { error: string; status: number }> {
  const validation = validateDraftRequest({
    entityType: input.entityType,
    action: input.action,
    payload: input.payload,
    requestedBy: ctx.userId,
    agentId: input.agentId,
  });
  if (!validation.ok) return { error: validation.reason, status: 422 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mkt_drafts")
    .insert({
      workspace_id: ctx.workspaceId,
      tenant_id: ctx.tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      payload: input.payload,
      requested_by: ctx.userId,
      agent_id: input.agentId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "failed to create draft", status: 500 };

  await audit(ctx, {
    action: `draft_${input.action}_requested`,
    entityType: input.entityType,
    entityId: data.id,
    payload: input.payload,
    agentId: input.agentId,
  });

  return { id: data.id };
}

export async function applyDraft(
  ctx: MktRequestContext,
  draftId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("mkt_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (!draft) return { error: "draft not found", status: 404 };
  if (draft.status !== "pending") return { error: "draft already reviewed", status: 409 };

  const payload = draft.payload as Record<string, unknown>;

  // Apply the action locally. Publishing to real ad platforms happens once
  // the workspace has a connected integration (platform credentials).
  if (draft.entity_type === "campaign" && draft.action === "create") {
    const { error } = await supabase.from("mkt_campaigns").insert({
      workspace_id: ctx.workspaceId,
      tenant_id: ctx.tenantId,
      brand_kit_id: (payload.brand_kit_id as string) ?? null,
      name: payload.name as string,
      platform: payload.platform as string,
      objective: (payload.objective as string) ?? null,
      budget_daily: (payload.budget_daily as number) ?? null,
      budget_total: (payload.budget_total as number) ?? null,
      start_date: (payload.start_date as string) ?? null,
      end_date: (payload.end_date as string) ?? null,
      targeting: (payload.targeting as Record<string, unknown>) ?? {},
      status: "approved",
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      created_by: draft.requested_by,
    });
    if (error) return { error: error.message, status: 500 };
  } else if (draft.entity_type === "campaign" && draft.action === "pause") {
    const { error } = await supabase
      .from("mkt_campaigns")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", draft.entity_id)
      .eq("workspace_id", ctx.workspaceId);
    if (error) return { error: error.message, status: 500 };
  } else if (draft.entity_type === "campaign" && draft.action === "budget_change") {
    const { error } = await supabase
      .from("mkt_campaigns")
      .update({
        budget_daily: (payload.new_budget as number) ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.entity_id)
      .eq("workspace_id", ctx.workspaceId);
    if (error) return { error: error.message, status: 500 };
  } else {
    return { error: `unsupported draft: ${draft.entity_type}/${draft.action}`, status: 422 };
  }

  await supabase
    .from("mkt_drafts")
    .update({
      status: "applied",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  await audit(ctx, {
    action: "draft_approved",
    entityType: draft.entity_type,
    entityId: draftId,
  });

  return { ok: true };
}

export async function rejectDraft(
  ctx: MktRequestContext,
  draftId: string,
  note?: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("mkt_drafts")
    .select("id, status, entity_type")
    .eq("id", draftId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (!draft) return { error: "draft not found", status: 404 };
  if (draft.status !== "pending") return { error: "draft already reviewed", status: 409 };

  await createClientUpdate(ctx, draftId, note);
  await audit(ctx, { action: "draft_rejected", entityType: draft.entity_type, entityId: draftId });
  return { ok: true };
}

async function createClientUpdate(ctx: MktRequestContext, draftId: string, note?: string) {
  const supabase = await createClient();
  await supabase
    .from("mkt_drafts")
    .update({
      status: "rejected",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", draftId);
}

async function audit(
  ctx: MktRequestContext,
  input: {
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Record<string, unknown>;
    agentId?: string;
  },
) {
  const supabase = await createClient();
  await supabase.from("mkt_audit_trail").insert({
    workspace_id: ctx.workspaceId,
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    agent_id: input.agentId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? null,
  });
}
