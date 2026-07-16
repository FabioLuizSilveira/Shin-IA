"use client";

// Toast (doc 10 Grupo C). Feedback efêmero, empilha no canto superior
// direito, auto-dismiss 5s (pausa no hover), ação Undo opcional.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "@shina/icons";

export type ToastVariant = "success" | "warning" | "danger" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: ToastItem[];
  show: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-emerald-400" />,
  warning: <AlertTriangle size={16} className="text-amber-400" />,
  danger: <AlertCircle size={16} className="text-red-400" />,
  info: <Info size={16} className="text-blue-400" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...toast, id }]);
      timers.current[id] = setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-toast flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onMouseEnter={() => clearTimeout(timers.current[t.id])}
            onMouseLeave={() => {
              timers.current[t.id] = setTimeout(() => dismiss(t.id), 5000);
            }}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-lg min-w-[280px] max-w-sm",
              "bg-[var(--shina-surface-raised)] border border-[var(--shina-border-default)]",
              "text-sm text-[var(--shina-text-primary)] shadow-lg",
            )}
          >
            {VARIANT_ICON[t.variant ?? "info"]}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-xs font-semibold underline text-[var(--shina-accent)]"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => dismiss(t.id)}
              className="text-[var(--shina-text-tertiary)] hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
