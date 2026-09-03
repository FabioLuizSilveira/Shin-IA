"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchMyRentals,
  fetchContractSnapshot,
  fetchDataProcessingLegalBasis,
  acceptContract,
  type Rental,
  type ContractSnapshot,
} from "@/lib/rentals-portal";
import { ArrowLeft, Loader2, Upload } from "lucide-react";

interface DocumentRequirement {
  id: string;
  key: string;
  label: string;
  is_mandatory: boolean;
}

interface UploadedDocument {
  id: string;
  requirement_id: string;
  status: "pending" | "approved" | "rejected";
  original_filename: string;
}

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

interface SignatureStatus {
  id: string;
  status: "draft" | "sent" | "in_progress" | "signed" | "cancelled" | "expired" | "failed";
  signers: { role: string; name: string; status: string }[];
}

const SIGNATURE_STATUS_COPY: Record<SignatureStatus["status"], string> = {
  draft: "Assinatura eletrônica sendo preparada.",
  sent: "Assinatura eletrônica enviada — você vai receber um e-mail da Clicksign com o link para assinar.",
  in_progress: "Assinatura eletrônica em andamento.",
  signed: "Contrato assinado eletronicamente.",
  cancelled: "Assinatura eletrônica cancelada.",
  expired: "Assinatura eletrônica expirada.",
  failed: "Falha na assinatura eletrônica.",
};

// Non-terminal or already-signed => e-signature is the acceptance
// mechanism for this contract, clickwrap stays hidden (product decision:
// avoid a customer accepting twice via two different methods). Terminal
// failure states fall back to clickwrap.
function signatureBlocksClickwrap(status: SignatureStatus["status"]): boolean {
  return status !== "cancelled" && status !== "expired" && status !== "failed";
}

export default function RentalContractPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contractId = params.id;

  const [rental, setRental] = useState<Rental | null>(null);
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
  const [legalBasis, setLegalBasis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [signature, setSignature] = useState<SignatureStatus | null>(null);

  const loadDocuments = useCallback(() => {
    fetch(`/api/customer-contracts/${contractId}/documents`)
      .then((r) => r.json())
      .then(
        (j: { data: { requirements: DocumentRequirement[]; documents: UploadedDocument[] } }) => {
          setRequirements(j.data?.requirements ?? []);
          setDocuments(j.data?.documents ?? []);
        },
      )
      .catch(() => {});
  }, [contractId]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyRentals()
      .then(async (rentals) => {
        const r = rentals.find((x) => x.id === contractId) ?? null;
        setRental(r);
        if (r?.status === "active") setDone(true);
        if (r?.snapshot_id) {
          const [snap, basis] = await Promise.all([
            fetchContractSnapshot(r.id),
            fetchDataProcessingLegalBasis(r.id),
          ]);
          setSnapshot(snap);
          setLegalBasis(basis);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    loadDocuments();
    fetch(`/api/customer-contracts/${contractId}/signature`)
      .then((r) => r.json())
      .then((j: { data: SignatureStatus | null }) => setSignature(j.data ?? null))
      .catch(() => setSignature(null));
  }, [contractId, loadDocuments]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      await acceptContract(contractId, { dataProcessingConsent });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar aceite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(requirementId: string, file: File) {
    setUploadingKey(requirementId);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("requirement_id", requirementId);
      const res = await fetch(`/api/customer-contracts/${contractId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha no upload.");
      }
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploadingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!rental || !snapshot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 px-4">
        <p className="text-sm text-slate-500">
          {error ?? "Este contrato não possui um documento jurídico associado."}
        </p>
        <button
          onClick={() => router.push(`/rentals/${contractId}`)}
          className="text-sm text-shina-blue font-semibold cursor-pointer border-0 bg-transparent"
        >
          Voltar
        </button>
      </div>
    );
  }

  const requiresConsentCheckbox = legalBasis === "consent";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/rentals/${contractId}`)}
          className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-500 dark:text-slate-400"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Contrato</h1>
      </header>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
            {snapshot.rendered_content}
          </pre>
        </div>

        {signature && signatureBlocksClickwrap(signature.status) ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p
              className={`text-sm font-semibold ${
                signature.status === "signed"
                  ? "text-green-700 dark:text-green-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {SIGNATURE_STATUS_COPY[signature.status]}
            </p>
          </div>
        ) : done || rental.status === "active" ? (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Contrato aceito.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5"
              />
              Li e aceito as condições descritas acima.
            </label>
            {legalBasis && legalBasis !== "not_applicable" && (
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={dataProcessingConsent}
                  onChange={(e) => setDataProcessingConsent(e.target.checked)}
                  className="mt-0.5"
                />
                {requiresConsentCheckbox
                  ? "Autorizo o tratamento de dados pessoais necessário à execução desta operação."
                  : "Li o Aviso de Privacidade aplicável."}
              </label>
            )}
            <button
              type="button"
              disabled={
                !accepted || submitting || (requiresConsentCheckbox && !dataProcessingConsent)
              }
              onClick={() => void handleAccept()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Aceitar contrato
            </button>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}

        {requirements.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Documentos necessários
            </p>
            {requirements.map((req) => {
              const doc = documents.find((d) => d.requirement_id === req.id);
              return (
                <div key={req.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {req.label}
                    </p>
                    {doc && (
                      <p className="text-xs text-slate-400">
                        {doc.original_filename} — {DOC_STATUS_LABEL[doc.status]}
                      </p>
                    )}
                  </div>
                  <label className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer">
                    {uploadingKey === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {doc ? "Reenviar" : "Enviar"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      className="hidden"
                      disabled={uploadingKey !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(req.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
