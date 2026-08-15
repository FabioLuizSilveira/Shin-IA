import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const BUCKET = "contract-documents";

interface DocumentRow {
  id: string;
  requirement_id: string;
  status: "pending" | "approved" | "rejected";
  original_filename: string;
  storage_path: string;
  uploaded_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  contract_document_requirements: { key: string; label: string; is_mandatory: boolean } | null;
}

// Tenant staff review queue for a contract's uploaded documents (Fase F).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: documents, error } = await scope.db
    .from("contract_documents")
    .select(
      "id, requirement_id, status, original_filename, storage_path, uploaded_at, reviewed_at, review_notes, " +
        "contract_document_requirements(key, label, is_mandatory)",
    )
    .eq("contract_id", contractId)
    .eq("tenant_id", scope.tenantId)
    .order("uploaded_at", { ascending: false });
  if (error) return internalError(error);

  const rows = (documents ?? []) as unknown as DocumentRow[];
  const withUrls = await Promise.all(
    rows.map(async (doc) => {
      const { data: signed } = await scope.db.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 300);
      return { ...doc, signed_url: signed?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ data: withUrls });
}
