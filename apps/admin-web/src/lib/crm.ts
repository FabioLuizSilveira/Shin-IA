import type { Lead, LeadStage, LeadStatus } from "./types.js";

export function scoreLead(lead: Lead): number {
  let score = 0;

  if (lead.stage === "negotiation") score += 50;
  else if (lead.stage === "proposal") score += 30;
  else if (lead.stage === "qualified") score += 20;
  else if (lead.stage === "prospect") score += 10;

  if (lead.estimatedRevenue >= 10000) score += 30;
  else if (lead.estimatedRevenue >= 5000) score += 20;
  else if (lead.estimatedRevenue >= 1000) score += 10;

  if (lead.status === "active") score += 20;

  return Math.min(score, 100);
}

export function groupByStage(leads: Lead[]): Record<LeadStage, Lead[]> {
  return {
    prospect: leads.filter((l) => l.stage === "prospect"),
    qualified: leads.filter((l) => l.stage === "qualified"),
    proposal: leads.filter((l) => l.stage === "proposal"),
    negotiation: leads.filter((l) => l.stage === "negotiation"),
    closed_won: leads.filter((l) => l.stage === "closed_won"),
    closed_lost: leads.filter((l) => l.stage === "closed_lost"),
  };
}

export function filterByStatus(leads: Lead[], status: LeadStatus): Lead[] {
  return leads.filter((l) => l.status === status);
}

export function computePipelineValue(leads: Lead[]): number {
  return leads
    .filter((l) => l.stage !== "closed_lost")
    .reduce((sum, l) => sum + l.estimatedRevenue, 0);
}
