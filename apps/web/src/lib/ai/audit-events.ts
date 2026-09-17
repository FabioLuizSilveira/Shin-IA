// Agent/credit audit event names — logged via the existing logActivity()
// (apps/web/src/lib/activity-log.ts, tenant_activity_log.action is a free
// text column) rather than a new parallel audit table/mechanism.
export const AI_AGENT_EVENTS = {
  REQUEST: "AI_AGENT_REQUEST",
  RESPONSE: "AI_AGENT_RESPONSE",
  TOOL_REQUESTED: "AI_AGENT_TOOL_REQUESTED",
  TOOL_EXECUTED: "AI_AGENT_TOOL_EXECUTED",
  TOOL_DENIED: "AI_AGENT_TOOL_DENIED",
  TOOL_FAILED: "AI_AGENT_TOOL_FAILED",
  // Wave 2 — voice transcription (never the transcript text itself in
  // metadata, only duration/size; the transcript is logged once, for
  // real, as AI_AGENT_REQUEST when it's actually submitted to the agent).
  VOICE_TRANSCRIBED: "AI_VOICE_TRANSCRIBED",
  // Attachments (image/document) — never the extracted text/image bytes in
  // metadata, only count/type/size, same posture as VOICE_TRANSCRIBED.
  ATTACHMENT_PROCESSED: "AI_AGENT_ATTACHMENT_PROCESSED",
  // Agent Runtime Architecture v2, Wave 2 (spec section 51) — only fired
  // when AGENT_DYNAMIC_TOOL_ROUTING is on for the tenant. Metadata is the
  // classification result (domain/intent/confidence/method) and the
  // before/after tool counts — never the raw query text.
  INTENT_CLASSIFIED: "AI_AGENT_INTENT_CLASSIFIED",
  TOOLS_FILTERED: "AI_AGENT_TOOLS_FILTERED",
  // Wave 4 (spec sections 14-15, 40) — only fired when
  // agent.dynamic_tool_routing is on. Metadata is the resolved tier and
  // model name, so the pilot's real tier distribution can be audited
  // without re-deriving it from ai_gateway_usage rows.
  MODEL_ROUTED: "AI_AGENT_MODEL_ROUTED",
  // Agent Runtime v3, Wave 1 (spec section 45) — only fired when the
  // request carries a conversationId. Never logs the entity's own data,
  // only its type/relation — the agent_conversation_entities row itself
  // is the auditable record of which entity, this is just the resolver's
  // own decision trail.
  ENTITY_RESOLVED: "AGENT_ENTITY_RESOLVED",
  ENTITY_AMBIGUOUS: "AGENT_ENTITY_AMBIGUOUS",
} as const;

// Agent Runtime v3, Wave 2 (spec section 45) — goal/workflow lifecycle.
// Never logs slot VALUES (customer names, dates, ids) in metadata, only
// type/status/key names — the agent_goals row itself is the auditable
// record of the real state.
export const AI_GOAL_EVENTS = {
  CREATED: "AGENT_GOAL_CREATED",
  RESUMED: "AGENT_GOAL_RESUMED",
  UPDATED: "AGENT_GOAL_UPDATED",
  COMPLETED: "AGENT_GOAL_COMPLETED",
  CANCELLED: "AGENT_GOAL_CANCELLED",
  NEXT_ACTION_SELECTED: "AGENT_NEXT_ACTION_SELECTED",
} as const;

// Wave 6 — Guided Actions. PROPOSED fires from the tool loop (never a
// mutation), the rest from the confirm/cancel routes.
export const AI_ACTION_EVENTS = {
  PROPOSED: "AI_ACTION_PROPOSED",
  CONFIRMED: "AI_ACTION_CONFIRMED",
  EXECUTED: "AI_ACTION_EXECUTED",
  EXECUTION_FAILED: "AI_ACTION_EXECUTION_FAILED",
  CANCELLED: "AI_ACTION_CANCELLED",
  DENIED: "AI_ACTION_DENIED",
} as const;

export const AI_CREDIT_EVENTS = {
  RESERVED: "AI_CREDIT_RESERVED",
  USAGE: "AI_CREDIT_USAGE",
  SETTLED: "AI_CREDIT_SETTLED",
  DENIED: "AI_CREDIT_DENIED",
  PURCHASED: "AI_CREDIT_PURCHASED",
  GRANTED: "AI_CREDIT_GRANTED",
} as const;
