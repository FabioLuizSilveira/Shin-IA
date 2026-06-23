"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Truck, Plus } from "lucide-react";
import type { Asset, AssetCategory, AssetStatus, AssetType } from "@/types/domain";

function assetStatusToUi(status: AssetStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "in_use":
      return "active";
    case "available":
      return "inactive";
    case "maintenance":
      return "warning";
    case "decommissioned":
      return "inactive";
    default:
      return "inactive";
  }
}

function assetStatusLabel(status: AssetStatus): string {
  switch (status) {
    case "in_use":
      return "Em uso";
    case "available":
      return "Disponível";
    case "maintenance":
      return "Manutenção";
    case "decommissioned":
      return "Desativado";
    default:
      return status;
  }
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  vehicle: "Veículo",
  equipment: "Equipamento",
  tool: "Ferramenta",
  property: "Imóvel",
  technology: "Tecnologia",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formCategory, setFormCategory] = useState<AssetCategory>("vehicle");
  const [formAssetType, setFormAssetType] = useState("");

  async function fetchAssets() {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      if (!res.ok) throw new Error("Falha ao carregar ativos");
      const json = (await res.json()) as { data: Asset[] };
      setAssets(json.data ?? []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }

  async function fetchAssetTypes() {
    try {
      const res = await fetch("/api/asset-types");
      if (!res.ok) return;
      const json = (await res.json()) as { data: AssetType[] };
      setAssetTypes(json.data ?? []);
    } catch {
      // keep empty
    }
  }

  useEffect(() => {
    void fetchAssets();
    void fetchAssetTypes();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          serial_number: formSerial || undefined,
          category: formCategory,
          asset_type_id: formAssetType,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao criar ativo");
      }
      setShowForm(false);
      setFormName("");
      setFormSerial("");
      setFormCategory("vehicle");
      setFormAssetType("");
      await fetchAssets();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar ativo");
    } finally {
      setSubmitting(false);
    }
  }

  const availableCount = assets.filter((a) => a.status === "available").length;
  const inUseCount = assets.filter((a) => a.status === "in_use").length;
  const maintenanceCount = assets.filter((a) => a.status === "maintenance").length;

  return (
    <AppShell title="Frota & Ativos">
      <SectionHeader
        title="Frota & Ativos"
        description="Gerencie toda sua frota em um único lugar."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-0"
            >
              <Plus className="w-4 h-4" />
              Novo Ativo
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-slate-900 mb-4">Novo Ativo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Caminhão ABC-1234"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Número de série
              </label>
              <input
                type="text"
                value={formSerial}
                onChange={(e) => setFormSerial(e.target.value)}
                placeholder="Ex: ABC-1234"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="vehicle">Veículo</option>
                <option value="equipment">Equipamento</option>
                <option value="tool">Ferramenta</option>
                <option value="property">Imóvel</option>
                <option value="technology">Tecnologia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formAssetType}
                onChange={(e) => setFormAssetType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-white"
              >
                <option value="">Selecione um tipo</option>
                {assetTypes.map((at) => (
                  <option key={at.id} value={at.id}>
                    {at.name}
                  </option>
                ))}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Ativos"
          value={String(assets.length)}
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Em uso"
          value={String(inUseCount)}
          trend="up"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Manutenção"
          value={String(maintenanceCount)}
          trend="down"
          icon={<Truck className="w-5 h-5" />}
        />
        <MetricCard
          title="Disponíveis"
          value={String(availableCount)}
          trend="up"
          icon={<Truck className="w-5 h-5" />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-pulse"
            >
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 h-14" />
              <div className="p-5 space-y-3">
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.length === 0 ? (
            <p className="text-slate-400 text-sm col-span-3 py-8 text-center">
              Nenhum ativo encontrado.
            </p>
          ) : (
            assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    {asset.serial_number && (
                      <p className="text-xs font-mono text-slate-400">{asset.serial_number}</p>
                    )}
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.name}</p>
                  </div>
                  <StatusBadge
                    status={assetStatusToUi(asset.status)}
                    label={assetStatusLabel(asset.status)}
                  />
                </div>

                <div className="p-5">
                  <p className="text-xs text-slate-400 mb-3">
                    {asset.type_name ?? CATEGORY_LABELS[asset.category]} ·{" "}
                    {CATEGORY_LABELS[asset.category]}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}
