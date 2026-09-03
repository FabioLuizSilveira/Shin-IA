"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Calendar,
  DollarSign,
  Building2,
  Truck,
  UserPlus,
  Plus,
  Trash2,
  FileCheck,
  Check,
  Ban,
  PenTool,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractSendSignatureModal } from "@/components/ui/contract-send-signature-modal";
import type { ContractDetail as ContractDetailData, ContractStatus } from "@/types/domain";

interface ContractSignatureSigner {
  role: string;
  name: string;
  status: "pending" | "viewed" | "signed" | "refused";
}

interface ContractSignatureStatus {
  id: string;
  provider: string;
  status: "draft" | "sent" | "in_progress" | "signed" | "cancelled" | "expired" | "failed";
  signers: ContractSignatureSigner[];
}

const SIGNER_ROLE_LABEL: Record<string, string> = {
  customer: "Cliente",
  operator: "Operador",
  guarantor: "Fiador",
  witness: "Testemunha",
  tenant_representative: "Representante do tenant",
  other: "Outro",
};

const SIGNER_STATUS_LABEL: Record<ContractSignatureSigner["status"], string> = {
  pending: "Pendente",
  viewed: "Visualizado",
  signed: "Assinado",
  refused: "Recusado",
};

function signatureStatusToUi(
  status: ContractSignatureStatus["status"],
): "active" | "inactive" | "pending" | "warning" | "error" {
  switch (status) {
    case "signed":
      return "active";
    case "in_progress":
    case "sent":
      return "pending";
    case "draft":
      return "pending";
    case "cancelled":
    case "expired":
      return "inactive";
    case "failed":
      return "error";
    default:
      return "inactive";
  }
}

function signatureStatusLabel(status: ContractSignatureStatus["status"]): string {
  const labels: Record<ContractSignatureStatus["status"], string> = {
    draft: "Preparando",
    sent: "Enviada",
    in_progress: "Em andamento",
    signed: "Assinado",
    cancelled: "Cancelada",
    expired: "Expirada",
    failed: "Falhou",
  };
  return labels[status] ?? status;
}

interface LinkedAsset {
  id: string;
  quantity: number;
  notes: string | null;
  assets: { id: string; name: string; category: string; status: string } | null;
}

interface LinkedCustomer {
  id: string;
  created_at: string;
  rental_customers: { id: string; email: string | null; full_name: string | null } | null;
}

interface ContractDocument {
  id: string;
  status: "pending" | "approved" | "rejected";
  original_filename: string;
  signed_url: string | null;
  contract_document_requirements: { key: string; label: string; is_mandatory: boolean } | null;
}

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

interface ContractDetailProps {
  contractId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

const ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  draft: [
    { label: "Ativar", status: "active", color: "bg-shina-blue hover:bg-blue-600 text-white" },
    {
      label: "Cancelar",
      status: "terminated",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    },
  ],
  active: [
    {
      label: "Suspender",
      status: "suspended",
      color: "bg-amber-100 hover:bg-amber-200 text-amber-700",
    },
    {
      label: "Encerrar",
      status: "terminated",
      color: "bg-red-100 hover:bg-red-200 text-red-700",
    },
  ],
  suspended: [
    { label: "Reativar", status: "active", color: "bg-shina-blue hover:bg-blue-600 text-white" },
    {
      label: "Encerrar",
      status: "terminated",
      color: "bg-red-100 hover:bg-red-200 text-red-700",
    },
  ],
};

const contractTypeLabel: Record<string, string> = {
  service: "Serviço",
  rental: "Locação",
  lease: "Arrendamento",
  subscription: "Assinatura",
  one_time: "Avulso",
};

const orgTypeLabel: Record<string, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  partner: "Parceiro",
  internal: "Interno",
};

function contractStatusToUi(status: ContractStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "active":
      return "active";
    case "draft":
      return "pending";
    case "suspended":
      return "warning";
    case "expired":
    case "terminated":
      return "inactive";
    default:
      return "inactive";
  }
}

function contractStatusLabel(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    active: "Ativo",
    draft: "Rascunho",
    expired: "Expirado",
    terminated: "Rescindido",
    suspended: "Suspenso",
  };
  return labels[status] ?? status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

export function ContractDetail({ contractId, onClose, onStatusChange }: ContractDetailProps) {
  const [contract, setContract] = useState<ContractDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomer[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [assetIdInput, setAssetIdInput] = useState("");
  const [customerEmailInput, setCustomerEmailInput] = useState("");
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const [signatureStatus, setSignatureStatus] = useState<ContractSignatureStatus | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [cancellingSignature, setCancellingSignature] = useState(false);

  const refreshSignatureStatus = useCallback(() => {
    if (!contractId) return;
    fetch(`/api/signature-requests?contractId=${contractId}`)
      .then((r) => r.json())
      .then((j: { data: ContractSignatureStatus | null }) => setSignatureStatus(j.data ?? null))
      .catch(() => setSignatureStatus(null));
  }, [contractId]);

  async function handleCancelSignature() {
    if (!signatureStatus) return;
    setCancellingSignature(true);
    try {
      await fetch(`/api/signature-requests/${signatureStatus.id}/cancel`, { method: "POST" });
      refreshSignatureStatus();
    } finally {
      setCancellingSignature(false);
    }
  }

  const refreshAssets = useCallback(() => {
    if (!contractId) return;
    fetch(`/api/contracts/${contractId}/assets`)
      .then((r) => r.json())
      .then((j: { data: LinkedAsset[] }) => setLinkedAssets(j.data ?? []))
      .catch(() => setLinkedAssets([]));
  }, [contractId]);

  const refreshCustomers = useCallback(() => {
    if (!contractId) return;
    fetch(`/api/contracts/${contractId}/customers`)
      .then((r) => r.json())
      .then((j: { data: LinkedCustomer[] }) => setLinkedCustomers(j.data ?? []))
      .catch(() => setLinkedCustomers([]));
  }, [contractId]);

  const refreshDocuments = useCallback(() => {
    if (!contractId) return;
    fetch(`/api/contracts/${contractId}/documents`)
      .then((r) => r.json())
      .then((j: { data: ContractDocument[] }) => setDocuments(j.data ?? []))
      .catch(() => setDocuments([]));
  }, [contractId]);

  useEffect(() => {
    if (!contractId) {
      setContract(null);
      setLinkedAssets([]);
      setLinkedCustomers([]);
      return;
    }
    setLoading(true);
    fetch(`/api/contracts/${contractId}`)
      .then((r) => r.json())
      .then((j: { data: ContractDetailData }) => setContract(j.data))
      .catch(() => setContract(null))
      .finally(() => setLoading(false));
    refreshAssets();
    refreshCustomers();
    refreshDocuments();
    refreshSignatureStatus();
  }, [contractId, refreshAssets, refreshCustomers, refreshDocuments, refreshSignatureStatus]);

  async function handleReviewDocument(documentId: string, status: "approved" | "rejected") {
    if (!contractId) return;
    setReviewingId(documentId);
    try {
      await fetch(`/api/contracts/${contractId}/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refreshDocuments();
    } finally {
      setReviewingId(null);
    }
  }

  async function handleLinkAsset() {
    if (!contractId || !assetIdInput.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: assetIdInput.trim() }),
      });
      if (res.ok) {
        setAssetIdInput("");
        refreshAssets();
      }
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkAsset(linkId: string) {
    if (!contractId) return;
    await fetch(`/api/contracts/${contractId}/assets?linkId=${linkId}`, { method: "DELETE" });
    refreshAssets();
  }

  async function handleInviteCustomer() {
    if (!contractId || !customerEmailInput.trim()) return;
    setInviting(true);
    setInviteFeedback(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmailInput.trim(),
          full_name: customerNameInput.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (res.ok) {
        setCustomerEmailInput("");
        setCustomerNameInput("");
        setInviteFeedback("Convite enviado.");
        refreshCustomers();
      } else {
        setInviteFeedback(json.error ?? "Falha ao convidar cliente.");
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleAction(newStatus: string) {
    if (!contractId) return;
    setActing(true);
    try {
      await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } finally {
      setActing(false);
    }
    onStatusChange();
    onClose();
  }

  if (!contractId) return null;

  const actions = contract ? (ACTIONS[contract.status] ?? null) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Detalhe do Contrato</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !contract ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Type + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tipo</p>
                  <p className="text-lg font-bold text-slate-900">
                    {contractTypeLabel[contract.type] ?? contract.type}
                  </p>
                </div>
                <StatusBadge
                  status={contractStatusToUi(contract.status)}
                  label={contractStatusLabel(contract.status)}
                />
              </div>

              {/* Value */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Valor</span>
                  <span className="ml-auto font-semibold text-slate-900 text-base">
                    {formatCurrency(Number(contract.value_amount))}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Início</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDate(contract.period_starts_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Fim</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDate(contract.period_ends_at)}
                  </span>
                </div>
              </div>

              {/* Organization */}
              {contract.organizations && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Organização</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-shina-blue/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-shina-blue" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {contract.organizations.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {orgTypeLabel[contract.organizations.type] ?? contract.organizations.type}
                        {contract.organizations.document
                          ? ` · ${contract.organizations.document}`
                          : ""}
                      </p>
                      {contract.organizations.email && (
                        <p className="text-xs text-slate-400 truncate">
                          {contract.organizations.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Linked assets (what the customer actually rented) */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Ativos vinculados</p>
                <div className="space-y-2">
                  {linkedAssets.map((la) => (
                    <div key={la.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {la.assets?.name ?? "Ativo removido"}
                        </p>
                        <p className="text-xs text-slate-500">Qtd: {la.quantity}</p>
                      </div>
                      <button
                        onClick={() => void handleUnlinkAsset(la.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer border-0 bg-transparent shrink-0"
                        title="Remover vínculo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {linkedAssets.length === 0 && (
                    <p className="text-xs text-slate-400">Nenhum ativo vinculado ainda.</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    value={assetIdInput}
                    onChange={(e) => setAssetIdInput(e.target.value)}
                    placeholder="ID do ativo"
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  />
                  <button
                    onClick={() => void handleLinkAsset()}
                    disabled={linking || !assetIdInput.trim()}
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-60 cursor-pointer border-0 shrink-0"
                    title="Vincular ativo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rental customers (external, end-customer mobile app access) */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Clientes com acesso ao app</p>
                <div className="space-y-2">
                  {linkedCustomers.map((lc) => (
                    <div key={lc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {lc.rental_customers?.full_name || lc.rental_customers?.email || "—"}
                        </p>
                        {lc.rental_customers?.email && (
                          <p className="text-xs text-slate-500 truncate">
                            {lc.rental_customers.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {linkedCustomers.length === 0 && (
                    <p className="text-xs text-slate-400">Nenhum cliente convidado ainda.</p>
                  )}
                </div>
                <div className="space-y-2 mt-2">
                  <input
                    value={customerEmailInput}
                    onChange={(e) => setCustomerEmailInput(e.target.value)}
                    placeholder="E-mail do cliente"
                    type="email"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                  />
                  <div className="flex gap-2">
                    <input
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      placeholder="Nome (opcional)"
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
                    />
                    <button
                      onClick={() => void handleInviteCustomer()}
                      disabled={inviting || !customerEmailInput.trim()}
                      className="px-3 py-2 rounded-lg bg-shina-blue hover:bg-blue-600 text-white text-xs font-medium disabled:opacity-60 cursor-pointer border-0 shrink-0"
                    >
                      Convidar
                    </button>
                  </div>
                  {inviteFeedback && <p className="text-xs text-slate-500">{inviteFeedback}</p>}
                </div>
              </div>

              {/* Contract documents (Fase F) */}
              {documents.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Documentos do contrato</p>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                      >
                        <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {doc.contract_document_requirements?.label ?? doc.original_filename}
                          </p>
                          <div className="flex items-center gap-2">
                            {doc.signed_url ? (
                              <a
                                href={doc.signed_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-shina-blue"
                              >
                                Ver arquivo
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {doc.original_filename}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              · {DOC_STATUS_LABEL[doc.status]}
                            </span>
                          </div>
                        </div>
                        {doc.status === "pending" && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => void handleReviewDocument(doc.id, "approved")}
                              disabled={reviewingId === doc.id}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer border-0 bg-transparent disabled:opacity-50"
                              title="Aprovar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void handleReviewDocument(doc.id, "rejected")}
                              disabled={reviewingId === doc.id}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer border-0 bg-transparent disabled:opacity-50"
                              title="Rejeitar"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature Platform (P2) — electronic signature status */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">Assinatura eletrônica</p>
                  {signatureStatus && (
                    <StatusBadge
                      status={signatureStatusToUi(signatureStatus.status)}
                      label={signatureStatusLabel(signatureStatus.status)}
                    />
                  )}
                </div>
                {signatureStatus ? (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      {signatureStatus.signers.map((signer, idx) => (
                        <div
                          // eslint-disable-next-line react/no-array-index-key
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-xs"
                        >
                          <span className="text-slate-700">
                            {signer.name}{" "}
                            <span className="text-slate-400">
                              ({SIGNER_ROLE_LABEL[signer.role] ?? signer.role})
                            </span>
                          </span>
                          <span className="text-slate-500">
                            {SIGNER_STATUS_LABEL[signer.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {["draft", "sent", "in_progress"].includes(signatureStatus.status) && (
                      <button
                        onClick={() => void handleCancelSignature()}
                        disabled={cancellingSignature}
                        className="text-xs text-red-600 hover:underline cursor-pointer border-0 bg-transparent disabled:opacity-60"
                      >
                        {cancellingSignature ? "Cancelando..." : "Cancelar solicitação"}
                      </button>
                    )}
                    {/* cancelled/expired/failed are terminal but not
                        blocking — the tenant can send a fresh request */}
                    {["cancelled", "expired", "failed"].includes(signatureStatus.status) && (
                      <button
                        onClick={() => setShowSignatureModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer border-0"
                      >
                        <PenTool className="w-4 h-4" />
                        Solicitar nova assinatura
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer border-0"
                  >
                    <PenTool className="w-4 h-4" />
                    Solicitar assinatura
                  </button>
                )}
              </div>

              {/* Created */}
              <div>
                <p className="text-xs text-slate-500">Criado em</p>
                <p className="text-sm text-slate-700 mt-0.5">{formatDate(contract.created_at)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {contract && actions && (
          <div className="px-6 py-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-medium text-slate-500 mb-3">Ações disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => void handleAction(action.status)}
                  disabled={acting}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer border-0 ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {contract && !actions && (
          <div className="px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Este contrato está em estado terminal e não pode ser alterado.
            </p>
          </div>
        )}
      </div>

      {contract && showSignatureModal && (
        <ContractSendSignatureModal
          contractId={contract.id}
          customerName={contract.organizations?.name ?? ""}
          customerEmail={contract.organizations?.email ?? ""}
          onClose={() => setShowSignatureModal(false)}
          onSent={refreshSignatureStatus}
        />
      )}
    </>
  );
}
