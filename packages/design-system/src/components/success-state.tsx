"use client";

// SuccessState (Wave 4 SUPERNOVA). Confirmação com Motion — nunca um toast
// mudo. Usado para conclusões significativas: publicação, upload, geração.

import { useEffect, type ReactNode } from "react";
import { CheckCircle2 } from "@shina/icons";
import { GlowPulse, ensureKeyframes } from "@shina/flow-engine";
import { cn } from "../utils/cn";

export interface SuccessStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function SuccessState({
  title,
  description,
  action,
  secondaryAction,
  className,
}: SuccessStateProps) {
  useEffect(ensureKeyframes, []);
  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-6", className)}>
      <div className="mb-5" style={{ animation: "shina-success-pop 0.5s ease-out" }}>
        <GlowPulse active={false}>
          <CheckCircle2 size={40} className="text-[var(--shina-accent)]" />
        </GlowPulse>
      </div>
      <h3 className="text-base font-bold text-[var(--shina-text-title)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--shina-text-secondary)] max-w-sm mb-5">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
