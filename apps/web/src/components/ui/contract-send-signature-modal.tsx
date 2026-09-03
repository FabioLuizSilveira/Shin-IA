"use client";

// Same drawer-chrome + internal-step-state shape as
// infraction-csv-import-modal.tsx — a self-contained modal opened
// conditionally by contract-detail.tsx, with its own fetch call. v1 scope
// deliberately simple: one required "customer" signer (pre-filled from the
// contract's organization, bridges to recordContractAcceptance()) plus
// optional extra ad-hoc signers that do NOT bridge to a formal acceptance
// record — a real, pre-existing P0/P1 limitation (only customer/operator
// party types get that bridge), now surfaced in the UI copy itself instead
// of only in a code comment.

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface ExtraSigner {
  role: "guarantor" | "witness" | "tenant_representative" | "other";
  name: string;
  email: string;
}

const EXTRA_ROLE_LABEL: Record<ExtraSigner["role"], string> = {
  guarantor: "Fiador",
  witness: "Testemunha",
  tenant_representative: "Representante do tenant",
  other: "Outro",
};

interface ContractSendSignatureModalProps {
  contractId: string;
  /** A real rental_customers.id — required for this signer to bridge into
   * recordContractAcceptance() (the backend rejects partyType:"customer"
   * without one). null when the contract has no linked customer yet — the
   * signer still gets sent, just without the formal-acceptance bridge,
   * same as the optional extra signers below. */
  linkedCustomerId: string | null;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
  onSent: () => void;
}

export function ContractSendSignatureModal({
  contractId,
  linkedCustomerId,
  customerName,
  customerEmail,
  onClose,
  onSent,
}: ContractSendSignatureModalProps) {
  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [extraSigners, setExtraSigners] = useState<ExtraSigner[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addExtraSigner() {
    setExtraSigners((prev) => [...prev, { role: "other", name: "", email: "" }]);
  }
  function removeExtraSigner(idx: number) {
    setExtraSigners((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateExtraSigner(idx: number, patch: Partial<ExtraSigner>) {
    setExtraSigners((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function handleSend() {
    if (!name.trim() || !email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/signature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          signers: [
            linkedCustomerId
              ? {
                  role: "customer",
                  name: name.trim(),
                  email: email.trim(),
                  partyType: "customer",
                  customerId: linkedCustomerId,
                }
              : { role: "customer", name: name.trim(), email: email.trim() },
            ...extraSigners
              .filter((s) => s.name.trim() && s.email.trim())
              .map((s) => ({ role: s.role, name: s.name.trim(), email: s.email.trim() })),
          ],
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Falha ao solicitar assinatura.");
        return;
      }
      onSent();
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Solicitar assinatura eletrônica
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <p className="text-xs text-slate-500">
            O contrato será enviado para assinatura via Clicksign. Cada signatário recebe um e-mail
            diretamente da Clicksign com o link para assinar.
          </p>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">Cliente (obrigatório)</p>
            {!linkedCustomerId && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                Este contrato ainda não tem um cliente com acesso ao app vinculado — a assinatura
                será enviada, mas não vai gerar um registro formal de aceite do contrato. Vincule um
                cliente na seção "Clientes com acesso ao app" para isso.
              </p>
            )}
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                type="email"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-700">Outros signatários (opcional)</p>
              <button
                onClick={addExtraSigner}
                className="p-1 text-shina-blue hover:bg-shina-blue/10 rounded-lg cursor-pointer border-0 bg-transparent"
                title="Adicionar signatário"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {extraSigners.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                Assinaturas desse tipo não geram registro de aceite formal do contrato — servem só
                como evidência de assinatura na Clicksign.
              </p>
            )}
            <div className="space-y-3">
              {extraSigners.map((signer, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={idx} className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={signer.role}
                      onChange={(e) =>
                        updateExtraSigner(idx, { role: e.target.value as ExtraSigner["role"] })
                      }
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200"
                    >
                      {(Object.keys(EXTRA_ROLE_LABEL) as ExtraSigner["role"][]).map((role) => (
                        <option key={role} value={role}>
                          {EXTRA_ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeExtraSigner(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer border-0 bg-transparent shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={signer.name}
                    onChange={(e) => updateExtraSigner(idx, { name: e.target.value })}
                    placeholder="Nome"
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200"
                  />
                  <input
                    value={signer.email}
                    onChange={(e) => updateExtraSigner(idx, { email: e.target.value })}
                    placeholder="E-mail"
                    type="email"
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => void handleSend()}
            disabled={sending || !name.trim() || !email.trim()}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-shina-blue hover:bg-blue-600 text-white disabled:opacity-60 cursor-pointer border-0"
          >
            {sending ? "Enviando..." : "Enviar para assinatura"}
          </button>
        </div>
      </div>
    </>
  );
}
