"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X } from "lucide-react";
import type { CommercialStudioConfig, CommissionBasis, CommissionType } from "@shina/studio";

const BASIS_OPTIONS: CommissionBasis[] = ["revenue", "units", "profit_margin", "custom"];
const TYPE_OPTIONS: CommissionType[] = ["percentage", "fixed", "tiered"];

const EMPTY: CommercialStudioConfig = {
  defaultPlanName: "",
  rules: [],
  campaignEnabled: false,
  settlementPeriod: "monthly",
};

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function CommercialStudioPage() {
  const studio = useStudioConfig<CommercialStudioConfig>("commercial", EMPTY);
  const { config, setConfig } = studio;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<CommissionBasis>("revenue");
  const [type, setType] = useState<CommissionType>("percentage");
  const [rate, setRate] = useState("10");

  function addRule() {
    if (!name.trim()) return;
    setConfig({
      ...config,
      rules: [
        ...config.rules,
        {
          name: name.trim(),
          basis,
          type,
          rate: Number(rate),
          conditions: [],
          priority: config.rules.length,
        },
      ],
    });
    setName("");
    setRate("10");
    setShowForm(false);
  }

  function removeRule(index: number) {
    setConfig({ ...config, rules: config.rules.filter((_, i) => i !== index) });
  }

  return (
    <AppShell title="Comercial">
      <StudioAreaShell
        title="Comercial"
        description="Regras de comissão, campanhas e período de settlement."
        publishedVersion={studio.publishedVersion}
        saving={studio.saving}
        publishing={studio.publishing}
        saved={studio.saved}
        error={studio.error}
        onSaveDraft={() => void studio.saveDraft(config)}
        onPublish={() => void studio.publish()}
      >
        {studio.loading ? (
          <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Plano padrão
                  </label>
                  <input
                    value={config.defaultPlanName}
                    onChange={(e) => setConfig({ ...config, defaultPlanName: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Período de settlement
                  </label>
                  <select
                    value={config.settlementPeriod}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        settlementPeriod: e.target
                          .value as CommercialStudioConfig["settlementPeriod"],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={config.campaignEnabled}
                  onChange={(e) => setConfig({ ...config, campaignEnabled: e.target.checked })}
                />
                Campanhas de comissão habilitadas
              </label>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Regras de comissão
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {showForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <input
                    placeholder="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${inputClass} col-span-2`}
                  />
                  <select
                    value={basis}
                    onChange={(e) => setBasis(e.target.value as CommissionBasis)}
                    className={inputClass}
                  >
                    {BASIS_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CommissionType)}
                    className={inputClass}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Taxa (%)"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addRule}
                    className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              )}

              {config.rules.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma regra ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.rules.map((rule, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {rule.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {rule.basis} · {rule.type} · {rule.rate}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
