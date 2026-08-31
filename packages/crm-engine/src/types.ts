// Platform Sales CRM — controla o funil comercial de leads da própria
// Shinã (prospects que podem virar tenants), na sessão plataforma. Não
// confundir com o CRM que já existe por tenant (tenant/crm — esse é o
// cliente FINAL de cada locadora; este pacote é o cliente da Shinã: uma
// locadora em potencial).

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource =
  | "website"
  | "referral"
  | "outbound"
  | "event"
  | "social"
  | "partner"
  | "other";

export type ActivityType = "note" | "call" | "email" | "meeting" | "status_change";

export interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  source: LeadSource;
  status: LeadStatus;
  segment: string | null;
  estimatedFleetSize: number | null;
  estimatedMrrCents: number | null;
  assignedTo: string | null;
  lostReason: string | null;
  convertedTenantId: string | null;
  convertedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  description: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  createdBy: string;
  createdAt: string;
}
