import type { LeadStatus } from "./types.js";

// Mesmo padrão de mapa de transição plano usado em todo o resto do
// projeto (operation-transitions.ts, inspection-engine/transitions.ts,
// infractions-engine/transitions.ts) -- sem motor de regras/workflow
// engine (confirmados mortos/arquivados neste repo). Desenhado
// deliberadamente permissivo em vez de um funil rígido de uma via: um
// vendedor real qualifica sem ter registrado "contacted" antes, pula
// direto pra proposta às vezes, e reabre um lead perdido ou um negócio
// fechado quando o cenário muda -- travar isso demais só empurraria o
// staff a editar o status fora do sistema.
export const ALLOWED_LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["proposal", "lost"],
  proposal: ["negotiation", "won", "lost"],
  negotiation: ["proposal", "won", "lost"],
  // "won" -> "negotiation" cobre uma correção real (marcado ganho cedo
  // demais); não permite pular de volta pra "new"/"contacted" -- um
  // negócio fechado nunca regride tanto assim sem virar um lead novo.
  won: ["negotiation"],
  // "lost" -> "contacted" é a reativação de um lead perdido (item comum
  // de CRM: "reabrir" quando o cenário do prospect muda).
  lost: ["contacted"],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return ALLOWED_LEAD_TRANSITIONS[from]?.includes(to) ?? false;
}
