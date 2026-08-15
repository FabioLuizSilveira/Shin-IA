import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BUCKET = "contract-documents";
const SIGNED_URL_TTL_SECONDS = 300;

// Wave 3 Phase B — closes gap MOB-004: the only createSignedUrl usage in the
// repo before this route was the tenant-staff review queue
// (api/contracts/[id]/documents/route.ts); a customer had no way to
// re-download their own uploaded document. Same session-authenticated
// pattern as the sibling customer-contracts routes (not api/mobile/* — no
// aggregation/DTO-shaping need here, just a signed URL, so no BFF wrapper
// per the reuse rule). Never persists or caches the URL server-side; each
// call mints a fresh 5-minute signed URL, matching the staff route's TTL.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: contractId, documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`doc-url:${user.id}:${clientIp(req)}`, 30, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "Cadastro de cliente não encontrado." }, { status: 403 });
  }

  // Ownership enforced in the query itself (contract_id + customer_id), not
  // as a separate check after the fact — a document that isn't the
  // customer's own or doesn't belong to this contract simply doesn't match,
  // same 404 either way (IDOR hygiene).
  const { data: document } = await admin
    .from("contract_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("contract_id", contractId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) {
    return NextResponse.json({ error: "Falha ao gerar URL de download." }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      url: signed.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    },
  });
}
