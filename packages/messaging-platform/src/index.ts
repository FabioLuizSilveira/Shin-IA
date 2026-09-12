export * from "./types.js";
export { createMessagingProvider } from "./create-provider.js";
export { FakeMessagingProvider } from "./providers/fake.js";
export {
  MetaWhatsAppProvider,
  MetaWhatsAppBlockedError,
  type MetaWhatsAppConfig,
} from "./providers/meta-whatsapp.js";
export {
  createMessagingChannel,
  markChannelConnected,
  getAccessTokenForChannel,
  applyMessagingEvent,
  getMessagingChannel,
  listMessagingChannels,
} from "./messaging-service.js";
export {
  evaluateSendPolicy,
  type PolicyDecision,
  type PolicyEvaluation,
  type PolicyCheckResult,
  type EvaluateSendInput,
} from "./policy-engine.js";
export {
  sendOutboundText,
  type SendOutboundTextInput,
  type SendOutboundResult,
} from "./outbound.js";
export {
  resolveContactByPhone,
  resolvedContactParticipantType,
  type ResolvedContact,
  type ResolvedContactType,
} from "./contact-resolver.js";
export {
  listConversations,
  getConversation,
  listMessages,
  assignConversation,
  closeConversation,
  reopenConversation,
  getUnreadCounts,
  type ConversationFilter,
  type ListConversationsInput,
  type UnreadSummary,
} from "./conversation-service.js";
export {
  grantConsent,
  revokeConsent,
  getConsentHistory,
  type ConsentRecord,
} from "./consent-service.js";
export {
  createTemplateDraft,
  submitTemplateForApproval,
  applyTemplateStatusFromProvider,
  listTemplates,
  type MessageTemplateRecord,
} from "./template-service.js";
export { getUsageSummary, type UsageSummary } from "./usage-service.js";
