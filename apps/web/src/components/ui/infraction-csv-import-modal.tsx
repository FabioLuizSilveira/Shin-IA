"use client";

import { useState } from "react";
import { X, Upload, ArrowRight, CheckCircle2 } from "lucide-react";
import { CSV_IMPORT_TARGET_FIELDS, type CsvImportTargetField } from "@/lib/infraction-csv-import";

const FIELD_LABEL: Record<CsvImportTargetField, string> = {
  plate: "Placa *",
  renavam: "RENAVAM",
  autoNumber: "Nº do Auto",
  authorityCode: "Código do órgão",
  authorityName: "Órgão autuador",
  infractionCode: "Código da infração",
  description: "Descrição",
  occurredAt: "Data/hora da infração *",
  location: "Local",
  municipality: "Município",
  state: "UF",
  amountCents: "Valor",
  dueDate: "Vencimento",
  driverIdentificationDeadline: "Prazo indicação de condutor",
  defenseDeadline: "Prazo defesa",
  paymentDeadline: "Prazo pagamento",
  discountDeadline: "Prazo desconto",
};

interface PreviewResponse {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  suggestedMapping: Partial<Record<CsvImportTargetField, string>>;
}

interface ImportResponse {
  runId: string;
  receivedCount: number;
  createdCount: number;
  duplicatedCount: number;
  failedCount: number;
  errors: { rowIndex: number; message: string }[];
}

type Step = "upload" | "mapping" | "result";

export function InfractionCsvImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CsvImportTargetField, string>>>({});
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
  }

  async function loadPreview() {
    if (!csvText.trim()) {
      setError("Cole ou selecione um arquivo CSV primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/infractions/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const json = (await res.json()) as { error?: string; data?: PreviewResponse };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao ler o CSV.");
      setPreview(json.data);
      setMapping(json.data.suggestedMapping);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!mapping.plate || !mapping.occurredAt) {
      setError("Mapeie ao menos Placa e Data/hora da infração antes de importar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/infractions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, columnMapping: mapping }),
      });
      const json = (await res.json()) as { error?: string; data?: ImportResponse };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao importar.");
      setResult(json.data);
      setStep("result");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Importar infrações (CSV)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {step === "upload" && (
            <>
              <p className="text-xs text-slate-500">
                Envie um arquivo .csv exportado de qualquer planilha (vírgula ou ponto e vírgula
                como separador). No próximo passo você confirma qual coluna é qual — nenhuma
                suposição é aplicada sem sua confirmação.
              </p>
              <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer text-sm text-slate-500 hover:border-shina-blue">
                <Upload className="w-4 h-4" />
                Selecionar arquivo .csv
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="...ou cole o conteúdo do CSV aqui"
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void loadPreview()}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {busy ? "Lendo..." : "Continuar"} <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === "mapping" && preview && (
            <>
              <p className="text-xs text-slate-500">
                {preview.totalRows} linha(s) encontradas. Confirme o mapeamento de colunas — os
                campos marcados com * são obrigatórios.
              </p>
              <div className="space-y-2">
                {CSV_IMPORT_TARGET_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <label className="w-56 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                      {FIELD_LABEL[field]}
                    </label>
                    <select
                      value={mapping[field] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [field]: e.target.value || undefined,
                        }))
                      }
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="">— não importar —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {preview.sampleRows.length > 0 && (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5">
                        {preview.headers.map((h) => (
                          <th
                            key={h}
                            className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => void runImport()}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                {busy ? "Importando..." : `Importar ${preview.totalRows} linha(s)`}
              </button>
            </>
          )}

          {step === "result" && result && (
            <>
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-semibold">Importação concluída</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5">
                  <p className="text-slate-500 text-xs">Recebidas</p>
                  <p className="font-semibold">{result.receivedCount}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <p className="text-emerald-600 text-xs">Criadas</p>
                  <p className="font-semibold text-emerald-700">{result.createdCount}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5">
                  <p className="text-slate-500 text-xs">Duplicadas (ignoradas)</p>
                  <p className="font-semibold">{result.duplicatedCount}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                  <p className="text-red-600 text-xs">Falharam</p>
                  <p className="font-semibold text-red-700">{result.failedCount}</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                  {result.errors.map((e, i) => (
                    <p key={i} className="px-3 py-1.5 text-xs text-slate-500">
                      Linha {e.rowIndex + 1}: {e.message}
                    </p>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl border-0 cursor-pointer"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
