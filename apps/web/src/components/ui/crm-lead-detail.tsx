"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Handshake, Plus, ArrowRightCircle } from "lucide-react";
import { ALLOWED_LEAD_TRANSITIONS, type LeadStatus, type ActivityType } from "@shina/crm-engine";

interface LeadRow {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  source: string;
  status: LeadStatus;
  segment: string | null;
  estimated_fleet_size: number | null;
  estimated_mrr_cents: number | null;
  assigned_to: string | null;
  lost_reason: string | null;
  converted_tenant_id: string | null;
}

interface ActivityRow {
  id: string;
  type: ActivityType;
  description: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  created_by: string;
  created_at: string;
}

interface DetailPayload {
  lead: LeadRow;
  activities: ActivityRow[];
  staffEmails: Record<string, string>;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  note: "Nota",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  status_change: "Mudança de status",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Falha na operação.");
  return json;
}

export function CrmLeadDetail({
  leadId,
  onClose,
  onChange,
}: {
  leadId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activityType, setActivityType] = useState<ActivityType>("note");
  const [activityText, setActivityText] = useState("");
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [pendingLostTarget, setPendingLostTarget] = useState(false);

  const [convertSlug, setConvertSlug] = useState("");
  const [convertEmail, setConvertEmail] = useState("");
  const [convertName, setConvertName] = useState("");

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform-crm/leads/${leadId}`);
      const json = (await res.json()) as { data?: DetailPayload };
      setData(json.data ?? null);
      if (json.data) {
        setConvertSlug((prev) => prev || slugify(json.data!.lead.company_name));
        setConvertEmail((prev) => prev || (json.data!.lead.contact_email ?? ""));
        setConvertName((prev) => prev || json.data!.lead.contact_name);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

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

  if (!leadId) return null;

  const nextStatuses = data ? (ALLOWED_LEAD_TRANSITIONS[data.lead.status] ?? []) : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4 text-shina-blue" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {data?.lead.company_name ?? "Lead"}
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
                  {STATUS_LABEL[data.lead.status]}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {data.lead.contact_name}
                  {data.lead.contact_email ? ` · ${data.lead.contact_email}` : ""}
                  {data.lead.contact_phone ? ` · ${data.lead.contact_phone}` : ""}
                </p>
                {data.lead.segment && (
                  <p className="text-xs text-slate-500 mt-1">Segmento: {data.lead.segment}</p>
                )}
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mt-2">
                  {formatCents(data.lead.estimated_mrr_cents)}
                  {data.lead.estimated_fleet_size
                    ? ` · frota estimada: ${data.lead.estimated_fleet_size}`
                    : ""}
                </p>
                {data.lead.assigned_to && (
                  <p className="text-xs text-slate-500 mt-1">
                    Responsável: {data.staffEmails[data.lead.assigned_to] ?? data.lead.assigned_to}
                  </p>
                )}
                {data.lead.lost_reason && (
                  <p className="text-xs text-red-600 mt-1">
                    Motivo da perda: {data.lead.lost_reason}
                  </p>
                )}
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Avançar status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((target) => (
                    <button
                      key={target}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (target === "lost") {
                          setPendingLostTarget(true);
                          return;
                        }
                        void runAction(() =>
                          patchJson(`/api/platform-crm/leads/${leadId}`, { status: target }),
                        );
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 ${
                        target === "won"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : target === "lost"
                            ? "bg-red-50 hover:bg-red-100 text-red-700"
                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" /> {STATUS_LABEL[target]}
                    </button>
                  ))}
                  {nextStatuses.length === 0 && (
                    <p className="text-sm text-slate-500">Sem transições disponíveis.</p>
                  )}
                </div>

                {pendingLostTarget && (
                  <div className="mt-3 flex gap-2">
                    <input
                      placeholder="Motivo da perda (opcional)"
                      value={lostReasonDraft}
                      onChange={(e) => setLostReasonDraft(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(async () => {
                          await patchJson(`/api/platform-crm/leads/${leadId}`, {
                            status: "lost",
                            lostReason: lostReasonDraft || undefined,
                          });
                          setLostReasonDraft("");
                          setPendingLostTarget(false);
                        })
                      }
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      Confirmar perda
                    </button>
                  </div>
                )}
              </section>

              {data.lead.status === "won" && !data.lead.converted_tenant_id && (
                <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    Converter em tenant
                  </h3>
                  <div className="space-y-2">
                    <input
                      placeholder="slug (ex: minha-locadora)"
                      value={convertSlug}
                      onChange={(e) => setConvertSlug(slugify(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <input
                      placeholder="E-mail do admin do tenant"
                      value={convertEmail}
                      onChange={(e) => setConvertEmail(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <input
                      placeholder="Nome do admin do tenant"
                      value={convertName}
                      onChange={(e) => setConvertName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={busy || !convertSlug || !convertEmail || !convertName}
                      onClick={() =>
                        void runAction(() =>
                          postJson(`/api/platform-crm/leads/${leadId}/convert`, {
                            slug: convertSlug,
                            adminEmail: convertEmail,
                            adminFullName: convertName,
                          }),
                        )
                      }
                      className="w-full px-3 py-2 bg-shina-blue hover:bg-blue-600 text-white text-sm font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                    >
                      Criar tenant a partir deste lead
                    </button>
                  </div>
                </section>
              )}

              {data.lead.converted_tenant_id && (
                <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <p className="text-sm text-emerald-600 font-medium">
                    ✓ Convertido em tenant (id: {data.lead.converted_tenant_id})
                  </p>
                </section>
              )}

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Registrar contato
                </h3>
                <div className="flex gap-2 mb-2">
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as ActivityType)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="note">Nota</option>
                    <option value="call">Ligação</option>
                    <option value="email">E-mail</option>
                    <option value="meeting">Reunião</option>
                  </select>
                  <input
                    placeholder="Descreva o contato..."
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !activityText.trim()}
                    onClick={() =>
                      void runAction(async () => {
                        await postJson(`/api/platform-crm/leads/${leadId}/activities`, {
                          type: activityType,
                          description: activityText,
                        });
                        setActivityText("");
                      })
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> Adicionar
                  </button>
                </div>

                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 mt-4">
                  Histórico
                </h3>
                <ul className="space-y-2">
                  {data.activities.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="text-xs font-medium text-slate-400 uppercase mr-1">
                        {ACTIVITY_TYPE_LABEL[a.type]}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">{a.description}</span>
                      <span className="text-xs text-slate-400 block">
                        {new Date(a.created_at).toLocaleString("pt-BR")} —{" "}
                        {data.staffEmails[a.created_by] ?? a.created_by}
                      </span>
                    </li>
                  ))}
                  {data.activities.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhuma atividade registrada.</p>
                  )}
                </ul>
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
