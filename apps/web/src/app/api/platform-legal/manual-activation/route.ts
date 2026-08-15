import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requirePlatformRole } from "@/lib/platform-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateSubscriptionManually, type BillingMode } from "@shina/commercial-platform";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Enterprise activation path (item 26) — a platform admin confirms a deal
// closed outside Stripe (invoice sent, contract signed manually) and
// activates the subscription directly, no card checkout involved. Never
// reachable by a tenant itself — platform-staff only.
export async function POST(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json()) as {
    tenantId?: string | null;
    userId?: string;
    product?: "platform" | "mkt";
    planVersionId?: string;
    billingMode?: BillingMode;
    representativeName?: string;
    representativeRole?: string;
    representativeDocument?: string;
    declaredAuthority?: boolean;
  };

  if (
    !body.userId ||
    !body.product ||
    !body.planVersionId ||
    !body.billingMode ||
    body.billingMode === "card" ||
    !body.representativeName ||
    !body.representativeRole ||
    !body.declaredAuthority
  ) {
    return NextResponse.json(
      { error: "Dados incompletos ou billingMode inválido." },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  try {
    const result = await activateSubscriptionManually(admin, {
      tenantId: body.tenantId ?? null,
      userId: body.userId,
      product: body.product,
      planVersionId: body.planVersionId,
      billingMode: body.billingMode,
      activatedByPlatformUserId: guard.userId,
      representative: {
        name: body.representativeName,
        role: body.representativeRole,
        document: body.representativeDocument,
        declaredAuthority: body.declaredAuthority,
      },
      request: { ipAddress: clientIp(req), userAgent: req.headers.get("user-agent") },
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
