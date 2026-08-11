"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { X, Clock, User, Car, CheckCircle2, AlertCircle, Play, Ban, Save } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface OperationData {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  description: string | null;
  metadata: Record<string, unknown>;
  resources: { id: string; name: string; type: string; status: string } | null;
  assets: { id: string; name: string; category: string; status: string } | null;
}

interface OperationAction {
  label: string;
  status: string;
  color: string;
  icon: ReactNode;
}

interface OperationDetailProps {
  operationId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

// Status → allowed actions
const ACTIONS: Record<string, OperationAction[]> = {
  pending: [
    {
      label: "Iniciar",
      status: "in_progress",
      color: "bg-shina-blue hover:bg-blue-600 text-white",
      icon: <Play className="w-4 h-4" />,
    },
    {
      label: "Cancelar",
      status: "cancelled",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
      icon: <Ban className="w-4 h-4" />,
    },
  ],
  in_progress: [
    {
      label: "Concluir",
      status: "completed",
      color: "bg-green-600 hover:bg-green-700 text-white",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      label: "Cancelar",
      status: "cancelled",
      color: "bg-slate-100 hover:bg-slate-200 text-slate-700",
      icon: <Ban className="w-4 h-4" />,
    },
    {
      label: "Falhou",
      status: "failed",
      color: "bg-red-100 hover:bg-red-200 text-red-700",
      icon: <AlertCircle className="w-4 h-4" />,
    },
  ],
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const typeLabels: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
};

function opStatusToUi(status: string): "active" | "inactive" | "pending" | "error" | "warning" {
  switch (status) {
    case "in_progress":
      return "active";
    case "pending":
      return "pending";
    case "completed":
      return "inactive";
    case "cancelled":
    case "failed":
      return "warning";
    default:
      return "inactive";
  }
}

function opStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_progress: "Em andamento",
    pending: "Pendente",
    completed: "Concluída",
    cancelled: "Cancelada",
    failed: "Falhou",
  };
  return labels[status] ?? status;
}

export function OperationDetail({ operationId, onClose, onStatusChange }: OperationDetailProps) {
  const [op, setOp] = useState<OperationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [description, setDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);

  useEffect(() => {
    if (!operationId) {
      setOp(null);
      return;
    }
    setLoading(true);
    fetch(`/api/operations/${operationId}`)
      .then((r) => r.json())
      .then((j: { data: OperationData }) => {
        setOp(j.data);
        setDescription(j.data.description ?? "");
      })
      .catch(() => setOp(null))
      .finally(() => setLoading(false));
  }, [operationId]);

  async function handleAction(newStatus: string) {
    if (!operationId) return;
    setActing(true);
    try {
      await fetch(`/api/operations/${operationId}`, {
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

  async function handleSaveDescription() {
    if (!operationId) return;
    setSavingDescription(true);
    setDescriptionSaved(false);
    try {
      await fetch(`/api/operations/${operationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      setOp((prev) => (prev ? { ...prev, description: description || null } : prev));
      setDescriptionSaved(true);
      setTimeout(() => setDescriptionSaved(false), 2000);
    } finally {
      setSavingDescription(false);
    }
  }

  if (!operationId) return null;

  const actions = op ? (ACTIONS[op.status] ?? null) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Detalhe da Operação</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !op ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Type + Status */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tipo</p>
                  <p className="text-lg font-bold text-slate-900">
                    {typeLabels[op.type] ?? op.type}
                  </p>
                </div>
                <StatusBadge status={opStatusToUi(op.status)} label={opStatusLabel(op.status)} />
              </div>

              {/* Schedule */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Início previsto</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDateTime(op.scheduled_starts_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Fim previsto</span>
                  <span className="ml-auto font-medium text-slate-900">
                    {formatDateTime(op.scheduled_ends_at)}
                  </span>
                </div>
                {op.started_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Play className="w-4 h-4 text-shina-blue" />
                    <span className="text-slate-500">Iniciada em</span>
                    <span className="ml-auto font-medium text-shina-blue">
                      {formatDateTime(op.started_at)}
                    </span>
                  </div>
                )}
                {op.completed_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-slate-500">Concluída em</span>
                    <span className="ml-auto font-medium text-green-600">
                      {formatDateTime(op.completed_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Asset */}
              {op.assets && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Ativo</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-shina-blue/10 flex items-center justify-center">
                      <Car className="w-4 h-4 text-shina-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{op.assets.name}</p>
                      <p className="text-xs text-slate-500">{op.assets.category}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resource (frota) */}
              {op.resources && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Recurso de frota</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-shina-blue/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-shina-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{op.resources.name}</p>
                      <p className="text-xs text-slate-500">{op.resources.type}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Descrição — o que foi feito
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Registre aqui detalhes ou o resultado desta operação..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-shina-blue/40"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDescription()}
                    disabled={savingDescription || description === (op.description ?? "")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingDescription ? "Salvando..." : "Salvar descrição"}
                  </button>
                  {descriptionSaved && (
                    <span className="text-xs text-green-600 font-medium">Salvo!</span>
                  )}
                </div>
              </div>

              {/* Created */}
              <div>
                <p className="text-xs text-slate-500">Criada em</p>
                <p className="text-sm text-slate-700 mt-0.5">{formatDateTime(op.created_at)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {op && actions && (
          <div className="px-6 py-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-medium text-slate-500 mb-3">Ações disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => void handleAction(action.status)}
                  disabled={acting}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${action.color}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {op && !actions && (
          <div className="px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Esta operação está em estado terminal e não pode ser alterada.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
