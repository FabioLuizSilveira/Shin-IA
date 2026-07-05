// Ícones proprietários Shinã (doc 07 §1: conceitos do ecossistema).
// Vocabulário: fluxo, energia, conexões, órbitas — nunca robôs/cérebros.

import { createShinaIcon } from "./shina-icon";

/** IA Shinã: faísca de 4 pontas com satélite (assinatura do produto). */
export const AiIcon = createShinaIcon(
  "AiIcon",
  <>
    <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4z" />
    <circle cx="19" cy="5" r="1" />
  </>,
);

/** Rede neural abstrata: três nós conectados. */
export const NeuralIcon = createShinaIcon(
  "NeuralIcon",
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="8" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M7.6 7.3L16.2 8M7.3 7.7l3.6 8.5M16.9 9.8l-3.8 6.4" />
  </>,
);

/** Fluxo: corrente contínua em curva. */
export const FlowIcon = createShinaIcon(
  "FlowIcon",
  <>
    <path d="M3 8c4-4 6 4 10 0s5-2 8 0" />
    <path d="M3 16c4-4 6 4 10 0s5-2 8 0" />
  </>,
);

/** Órbita: centro luminoso com elemento orbitando (ecossistema). */
export const OrbitIcon = createShinaIcon(
  "OrbitIcon",
  <>
    <circle cx="12" cy="12" r="3" />
    <ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-20 12 12)" />
    <circle cx="19.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

/** Estratégia: caminho com decisões. */
export const StrategyIcon = createShinaIcon(
  "StrategyIcon",
  <>
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="5" r="2" />
    <path d="M6.5 17.5L11 13h4l3-3" />
    <path d="M15 13l-2 6M11 13l-1-5" />
  </>,
);

/** Insight: núcleo emitindo luz. */
export const InsightIcon = createShinaIcon(
  "InsightIcon",
  <>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
  </>,
);

/** Automação: nós encadeados em pipeline. */
export const AutomationIcon = createShinaIcon(
  "AutomationIcon",
  <>
    <rect x="2" y="9" width="6" height="6" rx="2" />
    <rect x="16" y="9" width="6" height="6" rx="2" />
    <path d="M8 12h8" />
    <path d="M13 9.5L16 12l-3 2.5" fill="none" />
  </>,
);

/** Marketplace: órbita de módulos ao redor do núcleo. */
export const MarketplaceIcon = createShinaIcon(
  "MarketplaceIcon",
  <>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="4" r="1.6" />
    <circle cx="19" cy="16" r="1.6" />
    <circle cx="5" cy="16" r="1.6" />
    <path d="M12 6.5v3M17.6 15l-3-1.8M6.4 15l3-1.8" />
  </>,
);

/** Campanha: sinal irradiando de um ponto de origem. */
export const CampaignIcon = createShinaIcon(
  "CampaignIcon",
  <>
    <circle cx="7" cy="12" r="2.5" />
    <path d="M12.5 7a8 8 0 0 1 0 10M15.5 4.5a12 12 0 0 1 0 15" />
  </>,
);

/** Analytics: fluxo de dados ascendente. */
export const AnalyticsIcon = createShinaIcon(
  "AnalyticsIcon",
  <>
    <path d="M4 19c3-1 4-6 7-7s4 3 9-6" />
    <circle cx="20" cy="6" r="1.4" fill="currentColor" stroke="none" />
  </>,
);

/** Studio: camadas de criação com energia. */
export const StudioIcon = createShinaIcon(
  "StudioIcon",
  <>
    <rect x="4" y="4" width="12" height="12" rx="3" />
    <path d="M20 9v7a4 4 0 0 1-4 4H9" />
    <path d="M10 8l-1.5 4L12 10.5 8.5 13 10 8z" fill="currentColor" stroke="none" />
  </>,
);
