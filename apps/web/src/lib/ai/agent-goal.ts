import type { SupabaseClient } from "@supabase/supabase-js";
import { runAiGateway, type OpenAiMessage } from "@shina/ai-gateway";
import { resolveModelForTier } from "./model-router";
import type { GoalType } from "./goal-resolver";

// Agent Runtime v3, Wave 2 — AgentGoal persistence (spec section 4) and
// slot extraction (spec sections 12-14). The table itself was created in
// Wave 1 with no logic driving it yet — this is the first real consumer.

export type GoalStatus =
  | "ACTIVE"
  | "WAITING_USER"
  | "WAITING_CONFIRMATION"
  | "EXECUTING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export interface AgentGoal {
  id: string;
  type: GoalType;
  domain: string;
  status: GoalStatus;
  state: Record<string, unknown>;
}

interface GoalRow {
  id: string;
  type: string;
  domain: string;
  status: string;
  state: Record<string, unknown>;
}

function fromRow(r: GoalRow): AgentGoal {
  return {
    id: r.id,
    type: r.type as GoalType,
    domain: r.domain,
    status: r.status as GoalStatus,
    state: r.state ?? {},
  };
}

/** The one goal a conversation can be actively working on right now
 * (spec section 27: interruptions/sub-questions don't destroy it, only
 * an explicit cancel/new-incompatible-goal does — this wave doesn't yet
 * implement goal switching prompts, just "resume the active one if it
 * matches, otherwise leave it alone"). ACTIVE/WAITING_USER/
 * WAITING_CONFIRMATION are all "still in progress" states. */
export async function getActiveGoal(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
): Promise<AgentGoal | null> {
  const { data } = await db
    .from("agent_goals")
    .select("id, type, domain, status, state")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .in("status", ["ACTIVE", "WAITING_USER", "WAITING_CONFIRMATION"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? fromRow(data as GoalRow) : null;
}

export async function createGoal(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  conversationId: string,
  type: GoalType,
  domain: string,
): Promise<AgentGoal> {
  const { data, error } = await db
    .from("agent_goals")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      conversation_id: conversationId,
      type,
      domain,
      status: "ACTIVE",
    })
    .select("id, type, domain, status, state")
    .single();
  if (error || !data) throw new Error(`createGoal: failed to insert: ${error?.message}`);
  return fromRow(data as GoalRow);
}

/** Merges `patch` into the goal's existing state — additively, never
 * dropping a previously-known field just because this turn's extraction
 * didn't mention it again (spec section 14: "never ask twice" applied
 * to workflow slots, not just entities). */
export async function updateGoalState(
  db: SupabaseClient,
  tenantId: string,
  goalId: string,
  currentState: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const merged = { ...currentState };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") continue;
    merged[key] = value;
  }
  await db
    .from("agent_goals")
    .update({ state: merged, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("tenant_id", tenantId);
  return merged;
}

export async function setGoalStatus(
  db: SupabaseClient,
  tenantId: string,
  goalId: string,
  status: GoalStatus,
): Promise<void> {
  await db
    .from("agent_goals")
    .update({
      status,
      updated_at: new Date().toISOString(),
      completed_at: status === "COMPLETED" ? new Date().toISOString() : null,
    })
    .eq("id", goalId)
    .eq("tenant_id", tenantId);
}

const EXTRACTION_PROMPTS: Record<GoalType, string> = {
  CREATE_TRANSPORT_REQUEST: `Extraia dados de uma solicitação de transporte de passageiros (ônibus/van) a partir da mensagem do usuário.
Campos possíveis: "passengerCount" (número), "scheduledStartsAt" (ISO 8601, data/hora de partida), "scheduledEndsAt" (ISO 8601, data/hora de retorno/término).`,
  CREATE_TOWING_REQUEST: `Extraia dados de uma solicitação de guincho a partir da mensagem do usuário.
Campos possíveis: "scheduledStartsAt" (ISO 8601, data/hora do atendimento), "scheduledEndsAt" (ISO 8601, data/hora estimada de término — se não disponível, estime 2 horas após o início), "origin" (string, local de origem), "destination" (string, destino).`,
};

// Extraction never invents a tenant-configurable timezone (no such
// concept exists in this schema today, confirmed by grep before writing
// this) — America/Sao_Paulo is this product's real, single-market
// default (pt-BR, BRL) everywhere else, not a new assumption invented
// here. A real per-tenant timezone is future work, not this wave's scope.
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

interface RawExtraction {
  passengerCount?: unknown;
  scheduledStartsAt?: unknown;
  scheduledEndsAt?: unknown;
  origin?: unknown;
  destination?: unknown;
}

function parseExtraction(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const raw = parsed as RawExtraction;
    const out: Record<string, unknown> = {};
    if (typeof raw.passengerCount === "number") out.passengerCount = raw.passengerCount;
    if (typeof raw.scheduledStartsAt === "string") out.scheduledStartsAt = raw.scheduledStartsAt;
    if (typeof raw.scheduledEndsAt === "string") out.scheduledEndsAt = raw.scheduledEndsAt;
    if (typeof raw.origin === "string") out.origin = raw.origin;
    if (typeof raw.destination === "string") out.destination = raw.destination;
    return out;
  } catch {
    return null;
  }
}

/** Cheap structured-JSON extraction (FAST tier, same shape as
 * intent-router.ts's tier-2 classifier and operation-request-
 * extraction.ts's WhatsApp equivalent) — pulls whatever slot VALUES the
 * current message states explicitly. Never guesses a value that wasn't
 * said (spec section 22: ambiguous dates must be confirmed, not
 * assumed) — an absent/unparseable field is simply omitted, letting
 * updateGoalState's merge leave the previously-known value (if any)
 * untouched. */
export async function extractGoalSlots(
  db: SupabaseClient,
  ctx: { workspaceId: string; tenantId: string; userId: string },
  goalType: GoalType,
  text: string,
  // Agent Runtime v3, Wave 2 — live-verified real bug: without this, a
  // follow-up message like "até as 12h" (no date, just a time) got
  // extracted as TODAY's date instead of the SAME DAY as the
  // already-known scheduledStartsAt (tomorrow) — producing an end
  // datetime a full day BEFORE the start, which validate() would have
  // rejected. Passing the known state gives the extraction the context
  // a relative time-only phrase needs to resolve onto the right day.
  knownState: Record<string, unknown> = {},
): Promise<{ slots: Record<string, unknown>; creditsConsumed?: number }> {
  const now = new Date();
  const knownContext =
    Object.keys(knownState).length > 0
      ? `\nDados já conhecidos deste mesmo pedido: ${JSON.stringify(knownState)}. Se a mensagem só disser um horário ("até as 12h") sem data, e já houver uma data de início conhecida, use a MESMA data do início (a menos que a mensagem diga explicitamente outro dia).`
      : "";
  const system = `${EXTRACTION_PROMPTS[goalType]}

Hoje é ${now.toISOString()} (fuso horário ${DEFAULT_TIMEZONE}). Interprete referências relativas ("amanhã", "sexta", "às 9") usando essa data/fuso.${knownContext}
Responda APENAS com um objeto JSON válido contendo só os campos que a mensagem realmente informa — omita qualquer campo não mencionado, nunca invente um valor.`;

  const messages: OpenAiMessage[] = [{ role: "user", content: text }];
  try {
    const result = await runAiGateway({
      db,
      adminDb: db,
      ctx,
      operation: "agent_goal_slot_extraction",
      capability: "text",
      entityType: "ai_agent",
      system,
      messages,
      credentialMode: "shina_only",
      model: resolveModelForTier("FAST"),
      maxTokens: 200,
    });
    const slots = parseExtraction(result.text) ?? {};
    return { slots, creditsConsumed: result.creditsConsumed ?? undefined };
  } catch {
    // Same fail-closed posture as every other classifier in this
    // codebase — a broken extraction call must never block the turn,
    // it just means this message contributed no new slot values.
    return { slots: {} };
  }
}
