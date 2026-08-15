import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRequiredContract } from "@shina/commercial-platform";
import type { Product } from "@shina/commercial-platform";

export const dynamic = "force-dynamic";

// Public read of the currently-published contract for a product — shown at
// onboarding (Master) and before MKT checkout (Addendum-equivalent), always
// the live version so what's displayed always matches what gets recorded.
export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product") as Product | null;
  if (product !== "platform" && product !== "mkt") {
    return NextResponse.json({ error: "product must be 'platform' or 'mkt'" }, { status: 422 });
  }

  const admin = createAdminClient();
  try {
    const version = await resolveRequiredContract(admin, product);
    return NextResponse.json({
      data: { id: version.id, title: version.title, content: version.content },
    });
  } catch (err) {
    return internalError(err);
  }
}
