import type { SupabaseClient } from "@supabase/supabase-js";
import { runAiGateway, type OpenAiMessage } from "@shina/ai-gateway";
import { logActivity } from "@/lib/activity-log";
import { AI_AGENT_EVENTS } from "@/lib/ai/audit-events";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";
import { ensureDefaultAgentWorkspace } from "@/lib/ai/workspace";
import { getConversation, listMessages } from "@shina/messaging-platform";

// WAVE 5 — Multi-Operation Business Architecture v2: "WhatsApp transport
// request" / "Towing request" (spec sections 24 and 8-9's shared kernel) —
// extended to water_tank_request once water-tank-truck got its own
// dispatch runtime (same shared kernel, same on-demand shape as towing).
// Structured, JSON-only extraction from a conversation's inbound messages —
// deliberately NOT a tool-calling agent loop: it never books a Trip, never
// creates a service request, never sends anything. It only classifies
// intent and pulls out fields, flagging anything it couldn't determine
// confidently. "Dados ambíguos devem ser confirmados... nunca assumir
// silenciosamente" (section 24) is enforced structurally: every field the
// model isn't confident about goes in `ambiguousFields`, and
// `needsConfirmation` is true whenever that list is non-empty or the
// intent itself is unclear. A human always reviews before anything is
// booked — this produces a draft for the Inbox, exactly like
// messaging-copilot.ts's reply suggestion.
//
// Same safety invariant as messaging-copilot.ts (Capabilities(Agent) <=
// Capabilities(User)): attributed to the conversation's ASSIGNED operator,
// never a synthesized "system" identity — skipped entirely when
// unassigned, same as the reply Copilot.

const EXTRACTION_SYSTEM_PROMPT = `Você é a Shinã, extraindo dados estruturados de uma conversa de WhatsApp para ajudar um atendente humano.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com um objeto JSON válido, sem markdown, sem comentários, sem texto antes ou depois.
- Classifique "intent" como exatamente um destes valores: "passenger_transport_request", "towing_request", "water_tank_request", "unclear".
- NUNCA invente um valor que não esteja explícito na conversa. Se um campo não estiver claro, OMITA-o do objeto de campos e liste sua chave em "ambiguousFields".
- Se a conversa não tiver contexto suficiente para determinar a intenção, use intent="unclear" e explique em "ambiguousFields".
- Nunca assuma data, cidade, horário ou quantidade que não tenha sido dita explicitamente.

Formato de saída exato:
{
  "intent": "passenger_transport_request" | "towing_request" | "water_tank_request" | "unclear",
  "transportFields": { "origin"?: string, "destination"?: string, "date"?: string, "departureTime"?: string, "returnTime"?: string, "passengerCount"?: number },
  "towingFields": { "customerHint"?: string, "vehicleDescription"?: string, "location"?: string },
  "waterTankFields": { "deliveryLocation"?: string, "litersRequested"?: number, "customerHint"?: string },
  "ambiguousFields": string[]
}
Omita "transportFields" se intent não for passenger_transport_request; omita "towingFields" se intent não for towing_request; omita "waterTankFields" se intent não for water_tank_request.`;

const MAX_HISTORY_MESSAGES = 12;

export interface TransportRequestFields {
  origin?: string;
  destination?: string;
  date?: string;
  departureTime?: string;
  returnTime?: string;
  passengerCount?: number;
}

export interface TowingRequestFields {
  customerHint?: string;
  vehicleDescription?: string;
  location?: string;
}

export interface WaterTankRequestFields {
  deliveryLocation?: string;
  litersRequested?: number;
  customerHint?: string;
}

export type ExtractedOperationIntent =
  | "passenger_transport_request"
  | "towing_request"
  | "water_tank_request"
  | "unclear";

export interface OperationRequestExtraction {
  extracted: boolean;
  reason?: string;
  intent?: ExtractedOperationIntent;
  transportFields?: TransportRequestFields;
  towingFields?: TowingRequestFields;
  waterTankFields?: WaterTankRequestFields;
  ambiguousFields: string[];
  needsConfirmation: boolean;
  creditsConsumed?: number;
}

interface RawExtraction {
  intent?: unknown;
  transportFields?: unknown;
  towingFields?: unknown;
  waterTankFields?: unknown;
  ambiguousFields?: unknown;
}

function parseModelOutput(text: string): OperationRequestExtraction | null {
  let raw: RawExtraction;
  try {
    // Models occasionally wrap JSON in a fenced code block despite the
    // instruction not to — strip it defensively rather than failing closed
    // on a purely cosmetic deviation.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    raw = JSON.parse(cleaned) as RawExtraction;
  } catch {
    return null;
  }

  const validIntents: ExtractedOperationIntent[] = [
    "passenger_transport_request",
    "towing_request",
    "water_tank_request",
    "unclear",
  ];
  const intent = validIntents.includes(raw.intent as ExtractedOperationIntent)
    ? (raw.intent as ExtractedOperationIntent)
    : "unclear";

  const ambiguousFields = Array.isArray(raw.ambiguousFields)
    ? raw.ambiguousFields.filter((f): f is string => typeof f === "string")
    : [];

  const result: OperationRequestExtraction = {
    extracted: true,
    intent,
    ambiguousFields,
    needsConfirmation: intent === "unclear" || ambiguousFields.length > 0,
  };
  if (intent === "passenger_transport_request" && typeof raw.transportFields === "object") {
    result.transportFields = raw.transportFields as TransportRequestFields;
  }
  if (intent === "towing_request" && typeof raw.towingFields === "object") {
    result.towingFields = raw.towingFields as TowingRequestFields;
  }
  if (intent === "water_tank_request" && typeof raw.waterTankFields === "object") {
    result.waterTankFields = raw.waterTankFields as WaterTankRequestFields;
  }
  return result;
}

export async function extractOperationRequest(
  db: SupabaseClient,
  input: { tenantId: string; conversationId: string; correlationId?: string },
): Promise<OperationRequestExtraction> {
  const conversation = await getConversation(db, input.tenantId, input.conversationId);
  if (!conversation)
    return {
      extracted: false,
      reason: "conversation not found",
      ambiguousFields: [],
      needsConfirmation: false,
    };
  if (!conversation.assignedUserId) {
    return {
      extracted: false,
      reason: "conversation is unassigned — no acting operator to extract as",
      ambiguousFields: [],
      needsConfirmation: false,
    };
  }

  const history = await listMessages(
    db,
    input.tenantId,
    input.conversationId,
    MAX_HISTORY_MESSAGES,
  );
  if (history.length === 0) {
    return {
      extracted: false,
      reason: "no messages to extract from",
      ambiguousFields: [],
      needsConfirmation: false,
    };
  }

  const transcript = history
    .map(
      (m) => `${m.direction === "inbound" ? "Contato" : "Atendente"}: ${m.body ?? `[${m.type}]`}`,
    )
    .join("\n");

  const messages: OpenAiMessage[] = [
    {
      role: "user",
      content: `Histórico da conversa:\n${transcript}\n\nExtraia os dados estruturados.`,
    },
  ];

  const workspaceId = await ensureDefaultAgentWorkspace(db, input.tenantId);
  const requestId = crypto.randomUUID();

  void logActivity(db, {
    tenantId: input.tenantId,
    actorId: conversation.assignedUserId,
    correlationId: input.correlationId,
    entityType: "messaging_conversation",
    entityId: input.conversationId,
    action: AI_AGENT_EVENTS.REQUEST,
    metadata: { requestId, source: "operation_request_extraction" },
  });

  const result = await runAiGateway({
    db,
    adminDb: db,
    ctx: { workspaceId, tenantId: input.tenantId, userId: conversation.assignedUserId },
    operation: "operation_request_extraction",
    capability: "text",
    entityType: "messaging_conversation",
    system: EXTRACTION_SYSTEM_PROMPT,
    messages,
    credentialMode: "shina_only",
  });

  const parsed = parseModelOutput(result.text);
  if (!parsed) {
    return {
      extracted: false,
      reason: "model did not return valid JSON",
      ambiguousFields: [],
      needsConfirmation: true,
      creditsConsumed: result.creditsConsumed ?? undefined,
    };
  }
  parsed.creditsConsumed = result.creditsConsumed ?? undefined;

  void logActivity(db, {
    tenantId: input.tenantId,
    actorId: conversation.assignedUserId,
    correlationId: input.correlationId,
    entityType: "messaging_conversation",
    entityId: input.conversationId,
    action: MESSAGING_AUDIT_EVENTS.OPERATION_REQUEST_EXTRACTED,
    metadata: {
      requestId,
      intent: parsed.intent,
      ambiguousFields: parsed.ambiguousFields,
      needsConfirmation: parsed.needsConfirmation,
      creditsConsumed: result.creditsConsumed,
    },
  });

  return parsed;
}
