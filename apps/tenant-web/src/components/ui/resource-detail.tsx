"use client";

import { useState, useEffect } from "react";
import { X, User2, Truck, Wrench, Cpu, Calendar } from "lucide-react";
import type {
  ResourceDetail as ResourceDetailData,
  ResourceStatus,
  ResourceType,
} from "@/types/domain";

interface ResourceDetailProps {
  resourceId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

const typeLabels: Record<ResourceType, string> = {
  human: "Humano",
  vehicle: "Veículo",
  equipment: "Equipamento",
  virtual: "Virtual",
};

const typeIcons: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  human: User2,
  vehicle: Truck,
  equipment: Wrench,
  virtual: Cpu,
};

const statusLabels: Record<ResourceStatus, string> = {
  available: "Disponível",
  busy: "Ocupado",
  offline: "Offline",
  maintenance: "Manutenção",
};

const statusColors: Record<ResourceStatus, string> = {
  available: "bg-emerald-50 text-emerald-700",
  busy: "bg-blue-50 text-blue-700",
  offline: "bg-slate-100 text-slate-600",
  maintenance: "bg-amber-50 text-amber-700",
};

const statusDots: Record<ResourceStatus, string> = {
  available: "bg-emerald-500",
  busy: "bg-blue-500",
  offline: "bg-slate-400",
  maintenance: "bg-amber-400",
};

const changeButtonColors: Record<ResourceStatus, string> = {
  available: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
  busy: "bg-blue-100 hover:bg-blue-200 text-blue-700",
  offline: "bg-slate-100 hover:bg-slate-200 text-slate-600",
  maintenance: "bg-amber-100 hover:bg-amber-200 text-amber-700",
};

const operationStatusLabels: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

const operationTypeLabels: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ResourceDetail({ resourceId, onClose, onStatusChange }: ResourceDetailProps) {
  const [resource, setResource] = useState<ResourceDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!resourceId) {
      setResource(null);
      return;
    }
    setLoading(true);
    fetch(`/api/resources/${resourceId}`)
      .then((r) => r.json())
      .then((j: { data: ResourceDetailData }) => setResource(j.data))
      .catch(() => setResource(null))
      .finally(() => setLoading(false));
  }, [resourceId]);

  async function handleStatusChange(newStatus: ResourceStatus) {
    if (!resourceId) return;
    setActing(true);
    try {
      await fetch(`/api/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange();
      onClose();
    } finally {
      setActing(false);
    }
  }

  if (!resourceId) return null;

  const TypeIcon = resource ? typeIcons[resource.type] : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Detalhe do Recurso</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !resource ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Name + Type icon */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-shina-blue/10 flex items-center justify-center shrink-0">
                  {TypeIcon && <TypeIcon className="w-6 h-6 text-shina-blue" />}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{resource.name}</p>
                  <p className="text-sm text-slate-500">{typeLabels[resource.type]}</p>
                </div>
              </div>

              {/* Status badge */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Status atual</p>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${statusColors[resource.status]}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusDots[resource.status]}`} />
                  {statusLabels[resource.status]}
                </span>
              </div>

              {/* Dates */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Cadastrado em</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDate(resource.created_at)}
                  </span>
                </div>
              </div>

              {/* Recent operations */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-3">Operações recentes</p>
                {resource.recent_operations.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Nenhuma operação recente
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resource.recent_operations.map((op) => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {operationTypeLabels[op.type] ?? op.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(op.scheduled_starts_at)}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-slate-600 ml-2 shrink-0">
                          {operationStatusLabels[op.status] ?? op.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status change actions */}
        {resource && (
          <div className="px-6 py-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-3">Alterar status</p>
            <div className="flex flex-wrap gap-2">
              {(["available", "busy", "offline", "maintenance"] as ResourceStatus[])
                .filter((s) => s !== resource.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleStatusChange(s)}
                    disabled={acting}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer border-0 ${changeButtonColors[s]}`}
                  >
                    Marcar como {statusLabels[s]}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
