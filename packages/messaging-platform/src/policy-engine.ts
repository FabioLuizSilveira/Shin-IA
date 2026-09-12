import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentPurpose, MessagingChannel } from "./types.js";

// MessagingPolicyEngine — spec section 13, P0. "Nenhum módulo envia
// mensagem diretamente": every outbound send passes through evaluate()
// first. This is WAVE 1's minimal gate (channel status + consent +
// entitlement); template-approval and budget/limit checks are layered on
// in later waves once templates/usage metering have real UI, but the shape
// here is deliberately already the full decision surface so those don't
// require a redesign — they slot into `checks` below.

export type PolicyDecision = "ALLOW" | "BLOCK";

export interface PolicyCheckResult {
  check: string;
  passed: boolean;
  reason?: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  checks: PolicyCheckResult[];
}

export interface EvaluateSendInput {
  channel: MessagingChannel;
  tenantId: string;
  personId: string | null;
  purpose: ConsentPurpose;
  entitlementActive: boolean;
}

/** Marketing is the one purpose that NEVER gets an implicit pass — spec
 *  section 14: "Nunca inferir: consentimento operacional = consentimento
 *  marketing." Every other purpose requires an explicit REVOKED consent
 *  row to be blocked (opt-out respected), but absence of a row is not
 *  itself a block for operational/transactional/support. */
export async function evaluateSendPolicy(
  db: SupabaseClient,
  input: EvaluateSendInput,
): Promise<PolicyEvaluation> {
  const checks: PolicyCheckResult[] = [];

  checks.push({
    check: "channel_status",
    passed: input.channel.status === "connected",
    reason: input.channel.status !== "connected" ? `channel is ${input.channel.status}` : undefined,
  });

  checks.push({
    check: "entitlement",
    passed: input.entitlementActive,
    reason: input.entitlementActive ? undefined : "messaging_whatsapp entitlement not active",
  });

  if (input.personId) {
    const { data: consent } = await db
      .from("communication_consents")
      .select("status")
      .eq("tenant_id", input.tenantId)
      .eq("person_id", input.personId)
      .eq("purpose", input.purpose)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (input.purpose === "marketing") {
      const granted = consent?.status === "granted";
      checks.push({
        check: "consent",
        passed: granted,
        reason: granted ? undefined : "marketing requires an explicit granted consent",
      });
    } else {
      const revoked = consent?.status === "revoked";
      checks.push({
        check: "consent",
        passed: !revoked,
        reason: revoked ? `consent for purpose "${input.purpose}" was revoked` : undefined,
      });
    }
  } else {
    checks.push({ check: "consent", passed: true });
  }

  const decision: PolicyDecision = checks.every((c) => c.passed) ? "ALLOW" : "BLOCK";
  return { decision, checks };
}
