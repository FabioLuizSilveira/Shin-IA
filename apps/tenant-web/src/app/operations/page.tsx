"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Zap, MapPin, User } from "lucide-react";

const OPERATIONS = [
  {
    id: "OP-0042",
    name: "Entrega São Paulo — Centro",
    asset: "ABC-1234",
    assetName: "Scania R450",
    operator: "João Silva",
    status: "active" as const,
    time: "08:30",
    value: "R$ 4.200",
    origin: "Curitiba",
    dest: "São Paulo",
  },
  {
    id: "OP-0043",
    name: "Coleta Porto Alegre",
    asset: "MNO-2233",
    assetName: "Volvo FH 540",
    operator: "Carlos Ferreira",
    status: "pending" as const,
    time: "10:00",
    value: "R$ 3.800",
    origin: "Porto Alegre",
    dest: "Curitiba",
  },
  {
    id: "OP-0044",
    name: "Transporte Industrial ABC",
    asset: "PQR-4455",
    assetName: "Mercedes Actros",
    operator: "Maria Santos",
    status: "pending" as const,
    time: "14:00",
    value: "R$ 7.100",
    origin: "Joinville",
    dest: "Blumenau",
  },
  {
    id: "OP-0040",
    name: "Entrega Urgente Florianópolis",
    asset: "GHI-9012",
    assetName: "Scania P320",
    operator: "Pedro Costa",
    status: "inactive" as const,
    time: "ontem",
    value: "R$ 2.900",
    origin: "Curitiba",
    dest: "Florianópolis",
  },
  {
    id: "OP-0039",
    name: "Rota Balneário Camboriú",
    asset: "JKL-3456",
    assetName: "Volvo FH 460",
    operator: "Ana Lima",
    status: "inactive" as const,
    time: "ontem",
    value: "R$ 5.600",
    origin: "Porto Alegre",
    dest: "Balneário Camboriú",
  },
];

const FILTERS = ["Todas", "Em rota", "Pendentes", "Concluídas"];

const filterFn = (op: (typeof OPERATIONS)[number], filter: string) => {
  if (filter === "Todas") return true;
  if (filter === "Em rota") return op.status === "active";
  if (filter === "Pendentes") return op.status === "pending";
  if (filter === "Concluídas") return op.status === "inactive";
  return true;
};

export default function OperationsPage() {
  const [activeFilter, setActiveFilter] = useState("Todas");

  const filtered = OPERATIONS.filter((op) => filterFn(op, activeFilter));

  return (
    <AppShell title="Operações">
      <SectionHeader
        title="Operações"
        description="Gestão em tempo real de todas as operações logísticas."
      />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              activeFilter === f
                ? "bg-shina-blue text-white border-shina-blue"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Operation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((op) => (
          <div
            key={op.id}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-mono text-slate-400 mb-0.5">{op.id}</p>
                <p className="text-sm font-semibold text-slate-900">{op.name}</p>
              </div>
              <StatusBadge
                status={op.status}
                label={
                  op.status === "active"
                    ? "Em rota"
                    : op.status === "pending"
                      ? "Pendente"
                      : "Concluída"
                }
              />
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {op.assetName} — {op.asset}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{op.operator}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {op.origin} → {op.dest}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
              <span className="text-sm font-semibold text-slate-800">{op.value}</span>
              <span className="text-xs text-slate-400">{op.time}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
