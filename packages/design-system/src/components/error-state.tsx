// ErrorState (Wave 4 SUPERNOVA). Todo erro explica, orienta e oferece uma
// saída — nunca culpa o usuário, nunca mostra um código puro sem contexto.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type ErrorCode =
  | "not-found"
  | "server"
  | "offline"
  | "timeout"
  | "rate-limit"
  | "forbidden"
  | "no-data"
  | "integration-unavailable"
  | "ai-unavailable";

interface ErrorCopy {
  title: string;
  description: string;
}

const ERROR_COPY: Record<ErrorCode, ErrorCopy> = {
  "not-found": {
    title: "Essa página não existe (ou mudou de lugar)",
    description: "Verifique o endereço ou volte para um lugar conhecido — nada foi perdido.",
  },
  server: {
    title: "Algo falhou do nosso lado",
    description: "Já identificamos o problema automaticamente. Tente novamente em instantes.",
  },
  offline: {
    title: "Sem conexão com a internet",
    description: "Verifique sua rede — assim que reconectar, retomamos de onde você parou.",
  },
  timeout: {
    title: "Isso está demorando mais que o esperado",
    description: "O servidor não respondeu a tempo. Pode tentar de novo, sem perder o que já fez.",
  },
  "rate-limit": {
    title: "Muitas solicitações em pouco tempo",
    description:
      "Aguarde alguns instantes antes de tentar novamente — é uma proteção, não um bloqueio.",
  },
  forbidden: {
    title: "Você não tem acesso a este recurso",
    description: "Fale com o administrador do workspace se acredita que deveria ter permissão.",
  },
  "no-data": {
    title: "Ainda não há dados para mostrar aqui",
    description: "Assim que houver atividade, este espaço se preenche automaticamente.",
  },
  "integration-unavailable": {
    title: "Essa integração está temporariamente indisponível",
    description: "O provedor externo não respondeu. Suas configurações continuam salvas.",
  },
  "ai-unavailable": {
    title: "O modelo de IA está indisponível no momento",
    description: "Tente novamente em instantes ou troque de provedor nas configurações de IA.",
  },
};

export interface ErrorStateProps {
  code: ErrorCode;
  title?: string;
  description?: string;
  illustration?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function ErrorState({
  code,
  title,
  description,
  illustration,
  action,
  secondaryAction,
  className,
}: ErrorStateProps) {
  const copy = ERROR_COPY[code];
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center text-center py-12 px-6", className)}
    >
      {illustration && <div className="mb-4">{illustration}</div>}
      <h3 className="text-base font-bold text-[var(--shina-text-title)] mb-1.5">
        {title ?? copy.title}
      </h3>
      <p className="text-sm text-[var(--shina-text-secondary)] max-w-sm mb-5">
        {description ?? copy.description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
