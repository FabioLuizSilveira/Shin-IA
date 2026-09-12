import type { SupabaseClient } from "@supabase/supabase-js";
import { runAiGateway, type OpenAiMessage } from "@shina/ai-gateway";
import { logActivity } from "@/lib/activity-log";
import { AI_AGENT_EVENTS } from "@/lib/ai/audit-events";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";
import { ensureDefaultAgentWorkspace } from "@/lib/ai/workspace";
import { getConversation, listMessages } from "@shina/messaging-platform";

// WAVE 4 — Shinã Agent + Voice: COPILOT mode (spec section 19). "Shinã
// sugere resposta -> Humano confirma": this NEVER sends anything and NEVER
// calls a domain/mutation tool — it is a single, tool-less text completion
// over the conversation transcript, reviewed by the human operator in the
// Inbox before they click Send (POST /api/messaging/conversations/[id]/reply
// is a separate, human-triggered action; this only fills the draft).
//
// Deliberately does NOT reuse the full multi-turn tool-calling loop
// (/api/ai/agent/route.ts) or buildAgentContext() — grounding a WhatsApp
// reply in live contract/asset data via tool chaining is real future work,
// but Wave 7's own documented tool-chaining reliability gap (gpt-4o-mini +
// 30+ tools) makes it the wrong foundation to stack a NEW channel on top of
// in this wave. buildAgentContext() also pulls in next/headers (MFA cookie
// lookup for authenticationLevel), which this tool-less flow doesn't need
// and which would make it untestable outside a live Next.js request — so
// this resolves only what it actually needs (the AI Gateway workspace id)
// directly, avoiding that coupling.
//
// The safety invariant (Capabilities(Agent) <= Capabilities(User), spec
// section 18) is satisfied by attributing the suggestion to the
// conversation's ASSIGNED operator for audit/credit purposes — never a
// synthesized "system" identity. An unassigned conversation has no clear
// acting user, so suggestion generation is skipped entirely rather than
// guessed.

const COPILOT_SYSTEM_PROMPT = `Você é a Shinã, ajudando um atendente humano a responder uma conversa de WhatsApp.

REGRAS OBRIGATÓRIAS:
- Você está SUGERINDO uma resposta — o atendente decide se envia, edita ou descarta. Você nunca envia nada.
- Nunca invente dados sobre contratos, cobranças, ativos ou qualquer informação que não esteja literalmente no histórico da conversa fornecido.
- Se a conversa não tiver contexto suficiente para uma resposta útil, sugira uma pergunta de esclarecimento em vez de inventar.
- Seja breve, educado e direto — tom adequado para WhatsApp, não um e-mail formal.
- Responda em português do Brasil.
- Retorne APENAS o texto da resposta sugerida, sem aspas, sem comentários, sem explicar o que você fez.`;

const MAX_HISTORY_MESSAGES = 12;

export interface CopilotSuggestion {
  suggested: boolean;
  text?: string;
  reason?: string;
  creditsConsumed?: number;
}

export async function generateCopilotSuggestion(
  db: SupabaseClient,
  input: { tenantId: string; conversationId: string; correlationId?: string },
): Promise<CopilotSuggestion> {
  const conversation = await getConversation(db, input.tenantId, input.conversationId);
  if (!conversation) return { suggested: false, reason: "conversation not found" };
  if (!conversation.assignedUserId) {
    return {
      suggested: false,
      reason: "conversation is unassigned — no acting operator to suggest as",
    };
  }

  const history = await listMessages(
    db,
    input.tenantId,
    input.conversationId,
    MAX_HISTORY_MESSAGES,
  );
  if (history.length === 0) return { suggested: false, reason: "no messages to respond to" };

  const transcript = history
    .map(
      (m) => `${m.direction === "inbound" ? "Contato" : "Atendente"}: ${m.body ?? `[${m.type}]`}`,
    )
    .join("\n");

  const messages: OpenAiMessage[] = [
    {
      role: "user",
      content: `Histórico da conversa:\n${transcript}\n\nSugira a próxima resposta do atendente.`,
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
    metadata: { requestId, source: "whatsapp_copilot" },
  });

  const result = await runAiGateway({
    db,
    adminDb: db,
    ctx: { workspaceId, tenantId: input.tenantId, userId: conversation.assignedUserId },
    operation: "messaging_copilot_suggestion",
    capability: "text",
    entityType: "messaging_conversation",
    system: COPILOT_SYSTEM_PROMPT,
    messages,
    credentialMode: "shina_only",
  });

  void logActivity(db, {
    tenantId: input.tenantId,
    actorId: conversation.assignedUserId,
    correlationId: input.correlationId,
    entityType: "messaging_conversation",
    entityId: input.conversationId,
    action: MESSAGING_AUDIT_EVENTS.AI_SUGGESTION_CREATED,
    metadata: { requestId, creditsConsumed: result.creditsConsumed },
  });

  return {
    suggested: true,
    text: result.text,
    creditsConsumed: result.creditsConsumed ?? undefined,
  };
}
