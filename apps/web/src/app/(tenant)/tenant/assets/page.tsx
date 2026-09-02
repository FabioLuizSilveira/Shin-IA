"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { Plus, X, ImageIcon, Upload, Download } from "lucide-react";
import type { Asset, AssetCategory, AssetStatus } from "@/types/domain";

interface AssetType {
  id: string;
  name: string;
  category: AssetCategory;
}

interface ImportResult {
  created: number;
  totalRows: number;
  errors: { line: number; error: string }[];
}

type AssetRow = Asset & Record<string, unknown>;

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  vehicle: "Veículo",
  equipment: "Equipamento",
  tool: "Ferramenta",
  property: "Imóvel",
  technology: "Tecnologia",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  available: "Disponível",
  in_use: "Em uso",
  maintenance: "Manutenção",
  decommissioned: "Desativado",
};

const STATUS_OPTIONS: AssetStatus[] = ["available", "in_use", "maintenance", "decommissioned"];

interface HealthScoreData {
  version: number;
  score: number;
  band: "healthy" | "attention" | "critical";
  deductions: {
    overduePreventive: number;
    correctiveFrequency: number;
    downtime: number;
    staleOpenOrders: number;
  };
}

const HEALTH_BAND_LABEL: Record<HealthScoreData["band"], string> = {
  healthy: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
};

const HEALTH_BAND_CLASS: Record<HealthScoreData["band"], string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  attention: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

interface AnomalyData {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
}

const ANOMALY_SEVERITY_CLASS: Record<AnomalyData["severity"], string> = {
  low: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  medium: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  high: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

interface RecommendationData {
  id: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "accepted" | "dismissed";
}

interface PredictiveRiskData {
  score: number;
  tier: "low" | "moderate" | "elevated" | "high";
  disclaimer: string;
}

const RISK_TIER_LABEL: Record<PredictiveRiskData["tier"], string> = {
  low: "Baixo",
  moderate: "Moderado",
  elevated: "Elevado",
  high: "Alto",
};

const RISK_TIER_CLASS: Record<PredictiveRiskData["tier"], string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  elevated: "text-orange-600 dark:text-orange-400",
  high: "text-red-600 dark:text-red-400",
};

function statusToUi(status: AssetStatus): "active" | "inactive" | "pending" | "warning" {
  switch (status) {
    case "available":
      return "active";
    case "in_use":
      return "pending";
    case "maintenance":
      return "warning";
    case "decommissioned":
      return "inactive";
  }
}

export default function TenantAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null);
  const [healthScoreLoading, setHealthScoreLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyData[] | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData[] | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [predictiveRisk, setPredictiveRisk] = useState<PredictiveRiskData | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<AssetCategory>("vehicle");
  const [formTypeId, setFormTypeId] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      const json = (await res.json()) as { data?: Asset[] };
      setAssets(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setHealthScore(null);
      setAnomalies(null);
      setRecommendations(null);
      setPredictiveRisk(null);
      return;
    }
    let cancelled = false;
    setHealthScoreLoading(true);
    setHealthScore(null);
    setAnomalies(null);
    setRecommendations(null);
    setPredictiveRisk(null);
    fetch(`/api/assets/${selected.id}/predictive-risk`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: PredictiveRiskData } | null) => {
        if (!cancelled) setPredictiveRisk(json?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setPredictiveRisk(null);
      });
    fetch(`/api/assets/${selected.id}/health-score`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: HealthScoreData } | null) => {
        if (!cancelled) setHealthScore(json?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setHealthScore(null);
      })
      .finally(() => {
        if (!cancelled) setHealthScoreLoading(false);
      });
    fetch(`/api/assets/${selected.id}/anomalies`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: AnomalyData[] } | null) => {
        if (!cancelled) setAnomalies(json?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAnomalies([]);
      });
    fetch(`/api/assets/${selected.id}/recommendations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: RecommendationData[] } | null) => {
        if (!cancelled) setRecommendations(json?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function decideRecommendation(id: string, status: "accepted" | "dismissed") {
    setDecidingId(id);
    try {
      const res = await fetch(`/api/maintenance/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRecommendations((prev) =>
          prev ? prev.map((r) => (r.id === id ? { ...r, status } : r)) : prev,
        );
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function openForm() {
    setFormError(null);
    setShowForm(true);
    if (assetTypes.length === 0) {
      const res = await fetch("/api/asset-types");
      const json = (await res.json()) as { data?: AssetType[] };
      setAssetTypes(json.data ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          category: formCategory,
          asset_type_id: formTypeId,
          serial_number: formSerial || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; data?: Asset };
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar ativo");

      if (formPhoto && json.data) {
        const photoForm = new FormData();
        photoForm.append("file", formPhoto);
        const photoRes = await fetch(`/api/assets/${json.data.id}/photo`, {
          method: "POST",
          body: photoForm,
        });
        if (!photoRes.ok) {
          const photoJson = (await photoRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(photoJson.error ?? "Ativo criado, mas falha ao enviar a foto");
        }
      }

      setShowForm(false);
      setFormName("");
      setFormTypeId("");
      setFormSerial("");
      setFormPhoto(null);
      setFormPhotoPreview(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function openImport() {
    setImportError(null);
    setImportResult(null);
    setImportFile(null);
    setShowImport(true);
    if (assetTypes.length === 0) {
      const res = await fetch("/api/asset-types");
      const json = (await res.json()) as { data?: AssetType[] };
      setAssetTypes(json.data ?? []);
    }
  }

  function downloadTemplate() {
    const exampleType = assetTypes.find((t) => t.category === "vehicle") ?? assetTypes[0];
    const exampleTypeName = exampleType?.name ?? "cadastre um tipo antes de importar";
    const exampleCategory = CATEGORY_LABEL[exampleType?.category ?? "vehicle"];
    const rows = [
      ["nome", "categoria", "tipo", "numero_serie", "status"],
      [`${exampleCategory} exemplo`, exampleCategory, exampleTypeName, "ABC-1234", "Disponível"],
      ["Outro ativo exemplo", exampleCategory, exampleTypeName, "", ""],
    ];
    const csv = rows
      .map((r) =>
        r.map((cell) => (/[",;\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","),
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-ativos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/assets/import", { method: "POST", body: form });
      const json = (await res.json()) as { data?: ImportResult; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao importar planilha");
      setImportResult(json.data);
      if (json.data.created > 0) await load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setImporting(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFormPhoto(file);
    setFormPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleStatusChange(status: AssetStatus) {
    if (!selected) return;
    setChangingStatus(true);
    try {
      await fetch(`/api/assets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      await load();
    } finally {
      setChangingStatus(false);
    }
  }

  const columns = [
    {
      key: "photo",
      label: "",
      render: (row: AssetRow) =>
        row.metadata?.photo_url ? (
          <Image
            src={row.metadata.photo_url}
            alt={row.name}
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800"
            unoptimized
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          </div>
        ),
    },
    { key: "name", label: "Nome" },
    {
      key: "category",
      label: "Categoria",
      render: (row: AssetRow) => CATEGORY_LABEL[row.category],
    },
    { key: "type_name", label: "Tipo", render: (row: AssetRow) => row.type_name ?? "—" },
    {
      key: "serial_number",
      label: "Nº de série",
      render: (row: AssetRow) => row.serial_number ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: AssetRow) => (
        <StatusBadge status={statusToUi(row.status)} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: AssetRow) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-xs text-shina-blue hover:text-blue-700 font-medium bg-transparent border-0 cursor-pointer p-0"
        >
          Ver detalhes
        </button>
      ),
    },
  ];

  return (
    <AppShell title="Ativos">
      <SectionHeader
        title="Ativos"
        description="Veículos, equipamentos, ferramentas e demais ativos do tenant."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="assets" />
            <button
              type="button"
              onClick={() => void openImport()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Importar planilha
            </button>
            <button
              type="button"
              onClick={() => void openForm()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-shina-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Ativo
            </button>
          </div>
        }
      />

      <DataTable columns={columns} data={assets as AssetRow[]} loading={loading} />

      {!loading && assets.length === 0 && (
        <p className="text-sm text-slate-500 mt-4 text-center">Nenhum ativo cadastrado ainda.</p>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Detalhe do Ativo
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {selected.metadata?.photo_url ? (
                <Image
                  src={selected.metadata.photo_url}
                  alt={selected.name}
                  width={400}
                  height={200}
                  className="w-full h-48 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                  unoptimized
                />
              ) : (
                <div className="w-full h-48 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Nome</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {selected.name}
                  </p>
                </div>
                <StatusBadge
                  status={statusToUi(selected.status)}
                  label={STATUS_LABEL[selected.status]}
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Categoria</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                </div>
                {selected.type_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {selected.type_name}
                    </span>
                  </div>
                )}
                {selected.serial_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Nº de série</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {selected.serial_number}
                    </span>
                  </div>
                )}
              </div>
              {healthScoreLoading && (
                <p className="text-xs text-slate-400">Calculando saúde do ativo…</p>
              )}
              {healthScore && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Saúde do ativo</span>
                    <span className={`font-bold ${HEALTH_BAND_CLASS[healthScore.band]}`}>
                      {healthScore.score}/100 · {HEALTH_BAND_LABEL[healthScore.band]}
                    </span>
                  </div>
                  {(healthScore.deductions.overduePreventive > 0 ||
                    healthScore.deductions.correctiveFrequency > 0 ||
                    healthScore.deductions.downtime > 0 ||
                    healthScore.deductions.staleOpenOrders > 0) && (
                    <p className="text-xs text-slate-500">
                      {[
                        healthScore.deductions.overduePreventive > 0 &&
                          "manutenção preventiva vencida",
                        healthScore.deductions.correctiveFrequency > 0 &&
                          "alta frequência de corretivas",
                        healthScore.deductions.downtime > 0 && "tempo parado recente",
                        healthScore.deductions.staleOpenOrders > 0 &&
                          "ordens em aberto há muito tempo",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {predictiveRisk && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Risco preditivo</span>
                    <span className={`font-bold ${RISK_TIER_CLASS[predictiveRisk.tier]}`}>
                      {predictiveRisk.score}/100 · {RISK_TIER_LABEL[predictiveRisk.tier]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{predictiveRisk.disclaimer}</p>
                </div>
              )}
              {anomalies && anomalies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Anomalias detectadas</p>
                  {anomalies.map((a, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-xs ${ANOMALY_SEVERITY_CLASS[a.severity]}`}
                    >
                      {a.message}
                    </div>
                  ))}
                </div>
              )}
              {recommendations && recommendations.some((r) => r.status === "pending") && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Recomendações</p>
                  {recommendations
                    .filter((r) => r.status === "pending")
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 space-y-2"
                      >
                        <p className="text-xs text-slate-700 dark:text-slate-200">{r.message}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={decidingId === r.id}
                            onClick={() => void decideRecommendation(r.id, "accepted")}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:opacity-80 disabled:opacity-50 border-0 cursor-pointer"
                          >
                            Aceitar
                          </button>
                          <button
                            type="button"
                            disabled={decidingId === r.id}
                            onClick={() => void decideRecommendation(r.id, "dismissed")}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:opacity-80 disabled:opacity-50 border-0 cursor-pointer"
                          >
                            Dispensar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            {selected.status !== "decommissioned" && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <p className="text-xs font-medium text-slate-500 mb-3">Alterar status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.filter((s) => s !== selected.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={changingStatus}
                      onClick={() => void handleStatusChange(s)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 border-0 cursor-pointer"
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showImport && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowImport(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Importar planilha
              </h2>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Cadastre vários ativos de uma vez com uma planilha CSV. Cada linha vira um ativo.
              </p>

              <button
                type="button"
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Baixar modelo de planilha
              </button>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                <p className="font-medium text-slate-700 dark:text-slate-300">Colunas:</p>
                <p>
                  <strong>nome</strong> e <strong>categoria</strong> (Veículo, Equipamento,
                  Ferramenta, Imóvel ou Tecnologia) e <strong>tipo</strong> são obrigatórios.
                </p>
                <p>
                  <strong>numero_serie</strong> e <strong>status</strong> (Disponível, Em uso,
                  Manutenção ou Desativado — padrão Disponível) são opcionais.
                </p>
                <p>
                  O <strong>tipo</strong> precisa já existir para a categoria informada — cadastre o
                  tipo em &quot;Novo Ativo&quot; antes de importar linhas que o usem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Arquivo (.csv)
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-shina-blue file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                />
              </div>

              {importError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="space-y-2">
                  <div
                    className={`px-3 py-2.5 rounded-lg text-sm ${
                      importResult.errors.length === 0
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border border-amber-200 text-amber-700"
                    }`}
                  >
                    {importResult.created} de {importResult.totalRows} ativo
                    {importResult.totalRows === 1 ? "" : "s"} importado
                    {importResult.created === 1 ? "" : "s"}
                    {importResult.errors.length > 0 && ` — ${importResult.errors.length} com erro`}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Linha {e.line}:
                          </span>{" "}
                          <span className="text-slate-500 dark:text-slate-400">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!importFile || importing}
                onClick={() => void handleImport()}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {importing ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Novo Ativo
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
                  setFormPhoto(null);
                  setFormPhotoPreview(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => void handleCreate(e)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Foto (opcional)
                </label>
                {formPhotoPreview ? (
                  <Image
                    src={formPhotoPreview}
                    alt="Pré-visualização"
                    width={400}
                    height={160}
                    className="w-full h-40 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 mb-2"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-40 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                    <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-shina-blue file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as AssetCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select
                  required
                  value={formTypeId}
                  onChange={(e) => setFormTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione...</option>
                  {assetTypes
                    .filter((t) => t.category === formCategory)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nº de série (opcional)
                </label>
                <input
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              {formError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {submitting ? "Criando..." : "Criar ativo"}
              </button>
            </form>
          </div>
        </>
      )}
    </AppShell>
  );
}
