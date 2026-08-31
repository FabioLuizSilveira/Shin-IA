import type { LeadStatus } from "./types.js";

// Ordem de exibição do funil ativo (sem os dois estados terminais) --
// usado pela UI pra desenhar as colunas/abas na ordem certa, em vez de
// cada tela reinventar essa lista.
export const ACTIVE_PIPELINE_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
];

export function isTerminalStatus(status: LeadStatus): boolean {
  return status === "won" || status === "lost";
}
