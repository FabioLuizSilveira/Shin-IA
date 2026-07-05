// @shina/icons — biblioteca oficial (doc 07).
// Lucide é a base; ícones próprios cobrem os conceitos do ecossistema Shinã.

// Base Lucide completa (mesma gramática dos ícones custom)
export * from "lucide-react";

// Ícones proprietários Shinã
export {
  AiIcon,
  NeuralIcon,
  FlowIcon,
  OrbitIcon,
  StrategyIcon,
  InsightIcon,
  AutomationIcon,
  MarketplaceIcon,
  CampaignIcon,
  AnalyticsIcon,
  StudioIcon,
} from "./custom";
export { createShinaIcon, type ShinaIconProps } from "./shina-icon";
