import { NextResponse, type NextRequest } from "next/server";
import {
  listDiscoveryQuestions,
  isDiscoveryComplete,
  buildOnboardingRecommendation,
  type ResolverProfileInput,
} from "@shina/commercial-platform";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { ONBOARDING_AUDIT_EVENTS, newCorrelationId } from "@/lib/audit-event";

export const dynamic = "force-dynamic";

const FLAG = "onboarding.discovery";

// WAVE 2 — DISCOVER + RECOMMEND. GET returns the jargon-free adaptive
// questionnaire; POST runs the DETERMINISTIC resolvers and returns the
// explainable recommendation. Nothing is persisted or provisioned here —
// confirming the BusinessProfile / freezing a snapshot is Wave 3.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json({ error: "Discovery não habilitado" }, { status: 403 });
  }
  try {
    const questions = await listDiscoveryQuestions(scope.db);
    return NextResponse.json({ data: { questions } });
  } catch (err) {
    return internalError(err);
  }
}

interface RecommendationBody {
  primaryVertical?: string;
  additionalVerticals?: string[];
  answers?: Array<{ questionKey: string; value: unknown }>;
  correlationId?: string;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json({ error: "Discovery não habilitado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as RecommendationBody | null;
  if (!body?.primaryVertical?.trim()) {
    return NextResponse.json({ error: "primaryVertical é obrigatório" }, { status: 422 });
  }

  try {
    const questions = await listDiscoveryQuestions(scope.db);
    const answers = body.answers ?? [];
    const profile: ResolverProfileInput = {
      primaryVertical: body.primaryVertical.trim(),
      additionalVerticals: body.additionalVerticals ?? [],
      answers,
    };
    const recommendation = await buildOnboardingRecommendation(scope.db, profile);
    const correlationId = body.correlationId ?? newCorrelationId();

    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      actorType: "tenant_user",
      correlationId,
      entityType: "onboarding",
      entityId: correlationId,
      action: ONBOARDING_AUDIT_EVENTS.RECOMMENDATION_GENERATED,
      metadata: {
        primaryVertical: profile.primaryVertical,
        blueprintRuleVersion: recommendation.blueprint.ruleVersion,
        recommendedPlanKey: recommendation.plan.planKey,
        reasonCodes: recommendation.reasons.map((r) => r.code),
      },
    });

    return NextResponse.json({
      data: {
        correlationId,
        discoveryComplete: isDiscoveryComplete(questions, answers),
        recommendation,
      },
    });
  } catch (err) {
    return internalError(err);
  }
}
