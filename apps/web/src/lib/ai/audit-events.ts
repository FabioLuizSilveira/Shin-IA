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
} as const;

export const AI_CREDIT_EVENTS = {
  RESERVED: "AI_CREDIT_RESERVED",
  USAGE: "AI_CREDIT_USAGE",
  SETTLED: "AI_CREDIT_SETTLED",
  DENIED: "AI_CREDIT_DENIED",
  PURCHASED: "AI_CREDIT_PURCHASED",
  GRANTED: "AI_CREDIT_GRANTED",
} as const;
