import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Truck, Plus, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

const ASSETS = [
  {
    id: "VEI-001",
    plate: "ABC-1234",
    name: "Scania R450",
    type: "Caminhão Toco",
    status: "active" as const,
    location: "Rodovia BR-116, km 42",
    fuel: 78,
    year: 2022,
  },
  {
    id: "VEI-002",
    plate: "DEF-5678",
    name: "Volvo FH 540",
    type: "Caminhão Truck",
    status: "warning" as const,
    location: "Base Curitiba",
    fuel: 45,
    year: 2021,
  },
  {
    id: "VEI-003",
    plate: "GHI-9012",
    name: "Mercedes Actros",
    type: "Carreta",
    status: "inactive" as const,
    location: "São Paulo — Destino",
    fuel: 92,
    year: 2023,
  },
  {
    id: "VEI-004",
    plate: "JKL-3456",
    name: "Scania P320",
    type: "Caminhão Toco",
    status: "inactive" as const,
    location: "Base Curitiba",
    fuel: 61,
    year: 2020,
  },
  {
    id: "VEI-005",
    plate: "MNO-2233",
    name: "Volvo FH 460",
    type: "Carreta",
    status: "active" as const,
    location: "Rodovia BR-376, km 89",
    fuel: 55,
    year: 2022,
  },
  {
    id: "VEI-006",
    plate: "PQR-4455",
    name: "DAF XF 480",
    type: "Caminhão Truck",
    status: "error" as const,
    location: "Oficina Parceira Blumenau",
    fuel: 20,
    year: 2019,
  },
];

export default function AssetsPage() {
  return (
    <AppShell title="Frota & Ativos">
      <SectionHeader
        title="Frota & Ativos"
        description="Gerencie toda sua frota em um único lugar."
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0">
            <Plus className="w-4 h-4" />
            Novo Ativo
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Ativos" value="6" icon={<Truck className="w-5 h-5" />} />
        <MetricCard title="Em rota" value="2" trend="up" icon={<Truck className="w-5 h-5" />} />
        <MetricCard
          title="Manutenção"
          value="1"
          trend="down"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard title="Disponíveis" value="3" trend="up" icon={<Truck className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ASSETS.map((asset) => (
          <div
            key={asset.id}
            className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            {/* Header */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-slate-400">{asset.plate}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.name}</p>
              </div>
              <StatusBadge
                status={asset.status}
                label={
                  asset.status === "active"
                    ? "Em rota"
                    : asset.status === "warning"
                      ? "Manutenção"
                      : asset.status === "error"
                        ? "Inoperante"
                        : "Disponível"
                }
              />
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-xs text-slate-400 mb-3">
                {asset.type} · {asset.year}
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{asset.location}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Combustível</span>
                  <span className="text-xs font-semibold text-slate-600">{asset.fuel}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${asset.fuel > 50 ? "bg-emerald-500" : asset.fuel > 25 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${asset.fuel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
