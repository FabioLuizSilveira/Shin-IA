"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Copy, Check, RefreshCw, MapPin, Plus, Shield, X } from "lucide-react";
import type { FleetMapPoint } from "@/components/ui/fleet-map";

const FleetMap = dynamic(() => import("@/components/ui/fleet-map").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
  ),
});

interface Integration {
  id: string;
  provider_name: string | null;
  webhook_token: string;
  webhook_secret: string;
  webhookUrl: string;
  is_active: boolean;
  last_received_at: string | null;
}

interface Geofence {
  id: string;
  name: string;
  shape: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  resource_ids: string[];
  status: "active" | "inactive";
}

interface ResourceOption {
  id: string;
  name: string;
}

export default function TrackingPage() {
  const [points, setPoints] = useState<FleetMapPoint[]>([]);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [saving, setSaving] = useState(false);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);
  const [gfName, setGfName] = useState("");
  const [gfLat, setGfLat] = useState("");
  const [gfLng, setGfLng] = useState("");
  const [gfRadius, setGfRadius] = useState("500");
  const [gfResourceId, setGfResourceId] = useState("");
  const [gfSaving, setGfSaving] = useState(false);

  const loadGeofences = useCallback(async () => {
    const res = await fetch("/api/geofences");
    const json = (await res.json()) as { data?: Geofence[] };
    setGeofences(json.data ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pointsRes, integrationRes, resourcesRes] = await Promise.all([
        fetch("/api/resources/locations"),
        fetch("/api/tenant-settings/fleet-integration"),
        fetch("/api/resources"),
      ]);
      const pointsJson = (await pointsRes.json()) as { data?: FleetMapPoint[] };
      const integrationJson = (await integrationRes.json()) as { data?: Integration };
      const resourcesJson = (await resourcesRes.json()) as { data?: ResourceOption[] };
      setPoints(pointsJson.data ?? []);
      setResources(resourcesJson.data ?? []);
      if (integrationJson.data) {
        setIntegration(integrationJson.data);
        setProviderName(integrationJson.data.provider_name ?? "");
      }
      await loadGeofences();
    } finally {
      setLoading(false);
    }
  }, [loadGeofences]);

  async function handleCreateGeofence(e: React.FormEvent) {
    e.preventDefault();
    setGfSaving(true);
    try {
      const res = await fetch("/api/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: gfName,
          shape: "circle",
          center_lat: Number(gfLat),
          center_lng: Number(gfLng),
          radius_meters: Number(gfRadius),
          resource_ids: gfResourceId ? [gfResourceId] : [],
        }),
      });
      if (res.ok) {
        setShowGeofenceForm(false);
        setGfName("");
        setGfLat("");
        setGfLng("");
        setGfRadius("500");
        setGfResourceId("");
        await loadGeofences();
      }
    } finally {
      setGfSaving(false);
    }
  }

  async function handleToggleGeofence(gf: Geofence) {
    await fetch(`/api/geofences/${gf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: gf.status === "active" ? "inactive" : "active" }),
    });
    await loadGeofences();
  }

  async function handleDeleteGeofence(id: string) {
    await fetch(`/api/geofences/${id}`, { method: "DELETE" });
    await loadGeofences();
  }

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCopy() {
    if (!integration) return;
    await navigator.clipboard.writeText(integration.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopySecret() {
    if (!integration) return;
    await navigator.clipboard.writeText(integration.webhook_secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  async function handleRegenerateSecret() {
    if (
      !confirm(
        "Gerar um novo segredo invalida a assinatura configurada no provedor atual. Continuar?",
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenant-settings/fleet-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_secret: true }),
      });
      const json = (await res.json()) as { data?: Integration };
      if (json.data) setIntegration(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProvider() {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant-settings/fleet-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_name: providerName }),
      });
      const json = (await res.json()) as { data?: Integration };
      if (json.data) setIntegration(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!integration) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenant-settings/fleet-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !integration.is_active }),
      });
      const json = (await res.json()) as { data?: Integration };
      if (json.data) setIntegration(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("Gerar um novo token invalida a URL atual. Continuar?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenant-settings/fleet-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate_token: true }),
      });
      const json = (await res.json()) as { data?: Integration };
      if (json.data) setIntegration(json.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Mapa da Frota">
      <SectionHeader
        title="Rastreamento"
        description="Posição em tempo real dos veículos e recursos do seu tenant."
      />

      {loading ? (
        <div className="h-96 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden h-[520px]">
            {points.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Nenhuma posição recebida ainda
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Configure a integração ao lado para começar a receber localizações do seu provedor
                  de rastreamento.
                </p>
              </div>
            ) : (
              <FleetMap points={points} />
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Integração de rastreamento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shinã não fornece hardware de rastreamento. Aponte o provedor de GPS que seu tenant
                já usa para a URL abaixo.
              </p>
            </div>

            {integration && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    URL do webhook
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={integration.webhookUrl}
                      className="flex-1 min-w-0 px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    POST JSON: <code>{`{ resource_id, latitude, longitude }`}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Segredo de assinatura (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      type="password"
                      value={integration.webhook_secret}
                      className="flex-1 min-w-0 px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopySecret()}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      {copiedSecret ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se seu provedor suportar, configure-o para enviar o header{" "}
                    <code>X-Signature</code> com o HMAC-SHA256 (hex) do corpo da requisição usando
                    este segredo — fecha a URL contra reuso do token sozinho.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRegenerateSecret()}
                    disabled={saving}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerar segredo
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Nome do provedor
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="Ex: Sascar, Onixsat..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveProvider()}
                      disabled={saving}
                      className="px-3 py-2 text-xs font-semibold bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg border-0 cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Integração {integration.is_active ? "ativa" : "desativada"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {integration.last_received_at
                        ? `Última posição recebida ${new Date(integration.last_received_at).toLocaleString("pt-BR")}`
                        : "Nenhuma posição recebida ainda"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive()}
                    disabled={saving}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-0 cursor-pointer disabled:opacity-60 ${
                      integration.is_active
                        ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400"
                        : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400"
                    }`}
                  >
                    {integration.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerar token
                </button>
              </>
            )}
          </div>

          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cercas Virtuais
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeofenceForm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Cerca
              </button>
            </div>

            {showGeofenceForm && (
              <form
                onSubmit={(e) => void handleCreateGeofence(e)}
                className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 grid grid-cols-2 md:grid-cols-5 gap-2 items-end"
              >
                <input
                  required
                  placeholder="Nome"
                  value={gfName}
                  onChange={(e) => setGfName(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={gfLat}
                  onChange={(e) => setGfLat(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={gfLng}
                  onChange={(e) => setGfLng(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <input
                  required
                  type="number"
                  placeholder="Raio (m)"
                  value={gfRadius}
                  onChange={(e) => setGfRadius(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={gfResourceId}
                  onChange={(e) => setGfResourceId(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione o recurso monitorado</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={gfSaving}
                    className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Criar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGeofenceForm(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {geofences.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                Nenhuma cerca virtual configurada. Crie uma para receber alertas quando um recurso
                entrar ou sair de uma área.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {geofences.map((gf) => (
                  <li key={gf.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {gf.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {gf.shape === "circle"
                          ? `Círculo de ${gf.radius_meters}m em ${gf.center_lat}, ${gf.center_lng}`
                          : "Polígono"}{" "}
                        · {gf.resource_ids.length} recurso(s) monitorado(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleGeofence(gf)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border-0 cursor-pointer ${
                          gf.status === "active"
                            ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {gf.status === "active" ? "Ativa" : "Inativa"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteGeofence(gf.id)}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
