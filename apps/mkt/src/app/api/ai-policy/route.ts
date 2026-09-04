import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAiPolicy,
  upsertAiPolicy,
  type AiMode,
  type CredentialSource,
} from "@shina/ai-gateway";

export const dynamic = "force-dynamic";

const MODES: AiMode[] = ["SHINA", "BYOK", "HYBRID"];
const SOURCES: CredentialSource[] = ["BYOK", "SHINA"];

// GET — the workspace's effective AI policy (mode, what's allowed by the
// plan, credit balance). Never includes a credential of any kind.
export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const policy = await resolveAiPolicy(supabase, ctx.workspaceId, ctx.tenantId, "mkt");
    return NextResponse.json({ data: policy });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// PATCH — sets the workspace's AI mode / hybrid preference. The plan's
// usage_limits (byokAllowed/hybridAllowed) still cap what actually takes
// effect — see resolveAiPolicy(), which is the source of truth for what
// finally happens on the next AI call, not this endpoint's echo.
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      mode?: string;
      preferredSource?: string | null;
      allowShinaFallback?: boolean;
    };

    if (!body.mode || !MODES.includes(body.mode as AiMode)) {
      return NextResponse.json(
        { error: "mode must be one of SHINA, BYOK, HYBRID" },
        { status: 422 },
      );
    }
    if (body.preferredSource && !SOURCES.includes(body.preferredSource as CredentialSource)) {
      return NextResponse.json({ error: "preferredSource must be BYOK or SHINA" }, { status: 422 });
    }

    const supabase = await createClient();
    await upsertAiPolicy(supabase, ctx.workspaceId, ctx.tenantId, ctx.userId, {
      mode: body.mode as AiMode,
      preferredSource: (body.preferredSource as CredentialSource | null) ?? null,
      allowShinaFallback: body.allowShinaFallback ?? false,
    });

    const policy = await resolveAiPolicy(supabase, ctx.workspaceId, ctx.tenantId, "mkt");
    return NextResponse.json({ data: policy });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
