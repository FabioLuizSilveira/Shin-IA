"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X, ChevronRight } from "lucide-react";
import type { RuleConfig, RuleTrigger, RuleOperator, RuleActionType } from "@shina/studio";

const TRIGGERS: RuleTrigger[] = [
  "on_create",
  "on_update",
  "on_delete",
  "on_status_change",
  "on_field_change",
  "scheduled",
  "manual",
];
const OPERATORS: RuleOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in"];
const ACTION_TYPES: RuleActionType[] = [
  "notify",
  "block",
  "assign",
  "update_field",
  "emit_event",
  "webhook",
  "custom",
];

const EMPTY: RuleConfig = { rules: [] };

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function RuleStudioPage() {
  const studio = useStudioConfig<RuleConfig>("rule", EMPTY);
  const { config, setConfig } = studio;
  const [selected, setSelected] = useState<string | null>(null);

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [trigger, setTrigger] = useState<RuleTrigger>("on_create");

  const [condField, setCondField] = useState("");
  const [condOperator, setCondOperator] = useState<RuleOperator>("eq");
  const [condValue, setCondValue] = useState("");

  const [actionType, setActionType] = useState<RuleActionType>("notify");

  function addRule() {
    if (!ruleName.trim() || !entityType.trim()) return;
    setConfig({
      ...config,
      rules: [
        ...config.rules,
        {
          name: ruleName.trim(),
          entityType: entityType.trim(),
          trigger,
          conditions: [],
          actions: [],
          priority: config.rules.length,
          enabled: true,
        },
      ],
    });
    setSelected(ruleName.trim());
    setRuleName("");
    setEntityType("");
    setShowRuleForm(false);
  }

  function removeRule(name: string) {
    setConfig({ ...config, rules: config.rules.filter((r) => r.name !== name) });
    if (selected === name) setSelected(null);
  }

  function toggleRule(name: string) {
    setConfig({
      ...config,
      rules: config.rules.map((r) => (r.name === name ? { ...r, enabled: !r.enabled } : r)),
    });
  }

  const active = config.rules.find((r) => r.name === selected);

  function addCondition() {
    if (!active || !condField.trim()) return;
    const updated = {
      ...active,
      conditions: [
        ...active.conditions,
        { field: condField.trim(), operator: condOperator, value: condValue },
      ],
    };
    setConfig({
      ...config,
      rules: config.rules.map((r) => (r.name === active.name ? updated : r)),
    });
    setCondField("");
    setCondValue("");
  }

  function removeCondition(index: number) {
    if (!active) return;
    const updated = { ...active, conditions: active.conditions.filter((_, i) => i !== index) };
    setConfig({
      ...config,
      rules: config.rules.map((r) => (r.name === active.name ? updated : r)),
    });
  }

  function addAction() {
    if (!active) return;
    const updated = { ...active, actions: [...active.actions, { type: actionType, config: {} }] };
    setConfig({
      ...config,
      rules: config.rules.map((r) => (r.name === active.name ? updated : r)),
    });
  }

  function removeAction(index: number) {
    if (!active) return;
    const updated = { ...active, actions: active.actions.filter((_, i) => i !== index) };
    setConfig({
      ...config,
      rules: config.rules.map((r) => (r.name === active.name ? updated : r)),
    });
  }

  return (
    <AppShell title="Regras">
      <StudioAreaShell
        title="Regras"
        description="Condições e ações disparadas por evento em uma entidade."
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
          <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Regras
                </p>
                <button
                  type="button"
                  onClick={() => setShowRuleForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova
                </button>
              </div>

              {showRuleForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                  <input
                    placeholder="Nome"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Entidade"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as RuleTrigger)}
                    className={inputClass}
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addRule}
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Criar
                  </button>
                </div>
              )}

              {config.rules.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma regra ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.rules.map((rule) => (
                    <li
                      key={rule.name}
                      onClick={() => setSelected(rule.name)}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {rule.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {rule.entityType} · {rule.trigger}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.name);
                          }}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg border-0 cursor-pointer ${
                            rule.enabled
                              ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {rule.enabled ? "Ativa" : "Inativa"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRule(rule.name);
                          }}
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

            <div className="space-y-4">
              {!active ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-sm text-slate-400 text-center py-4">
                    Selecione uma regra pra editar condições e ações.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      Condições
                    </p>
                    <div className="flex gap-2 mb-3">
                      <input
                        placeholder="Campo"
                        value={condField}
                        onChange={(e) => setCondField(e.target.value)}
                        className={inputClass}
                      />
                      <select
                        value={condOperator}
                        onChange={(e) => setCondOperator(e.target.value as RuleOperator)}
                        className={`${inputClass} max-w-[90px]`}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Valor"
                        value={condValue}
                        onChange={(e) => setCondValue(e.target.value)}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={addCondition}
                        className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {active.conditions.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Sem condições.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {active.conditions.map((c, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300">
                              {c.field} {c.operator} {String(c.value)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCondition(i)}
                              className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      Ações
                    </p>
                    <div className="flex gap-2 mb-3">
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value as RuleActionType)}
                        className={inputClass}
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addAction}
                        className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {active.actions.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Sem ações.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {active.actions.map((a, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300">{a.type}</span>
                            <button
                              type="button"
                              onClick={() => removeAction(i)}
                              className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
