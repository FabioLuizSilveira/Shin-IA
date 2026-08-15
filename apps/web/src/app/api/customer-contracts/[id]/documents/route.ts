import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const BUCKET = "contract-documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MiB, matches the bucket's file_size_limit
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);

// Customer document upload — the bucket is private with no storage.objects
// RLS (same posture as tenant-branding's public bucket: auth lives entirely
// in the API route, not in Storage policies), so the file goes THROUGH this
// route rather than a client-side signed upload URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
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

  const { data: contract } = await admin
    .from("contracts")
    .select("id, tenant_id, organization_id, template_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || !contract.template_id) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }

  const { data: link } = await admin
    .from("rental_customer_organizations")
    .select("id")
    .eq("rental_customer_id", customer.id)
    .eq("organization_id", contract.organization_id)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const requirementId = form?.get("requirement_id");
  if (!(file instanceof File) || typeof requirementId !== "string" || !requirementId) {
    return NextResponse.json({ error: "file e requirement_id são obrigatórios." }, { status: 422 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo excede 10 MiB." }, { status: 422 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado." }, { status: 422 });
  }

  const { data: requirement } = await admin
    .from("contract_document_requirements")
    .select("id, key, template_id")
    .eq("id", requirementId)
    .maybeSingle();
  if (!requirement || requirement.template_id !== contract.template_id) {
    return NextResponse.json(
      { error: "Requisito de documento não pertence a este contrato." },
      { status: 422 },
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${contract.tenant_id}/${contractId}/${requirement.key}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `Falha no upload: ${uploadError.message}` }, { status: 500 });
  }

  const { data: doc, error: insertError } = await admin
    .from("contract_documents")
    .insert({
      tenant_id: contract.tenant_id,
      party_type: "customer",
      customer_id: customer.id,
      requirement_id: requirement.id,
      contract_id: contract.id,
      storage_path: storagePath,
      original_filename: file.name,
      status: "pending",
    })
    .select("id, status")
    .single();
  if (insertError || !doc) {
    return NextResponse.json({ error: "Falha ao registrar documento." }, { status: 500 });
  }

  void logActivity(admin, {
    tenantId: contract.tenant_id,
    actorId: user.id,
    entityType: "contract_document",
    entityId: doc.id,
    action: "document.uploaded",
    metadata: { requirement_key: requirement.key },
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}

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
    .select("template_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract?.template_id)
    return NextResponse.json({ data: { requirements: [], documents: [] } });

  const { data: requirements } = await admin
    .from("contract_document_requirements")
    .select("id, key, label, is_mandatory")
    .eq("template_id", contract.template_id);

  const { data: documents } = await admin
    .from("contract_documents")
    .select("id, requirement_id, status, original_filename, uploaded_at")
    .eq("contract_id", contractId)
    .eq("customer_id", customer.id);

  return NextResponse.json({
    data: { requirements: requirements ?? [], documents: documents ?? [] },
  });
}
