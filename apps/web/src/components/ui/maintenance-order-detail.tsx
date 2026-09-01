"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Wrench, Plus, ArrowRightCircle } from "lucide-react";
import { ALLOWED_ORDER_TRANSITIONS, type MaintenanceOrderStatus } from "@shina/maintenance-engine";

interface OrderRow {
  id: string;
  type: string;
  status: MaintenanceOrderStatus;
  opened_at: string;
  description: string;
  diagnosis: string | null;
  cause: string | null;
  resolution: string | null;
  labor_cost_cents: number;
  parts_cost_cents: number;
  other_cost_cents: number;
  total_cost_cents: number;
  assets: { id: string; name: string } | null;
  organizations: { id: string; name: string } | null;
}

interface ItemRow {
  id: string;
  component: string;
  service_type: string;
  description: string;
  unit_cost_cents: number | null;
}

interface DetailPayload {
  order: OrderRow;
  items: ItemRow[];
  documents: unknown[];
}

const STATUS_LABEL: Record<MaintenanceOrderStatus, string> = {
  scheduled: "Agendada",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

export function MaintenanceOrderDetail({
  orderId,
  onClose,
  onChange,
}: {
  orderId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [otherCost, setOtherCost] = useState("");

  const [itemComponent, setItemComponent] = useState("");
  const [itemServiceType, setItemServiceType] = useState("");
  const [itemDescription, setItemDescription] = useState("");

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/maintenance/${orderId}`);
      const json = (await res.json()) as { data?: DetailPayload };
      setData(json.data ?? null);
      if (json.data) {
        setLaborCost(String(json.data.order.labor_cost_cents / 100));
        setPartsCost(String(json.data.order.parts_cost_cents / 100));
        setOtherCost(String(json.data.order.other_cost_cents / 100));
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

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

  if (!orderId) return null;

  const nextStatuses = data ? (ALLOWED_ORDER_TRANSITIONS[data.order.status] ?? []) : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-shina-blue" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {data?.order.assets?.name ?? "Manutenção"}
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
                  {STATUS_LABEL[data.order.status]}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {data.order.description}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Aberta em {new Date(data.order.opened_at).toLocaleString("pt-BR")}
                  {data.order.organizations ? ` · ${data.order.organizations.name}` : ""}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mt-2">
                  {formatCents(data.order.total_cost_cents)}
                </p>
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
                      onClick={() =>
                        void runAction(() =>
                          patchJson(`/api/maintenance/${orderId}`, { status: target }),
                        )
                      }
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 ${
                        target === "completed"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : target === "cancelled"
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
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Custos</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mão de obra (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={laborCost}
                      onChange={(e) => setLaborCost(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Peças (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={partsCost}
                      onChange={(e) => setPartsCost(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Outros (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={otherCost}
                      onChange={(e) => setOtherCost(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      patchJson(`/api/maintenance/${orderId}`, {
                        laborCostCents: Math.round(Number(laborCost || 0) * 100),
                        partsCostCents: Math.round(Number(partsCost || 0) * 100),
                        otherCostCents: Math.round(Number(otherCost || 0) * 100),
                      }),
                    )
                  }
                  className="mt-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60"
                >
                  Salvar custos
                </button>
              </section>

              <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Itens executados
                </h3>
                <div className="space-y-2 mb-2">
                  <div className="flex gap-2">
                    <input
                      placeholder="Componente"
                      value={itemComponent}
                      onChange={(e) => setItemComponent(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <input
                      placeholder="Tipo de serviço"
                      value={itemServiceType}
                      onChange={(e) => setItemServiceType(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Descrição"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !itemComponent.trim() ||
                        !itemServiceType.trim() ||
                        !itemDescription.trim()
                      }
                      onClick={() =>
                        void runAction(async () => {
                          await postJson(`/api/maintenance/${orderId}/items`, {
                            component: itemComponent,
                            serviceType: itemServiceType,
                            description: itemDescription,
                          });
                          setItemComponent("");
                          setItemServiceType("");
                          setItemDescription("");
                        })
                      }
                      className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> Adicionar
                    </button>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {data.items.map((item) => (
                    <li key={item.id} className="text-sm flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-200">
                        {item.component} — {item.service_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatCents(item.unit_cost_cents)}
                      </span>
                    </li>
                  ))}
                  {data.items.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhum item registrado.</p>
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
