"use client";

import { useState } from "react";
import { canTransitionLead, type LeadStatus } from "@shina/crm-engine";

interface LeadCard {
  id: string;
  company_name: string;
  contact_name: string;
  estimated_mrr_cents: number | null;
  status: LeadStatus;
  [key: string]: unknown;
}

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "new", label: "Novo" },
  { status: "contacted", label: "Contatado" },
  { status: "qualified", label: "Qualificado" },
  { status: "proposal", label: "Proposta" },
  { status: "negotiation", label: "Negociação" },
  { status: "won", label: "Ganho" },
  { status: "lost", label: "Perdido" },
];

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new: "border-t-slate-300 dark:border-t-slate-600",
  contacted: "border-t-blue-300",
  qualified: "border-t-indigo-300",
  proposal: "border-t-amber-300",
  negotiation: "border-t-orange-400",
  won: "border-t-emerald-400",
  lost: "border-t-red-400",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Kanban puro (sem lib de drag-and-drop) sobre a API HTML5 nativa de
// arrastar-e-soltar -- sem dependência nova pra uma tela só. O board é só
// uma segunda forma de visualizar/mover os mesmos leads da lista; toda
// mudança de status ainda passa pela mesma rota PATCH que já valida via
// canTransitionLead() no servidor (item central: nunca confiar só na UI
// pra impor a regra -- aqui a checagem client-side é só uma prévia
// otimista, pra não deixar o card cair numa coluna que o servidor vai
// rejeitar de qualquer jeito).
export function CrmKanbanBoard({
  leads,
  onSelect,
  onMove,
}: {
  leads: LeadCard[];
  onSelect: (id: string) => void;
  onMove: (id: string, from: LeadStatus, to: LeadStatus) => Promise<void>;
}) {
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const byColumn = COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((l) => l.status === col.status),
  }));

  async function handleDrop(e: React.DragEvent, target: LeadStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData("text/lead-id");
    const from = e.dataTransfer.getData("text/lead-status") as LeadStatus;
    if (!leadId || !from || from === target) return;

    if (!canTransitionLead(from, target)) {
      setMoveError(`Não é possível mover de "${from}" para "${target}".`);
      return;
    }

    setMoveError(null);
    setMovingId(leadId);
    try {
      await onMove(leadId, from, target);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Falha ao mover o lead.");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div>
      {moveError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {moveError}
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {byColumn.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(col.status);
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === col.status ? null : c))}
            onDrop={(e) => void handleDrop(e, col.status)}
            className={`shrink-0 w-64 rounded-xl border-t-4 ${COLUMN_ACCENT[col.status]} bg-slate-50 dark:bg-white/5 ${
              dragOverColumn === col.status ? "ring-2 ring-shina-blue" : ""
            }`}
          >
            <div className="px-3 py-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                {col.label}
              </h3>
              <span className="text-xs text-slate-400">{col.leads.length}</span>
            </div>
            <div className="px-2 pb-2 space-y-2 min-h-[80px]">
              {col.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    e.dataTransfer.setData("text/lead-status", lead.status);
                  }}
                  onClick={() => onSelect(lead.id)}
                  className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                    movingId === lead.id ? "opacity-50" : ""
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {lead.company_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{lead.contact_name}</p>
                  <p className="text-xs text-shina-blue font-medium mt-1">
                    {formatCents(lead.estimated_mrr_cents)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
