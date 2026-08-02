"use client";

import Link from "next/link";
import { ArrowLeft, Check, Upload } from "lucide-react";

interface StudioAreaShellProps {
  title: string;
  description: string;
  publishedVersion: number | null;
  saving: boolean;
  publishing: boolean;
  saved: boolean;
  error: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  children: React.ReactNode;
}

// Shared header/actions for every tenant/customization/<area> page — save
// draft + publish + version indicator, identical across all 10 areas.
export function StudioAreaShell({
  title,
  description,
  publishedVersion,
  saving,
  publishing,
  saved,
  error,
  onSaveDraft,
  onPublish,
  children,
}: StudioAreaShellProps) {
  return (
    <div>
      <Link
        href="/tenant/customization"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Customização
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          <p className="text-xs text-slate-400 mt-1">
            {publishedVersion !== null
              ? `Versão publicada: v${publishedVersion}`
              : "Nunca publicado"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" /> Salvo
              </>
            ) : (
              "Salvar rascunho"
            )}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Publicar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
