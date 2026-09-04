// Static product-knowledge content — no tenant data, no database table.
// Keyed by a topic/module slug. Follows this codebase's own convention
// (no i18n framework anywhere — hardcoded pt-BR literals).
interface HelpEntry {
  screen: string;
  text: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  assets: {
    screen: "Ativos",
    text: "Aqui você cadastra e acompanha os ativos da sua frota/operação (veículos, equipamentos, ferramentas). Cada ativo tem status, categoria e histórico de manutenção.",
  },
  contracts: {
    screen: "Contratos",
    text: "Aqui ficam os contratos de serviço, locação ou assinatura com organizações clientes. Você pode acompanhar o status de cada contrato e, quando aplicável, o status da assinatura eletrônica.",
  },
  "contracts.signature": {
    screen: "Assinatura eletrônica",
    text: "Quando um contrato precisa de assinatura eletrônica, ele é enviado pra Clicksign. Você acompanha aqui se o cliente já assinou, recusou, ou se a solicitação ainda está pendente.",
  },
  maintenance: {
    screen: "Manutenção",
    text: "Ordens de manutenção, histórico de custos e recomendações pendentes dos seus ativos ficam aqui.",
  },
  inspections: {
    screen: "Vistorias",
    text: "Vistorias registram o estado de um ativo em um momento específico (ex: antes/depois de uma locação), com fotos e observações por componente.",
  },
};

const DEFAULT_HELP: HelpEntry = {
  screen: "Shinã",
  text: "Ainda não tenho um conteúdo de ajuda específico pra isso — mas posso tentar responder sua dúvida diretamente, é só perguntar.",
};

export function lookupHelp(topic: string | null | undefined): HelpEntry {
  if (!topic) return DEFAULT_HELP;
  return HELP_CONTENT[topic] ?? DEFAULT_HELP;
}
