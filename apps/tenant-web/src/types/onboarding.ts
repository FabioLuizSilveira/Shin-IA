export type TenantSegment =
  | "urban_mobility"
  | "logistics"
  | "agriculture"
  | "construction"
  | "healthcare"
  | "other";

export type BlueprintId =
  | "mobility_urban"
  | "logistics_truck"
  | "agriculture_field"
  | "construction_fleet"
  | "generic";

export interface OnboardingStep1 {
  companyName: string;
  cnpj: string;
  segment: TenantSegment;
  website?: string;
}

export interface OnboardingStep2 {
  branchName: string;
  branchCode: string;
  city: string;
  state: string;
}

export interface OnboardingStep3 {
  adminEmail: string;
  adminFullName: string;
}

export interface OnboardingStep4 {
  blueprintId: BlueprintId;
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4;
  step1: Partial<OnboardingStep1>;
  step2: Partial<OnboardingStep2>;
  step3: Partial<OnboardingStep3>;
  step4: Partial<OnboardingStep4>;
}

export interface OnboardingPayload {
  step1: OnboardingStep1;
  step2: OnboardingStep2;
  step3: OnboardingStep3;
  step4: OnboardingStep4;
}

export const SEGMENT_LABELS: Record<TenantSegment, string> = {
  urban_mobility: "Mobilidade Urbana",
  logistics: "Logística e Transporte",
  agriculture: "Agronegócio",
  construction: "Construção Civil",
  healthcare: "Saúde",
  other: "Outro",
};

export const BLUEPRINT_OPTIONS: {
  id: BlueprintId;
  name: string;
  description: string;
  icon: string;
  segments: TenantSegment[];
}[] = [
  {
    id: "mobility_urban",
    name: "Mobilidade Urbana",
    description:
      "Ideal para frotas urbanas, ride-share e transporte de passageiros. Inclui rastreamento em tempo real e gestão de motoristas.",
    icon: "🚗",
    segments: ["urban_mobility"],
  },
  {
    id: "logistics_truck",
    name: "Logística & Transporte",
    description:
      "Para transportadoras e distribuidoras. Otimização de rotas, gestão de cargas e controle de entregas.",
    icon: "🚛",
    segments: ["logistics"],
  },
  {
    id: "agriculture_field",
    name: "Agronegócio",
    description: "Para gestão de máquinas agrícolas, monitoramento de campo e controle de safra.",
    icon: "🌾",
    segments: ["agriculture"],
  },
  {
    id: "construction_fleet",
    name: "Construção Civil",
    description: "Para canteiros de obra, gestão de equipamentos pesados e controle de alocações.",
    icon: "🏗️",
    segments: ["construction"],
  },
  {
    id: "generic",
    name: "Configuração Padrão",
    description:
      "Configuração genérica e flexível. Ideal para qualquer segmento não listado acima.",
    icon: "⚙️",
    segments: ["healthcare", "other"],
  },
];
