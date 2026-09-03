import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignatureStatusForContract } from "@/lib/contract-signature-status";

export const dynamic = "force-dynamic";

// GET /api/customer-contracts/[id]/signature — customer-facing read of a
// contract's e-signature status, backing the clickwrap-vs-e-signature
// mutual-exclusivity behavior on the customer portal's contract page.
// Unlike the sibling .../documents GET route (which doesn't verify org
// ownership), this one DOES check the customer's org actually owns the
// contract before answering — same rental_customer_organizations chain
// the accept route already uses.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: link } = await admin
    .from("rental_customer_organizations")
    .select("id")
    .eq("rental_customer_id", customer.id)
    .eq("organization_id", contract.organization_id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await getSignatureStatusForContract(admin, contractId);
  return NextResponse.json({ data: status });
}
