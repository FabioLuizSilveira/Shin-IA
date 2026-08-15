import { NextResponse } from "next/server";
import { resolveRequiredContract } from "@shina/commercial-platform";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public read of the currently-published MKT contract — mirrors
// apps/web's /api/commercial/contract, same package, same source of truth.
export async function GET() {
  const admin = createAdminClient();
  try {
    const version = await resolveRequiredContract(admin, "mkt");
    return NextResponse.json({
      data: { id: version.id, title: version.title, content: version.content },
    });
  } catch (err) {
    console.error("[commercial/contract]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
