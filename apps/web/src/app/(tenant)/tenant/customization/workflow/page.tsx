"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X, ChevronRight } from "lucide-react";
import type { WorkflowConfig, WorkflowStateType } from "@shina/studio";

const STATE_TYPES: WorkflowStateType[] = ["initial", "intermediate", "terminal"];

const EMPTY: WorkflowConfig = { workflows: [] };

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function WorkflowStudioPage() {
  const studio = useStudioConfig<WorkflowConfig>("workflow", EMPTY);
  const { config, setConfig } = studio;
  const [selected, setSelected] = useState<string | null>(null);

  const [showWfForm, setShowWfForm] = useState(false);
  const [wfName, setWfName] = useState("");
  const [entityType, setEntityType] = useState("");

  const [stateName, setStateName] = useState("");
  const [stateType, setStateType] = useState<WorkflowStateType>("intermediate");

  const [transName, setTransName] = useState("");
  const [fromState, setFromState] = useState("");
  const [toState, setToState] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  function addWorkflow() {
    if (!wfName.trim() || !entityType.trim()) return;
    setConfig({
      ...config,
      workflows: [
        ...config.workflows,
        { name: wfName.trim(), entityType: entityType.trim(), states: [], transitions: [] },
      ],
    });
    setSelected(wfName.trim());
    setWfName("");
    setEntityType("");
    setShowWfForm(false);
  }

  function removeWorkflow(name: string) {
    setConfig({ ...config, workflows: config.workflows.filter((w) => w.name !== name) });
    if (selected === name) setSelected(null);
  }

  const active = config.workflows.find((w) => w.name === selected);

  function updateActive(patch: Partial<NonNullable<typeof active>>) {
    if (!active) return;
    const updated = { ...active, ...patch };
    setConfig({
      ...config,
      workflows: config.workflows.map((w) => (w.name === active.name ? updated : w)),
    });
  }

  function addState() {
    if (!active || !stateName.trim()) return;
    updateActive({
      states: [
        ...active.states,
        {
          id: crypto.randomUUID(),
          name: stateName.trim(),
          type: stateType,
          entryActions: [],
          exitActions: [],
        },
      ],
    });
    setStateName("");
  }

  function removeState(id: string) {
    if (!active) return;
    updateActive({ states: active.states.filter((s) => s.id !== id) });
  }

  function addTransition() {
    if (!active || !transName.trim() || !fromState || !toState) return;
    updateActive({
      transitions: [
        ...active.transitions,
        {
          id: crypto.randomUUID(),
          fromStateId: fromState,
          toStateId: toState,
          name: transName.trim(),
          guards: [],
          actions: [],
          requiresApproval,
        },
      ],
    });
    setTransName("");
    setRequiresApproval(false);
  }

  function removeTransition(id: string) {
    if (!active) return;
    updateActive({ transitions: active.transitions.filter((t) => t.id !== id) });
  }

  function stateName_(id: string) {
    return active?.states.find((s) => s.id === id)?.name ?? "?";
  }

  return (
    <AppShell title="Workflow">
      <StudioAreaShell
        title="Workflow"
        description="Estados e transições por entidade."
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
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Workflows
                </p>
                <button
                  type="button"
                  onClick={() => setShowWfForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo
                </button>
              </div>

              {showWfForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                  <input
                    placeholder="Nome"
                    value={wfName}
                    onChange={(e) => setWfName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Entidade"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addWorkflow}
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Criar
                  </button>
                </div>
              )}

              {config.workflows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum workflow ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.workflows.map((wf) => (
                    <li
                      key={wf.name}
                      onClick={() => setSelected(wf.name)}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {wf.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {wf.entityType} · {wf.states.length} estados
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWorkflow(wf.name);
                        }}
                        className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!active ? (
              <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-sm text-slate-400 text-center py-4">
                  Selecione um workflow pra editar estados e transições.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                    Estados
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      placeholder="Nome"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      className={inputClass}
                    />
                    <select
                      value={stateType}
                      onChange={(e) => setStateType(e.target.value as WorkflowStateType)}
                      className={`${inputClass} max-w-[110px]`}
                    >
                      {STATE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addState}
                      className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {active.states.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sem estados.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {active.states.map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">
                            {s.name} <span className="text-slate-400 text-xs">({s.type})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeState(s.id)}
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
                    Transições
                  </p>
                  <div className="space-y-2 mb-3">
                    <input
                      placeholder="Nome"
                      value={transName}
                      onChange={(e) => setTransName(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <select
                        value={fromState}
                        onChange={(e) => setFromState(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">De...</option>
                        {active.states.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={toState}
                        onChange={(e) => setToState(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Para...</option>
                        {active.states.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={requiresApproval}
                        onChange={(e) => setRequiresApproval(e.target.checked)}
                      />
                      Exige aprovação
                    </label>
                    <button
                      type="button"
                      onClick={addTransition}
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                    >
                      Adicionar transição
                    </button>
                  </div>
                  {active.transitions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sem transições.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {active.transitions.map((t) => (
                        <li key={t.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">
                            {stateName_(t.fromStateId)} → {stateName_(t.toStateId)}
                            {t.requiresApproval && (
                              <span className="text-amber-500 text-xs"> (aprovação)</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTransition(t.id)}
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
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
