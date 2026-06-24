import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/commissions/transactions/[id]/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.app_metadata?.tenant_role as string | undefined;
  if (!role || !["owner", "admin", "financial_manager"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: requires commissions:approve" }, { status: 403 });
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { id } = await params;
  let body: { approved?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newStatus = body.approved ? "approved" : "rejected";

  const admin = createAdminClient();
  const { error } = await admin
    .from("commission_transactions")
    .update({
      status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify resource owner via email (fire-and-forget)
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      type: "commission_status",
      transactionId: id,
      status: newStatus,
      approvedBy: user.id,
    }),
  }).catch(() => {
    /* non-fatal */
  });

  return NextResponse.json({ success: true, status: newStatus });
}
