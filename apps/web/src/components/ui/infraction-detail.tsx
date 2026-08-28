"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  UserCog,
  FileWarning,
} from "lucide-react";

interface InfractionRow {
  id: string;
  source: string;
  auto_number: string | null;
  plate: string;
  occurred_at: string;
  location: string | null;
  description: string | null;
  amount_cents: number | null;
  amount_currency: string;
  points: number | null;
}

interface CaseRow {
  id: string;
  status: string;
  asset_id: string | null;
  match_confidence: string | null;
  contract_id: string | null;
  operation_id: string | null;
  customer_id: string | null;
  operator_id: string | null;
  responsible_party_type: string | null;
  responsible_party_id: string | null;
  responsibility_confidence: number | null;
  responsibility_reasons: { reason: string }[];
  responsibility_confirmed_at: string | null;
  created_at: string;
  infractions: InfractionRow;
}

interface DeadlineRow {
  id: string;
  deadline_type: string;
  due_at: string | null;
  status: string;
}

interface DisputeRow {
  id: string;
  status: string;
  description: string;
  created_at: string;
}

interface DriverIdRow {
  id: string;
  status: string;
  driver_name: string | null;
  operator_id: string | null;
}

interface DefenseRow {
  id: string;
  kind: string;
  status: string;
  external_protocol: string | null;
}

interface PaymentRow {
  id: string;
  kind: string;
  amount_paid_cents: number | null;
}

interface DetailPayload {
  case: CaseRow;
  deadlines: DeadlineRow[];
  disputes: DisputeRow[];
  driverIdentifications: DriverIdRow[];
  defenses: DefenseRow[];
  payments: PaymentRow[];
}

// Full 20-value infraction_case_status enum -- see the matching fix/
// comment in tenant/infractions/page.tsx's STATUS_LABEL.
const CASE_STATUS_LABEL: Record<string, string> = {
  received: "Recebida",
  matching: "Vinculando ativo",
  unmatched: "Sem ativo vinculado",
  matched: "Ativo vinculado",
  responsibility_pending: "Responsabilidade pendente",
  responsibility_suggested: "Responsabilidade sugerida",
  responsibility_confirmed: "Responsabilidade confirmada",
  notified: "Notificado",
  action_pending: "Ação pendente",
  disputed: "Contestada",
  driver_identification_pending: "Indicação de condutor pendente",
  driver_identified: "Condutor indicado",
  defense_pending: "Defesa pendente",
  appealed: "Recurso em andamento",
  payment_pending: "Pagamento pendente",
  paid: "Paga",
  overdue: "Vencida",
  waived: "Perdoada",
  cancelled: "Cancelada",
  closed: "Encerrada",
};

const DRIVER_ID_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  ready: "Pronta",
  submitted: "Enviada",
  accepted: "Aceita",
  rejected: "Rejeitada",
  expired: "Expirada",
  not_required: "Não exigida",
};

const DEFENSE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  under_analysis: "Em análise",
  accepted: "Aceita",
  rejected: "Rejeitada",
  expired: "Expirada",
};

function formatCents(cents: number | null, currency = "BRL"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Falha na operação.");
  return json;
}

export function InfractionDetail({
  caseId,
  onClose,
  onChange,
}: {
  caseId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reimbursementAmount, setReimbursementAmount] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [driverName, setDriverName] = useState("");
  const [defenseNotes, setDefenseNotes] = useState("");
  const [defenseKind, setDefenseKind] = useState<"defense" | "appeal">("defense");

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/infractions/${caseId}`);
      const json = (await res.json()) as { data?: DetailPayload };
      setData(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await load();
      onChange();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (!caseId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-shina-blue" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Infração {data?.case.infractions.auto_number ?? ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loading && <p className="text-sm text-slate-500">Carregando...</p>}

          {data && (
            <>
              <section>
                <p className="text-xs font-medium text-slate-500 mb-1">
                  {CASE_STATUS_LABEL[data.case.status] ?? data.case.status}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {data.case.infractions.plate} —{" "}
                  {data.case.infractions.description ?? "sem descrição"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(data.case.infractions.occurred_at).toLocaleString("pt-BR")}
                  {data.case.infractions.location ? ` · ${data.case.infractions.location}` : ""}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mt-2">
                  {formatCents(
                    data.case.infractions.amount_cents,
                    data.case.infractions.amount_currency,
                  )}
                  {data.case.infractions.points ? ` · ${data.case.infractions.points} pontos` : ""}
                </p>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Responsabilidade
                </h3>
                {data.case.responsible_party_type ? (
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {data.case.responsible_party_type === "customer" ? "Cliente" : "Operador"}{" "}
                    (confiança:{" "}
                    {data.case.responsibility_confidence
                      ? Math.round(data.case.responsibility_confidence * 100)
                      : "—"}
                    %)
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Ainda não sugerida.</p>
                )}
                {data.case.responsibility_reasons?.length > 0 && (
                  <ul className="mt-1 text-xs text-slate-500 list-disc list-inside">
                    {data.case.responsibility_reasons.map((r, i) => (
                      <li key={i}>{r.reason}</li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(() =>
                        postJson(`/api/infractions/${caseId}/responsibility/suggest`, {}),
                      )
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                  >
                    Sugerir responsável
                  </button>
                  {data.case.responsible_party_type && !data.case.responsibility_confirmed_at && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction(() =>
                            postJson(`/api/infractions/${caseId}/responsibility/confirm`, {}),
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction(() =>
                            postJson(`/api/infractions/${caseId}/responsibility/reject`, {}),
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Prazos
                </h3>
                {data.deadlines.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhum prazo registrado.</p>
                )}
                <ul className="space-y-1">
                  {data.deadlines.map((d) => (
                    <li key={d.id} className="text-sm flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{d.deadline_type}</span>
                      <span
                        className={
                          d.status === "overdue"
                            ? "text-red-600 font-medium"
                            : d.status === "due_soon"
                              ? "text-amber-600 font-medium"
                              : "text-slate-500"
                        }
                      >
                        {d.due_at ? new Date(d.due_at).toLocaleDateString("pt-BR") : "—"} (
                        {d.status})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Contestação</h3>
                <div className="flex gap-2">
                  <input
                    placeholder="Descreva o motivo da contestação"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !disputeReason.trim()}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/infractions/${caseId}/disputes`, {
                          partyType: data.case.responsible_party_type ?? "customer",
                          description: disputeReason,
                        });
                        setDisputeReason("");
                      })
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    Contestar
                  </button>
                </div>
                {data.disputes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.disputes.map((d) => (
                      <li key={d.id} className="text-xs text-slate-500">
                        {d.status} — {d.description}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Pagamento à autoridade
                </h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor pago (R$)"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !paymentAmount}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/infractions/${caseId}/payment`, {
                          kind: "to_authority",
                          amountPaidCents: Math.round(Number(paymentAmount) * 100),
                        });
                        setPaymentAmount("");
                      })
                    }
                    className="px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    Registrar pago
                  </button>
                </div>
                {data.payments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.payments.map((p) => (
                      <li key={p.id} className="text-xs text-slate-500">
                        {p.kind === "to_authority" ? "Pago à autoridade" : "Reembolso"} —{" "}
                        {formatCents(p.amount_paid_cents)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Se a responsabilidade estiver confirmada para um cliente, o reembolso vira fatura
                  automaticamente após o registro do pagamento.
                </p>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Reembolso do responsável
                </h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor reembolsado (R$)"
                    value={reimbursementAmount}
                    onChange={(e) => setReimbursementAmount(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !reimbursementAmount}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/infractions/${caseId}/payment`, {
                          kind: "reimbursement_from_responsible",
                          amountPaidCents: Math.round(Number(reimbursementAmount) * 100),
                        });
                        setReimbursementAmount("");
                      })
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    Registrar reembolso
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Registro manual — cobre tanto reembolso de cliente (fora do ciclo automático de
                  fatura acima) quanto de operador, que não tem fatura/conta de cobrança própria
                  hoje. Nunca gera cobrança automática por conta própria.
                </p>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <UserCog className="w-3.5 h-3.5" /> Indicação de condutor
                </h3>
                <div className="flex gap-2">
                  <input
                    placeholder="Nome do condutor indicado"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !driverName.trim()}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/infractions/${caseId}/driver-identification`, {
                          driverName,
                        });
                        setDriverName("");
                      })
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    Registrar indicação
                  </button>
                </div>
                {data.driverIdentifications.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {data.driverIdentifications.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {d.driver_name ?? (d.operator_id ? "Operador cadastrado" : "—")} —{" "}
                          {DRIVER_ID_STATUS_LABEL[d.status] ?? d.status}
                        </span>
                        <div className="flex gap-1">
                          {d.status === "ready" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(() =>
                                  postJson(
                                    `/api/infractions/${caseId}/driver-identification/${d.id}`,
                                    { status: "submitted" },
                                  ),
                                )
                              }
                              className="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                            >
                              Enviar
                            </button>
                          )}
                          {d.status === "submitted" && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(() =>
                                    postJson(
                                      `/api/infractions/${caseId}/driver-identification/${d.id}`,
                                      { status: "accepted" },
                                    ),
                                  )
                                }
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                              >
                                Aceitar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(() =>
                                    postJson(
                                      `/api/infractions/${caseId}/driver-identification/${d.id}`,
                                      { status: "rejected" },
                                    ),
                                  )
                                }
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <FileWarning className="w-3.5 h-3.5" /> Defesa / Recurso
                </h3>
                <div className="flex gap-2">
                  <select
                    value={defenseKind}
                    onChange={(e) => setDefenseKind(e.target.value as "defense" | "appeal")}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="defense">Defesa prévia</option>
                    <option value="appeal">Recurso</option>
                  </select>
                  <input
                    placeholder="Observações (opcional)"
                    value={defenseNotes}
                    onChange={(e) => setDefenseNotes(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/infractions/${caseId}/defense`, {
                          kind: defenseKind,
                          notes: defenseNotes || undefined,
                        });
                        setDefenseNotes("");
                      })
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    Registrar
                  </button>
                </div>
                {data.defenses.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {data.defenses.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {d.kind === "appeal" ? "Recurso" : "Defesa"} —{" "}
                          {DEFENSE_STATUS_LABEL[d.status] ?? d.status}
                        </span>
                        <div className="flex gap-1">
                          {d.status === "draft" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(() =>
                                  postJson(`/api/infractions/${caseId}/defense/${d.id}`, {
                                    status: "submitted",
                                  }),
                                )
                              }
                              className="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                            >
                              Enviar
                            </button>
                          )}
                          {d.status === "submitted" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(() =>
                                  postJson(`/api/infractions/${caseId}/defense/${d.id}`, {
                                    status: "under_analysis",
                                  }),
                                )
                              }
                              className="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                            >
                              Em análise
                            </button>
                          )}
                          {d.status === "under_analysis" && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(() =>
                                    postJson(`/api/infractions/${caseId}/defense/${d.id}`, {
                                      status: "accepted",
                                    }),
                                  )
                                }
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                              >
                                Aceita
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(() =>
                                    postJson(`/api/infractions/${caseId}/defense/${d.id}`, {
                                      status: "rejected",
                                    }),
                                  )
                                }
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs rounded-md border-0 cursor-pointer disabled:opacity-60"
                              >
                                Rejeitada
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Registro administrativo — nunca protocola automaticamente com uma autoridade
                  pública.
                </p>
              </section>

              {actionError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {actionError}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
