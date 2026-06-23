"use client";

import { useState, useEffect } from "react";
import { User2, Truck, Wrench, Cpu, Users2, Plus, X } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { ResourceDetail } from "@/components/ui/resource-detail";
import type { Resource, ResourceType, ResourceStatus } from "@/types/domain";

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

type FilterType = "all" | ResourceType;

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ResourceType>("human");
  const [formStatus, setFormStatus] = useState<ResourceStatus>("available");

  async function fetchResources() {
    setLoading(true);
    try {
      const res = await fetch("/api/resources");
      if (!res.ok) throw new Error("Falha ao carregar recursos");
      const json = (await res.json()) as { data: Resource[] };
      setResources(json.data ?? []);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchResources();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType, status: formStatus }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar recurso");
      }
      setShowForm(false);
      setFormName("");
      setFormType("human");
      setFormStatus("available");
      await fetchResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar recurso");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = filter === "all" ? resources : resources.filter((r) => r.type === filter);

  const availableCount = resources.filter((r) => r.status === "available").length;
  const busyCount = resources.filter((r) => r.status === "busy").length;
  const maintenanceOfflineCount = resources.filter(
    (r) => r.status === "maintenance" || r.status === "offline",
  ).length;

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "human", label: "Humano" },
    { value: "vehicle", label: "Veículo" },
    { value: "equipment", label: "Equipamento" },
    { value: "virtual", label: "Virtual" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Recursos Operacionais</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie pessoas, veículos, equipamentos e recursos virtuais.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
          >
            <Plus className="w-4 h-4" />
            Novo Recurso
          </button>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Recursos"
          value={resources.length}
          icon={<Users2 className="w-5 h-5" />}
          trend="neutral"
        />
        <MetricCard
          title="Disponíveis"
          value={availableCount}
          icon={<User2 className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Ocupados"
          value={busyCount}
          icon={<Truck className="w-5 h-5" />}
          trend="neutral"
        />
        <MetricCard
          title="Manutenção / Offline"
          value={maintenanceOfflineCount}
          icon={<Wrench className="w-5 h-5" />}
          trend={maintenanceOfflineCount > 0 ? "down" : "neutral"}
        />
      </div>

      {/* New resource form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Novo Recurso</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: João Motorista"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ResourceType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="human">Humano</option>
                <option value="vehicle">Veículo</option>
                <option value="equipment">Equipamento</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ResourceStatus)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="available">Disponível</option>
                <option value="busy">Ocupado</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-shina-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer border-0"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border-0"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0 ${
              filter === opt.value
                ? "bg-shina-blue text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Resource grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum recurso encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((resource) => {
            const TypeIcon = typeIcons[resource.type];
            return (
              <div
                key={resource.id}
                className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-shina-blue/10 flex items-center justify-center shrink-0">
                      <TypeIcon className="w-5 h-5 text-shina-blue" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {resource.name}
                      </p>
                      <p className="text-xs text-slate-500">{typeLabels[resource.type]}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[resource.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDots[resource.status]}`} />
                    {statusLabels[resource.status]}
                  </span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setSelectedId(resource.id)}
                    className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer px-0"
                  >
                    Ver detalhes →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <ResourceDetail
        resourceId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChange={() => void fetchResources()}
      />
    </div>
  );
}
