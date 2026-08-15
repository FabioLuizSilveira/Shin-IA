import { NextResponse, type NextRequest } from "next/server";
import { recordContractAcceptance } from "@shina/commercial-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Records acceptance of the MKT contract for the current user. tenantId is
// always null here — a Shinã MKT buyer is never required to be a Shinã
// Platform tenant (see platform_customers' own header comment), so
// acceptance is keyed by userId, not tenant.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login antes de continuar." }, { status: 401 });
  }

  const body = (await req.json()) as {
    planVersionId?: string;
    representativeName?: string;
    representativeRole?: string;
    representativeDocument?: string;
    declaredAuthority?: boolean;
  };

  if (!body.planVersionId || !body.representativeName || !body.representativeRole) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 422 });
  }
  if (!body.declaredAuthority) {
    return NextResponse.json(
      { error: "É necessário declarar poderes de representação." },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  try {
    const result = await recordContractAcceptance(admin, {
      tenantId: null,
      userId: user.id,
      product: "mkt",
      planVersionId: body.planVersionId,
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
    console.error("[commercial/accept]", err);
    const message = err instanceof Error ? err.message : "Erro ao registrar aceite.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
