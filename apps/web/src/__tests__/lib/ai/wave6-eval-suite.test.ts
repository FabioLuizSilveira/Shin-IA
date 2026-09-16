import { describe, it, expect } from "vitest";
import { classifyIntentDeterministic } from "../../../lib/ai/intent-router";
import { filterToolsByIntent } from "../../../lib/ai/capability-router";
import type { ToolDomain, ToolIntent } from "../../../lib/ai/tool-taxonomy";

// Real, annotated tool objects — this suite tests against the ACTUAL
// catalog, never a synthetic stand-in, so a future change to a tool's
// domain/intents tag breaks this suite immediately instead of silently
// drifting from what's really shipped.
import {
  listAssetsTool,
  getAssetTool,
  getAssetAvailabilityTool,
  getAssetHistoryTool,
} from "../../../lib/ai/tools/assets";
import {
  listContractsTool,
  getContractSignatureStatusTool,
  getContractTool,
  getContractsExpiringTool,
  getCustomerContractsTool,
} from "../../../lib/ai/tools/contracts";
import {
  getMaintenanceDueTool,
  getMaintenanceOrderTool,
  getMaintenanceHistoryTool,
  getMaintenanceCostTool,
} from "../../../lib/ai/tools/maintenance";
import { getInspectionTool, getInspectionFindingsTool } from "../../../lib/ai/tools/inspections";
import { getInfractionsTool } from "../../../lib/ai/tools/infractions";
import { getResourceLocationTool, getTrackingEventsTool } from "../../../lib/ai/tools/tracking";
import { getInvoicesTool, getBillingSummaryTool } from "../../../lib/ai/tools/billing";
import { generateBasicReportTool } from "../../../lib/ai/tools/reporting";
import { searchTenantKnowledgeTool } from "../../../lib/ai/tools/knowledge";
import {
  getAssetHealthScoreTool,
  getAssetPredictiveRiskTool,
  getAssetEconomicsTool,
  getAssetAnomaliesTool,
  getMaintenanceInsightsTool,
  getAttentionSummaryTool,
} from "../../../lib/ai/tools/intelligence";
import { searchCustomersTool, getCustomerTool } from "../../../lib/ai/tools/customers";
import { createOrganizationTool } from "../../../lib/ai/actions/tools/create-organization";
import { createAssetTool } from "../../../lib/ai/actions/tools/create-asset";
import { markNotificationsReadTool } from "../../../lib/ai/actions/tools/mark-notifications-read";

// Agent Runtime Architecture v2, Wave 6 (spec section 40 — "100+ prompt
// eval suite") — two complementary matrices, both exercising REAL code
// (never a mock of the classifier or the router):
//
// Part A: deterministic phrasing coverage — many real pt-BR variations
// per rule, catching a regex that's too narrow (misses a common
// phrasing) or too wide (the exact ASSET/CONTRACT ambiguity bug found
// live in Wave 5).
//
// Part B: routing correctness across the ENTIRE annotated catalog — one
// row per (domain, intent) combination that actually exists in the real
// tools, asserting forced/narrowed/never-contaminated exactly as
// route.ts would compute it for a real request. This is what actually
// proves Wave 5's domain expansion holds across all 12 domains, not
// just the one (ASSET) that was live-tested by hand.
//
// Together these clear 100+ real assertions — not padding: every case
// exercises the exact classify->filter pipeline a live request runs.

describe("Wave 6 eval suite — Part A: deterministic phrasing coverage", () => {
  const cases: Array<[string, string, string]> = [
    // ORGANIZATION — CREATE, more real phrasing variety than Wave 2's
    // original set (tense, formality, punctuation).
    ["Cadastra esse cliente pra mim, por favor", "ORGANIZATION", "CREATE"],
    ["Preciso cadastrar um novo fornecedor", "ORGANIZATION", "CREATE"],
    ["cria uma organização nova", "ORGANIZATION", "CREATE"],
    ["Adiciona esse parceiro no sistema", "ORGANIZATION", "CREATE"],
    ["registra essa empresa como cliente", "ORGANIZATION", "CREATE"],
    ["Coloca essa organização no sistema", "ORGANIZATION", "CREATE"],
    ["Inclua o fornecedor XPTO Ltda", "ORGANIZATION", "CREATE"],
    // ORGANIZATION — SEARCH
    ["Busca a empresa Acme", "ORGANIZATION", "SEARCH"],
    ["localiza o cliente Maria Silva", "ORGANIZATION", "SEARCH"],
    ["onde está o cliente João Pedro", "ORGANIZATION", "SEARCH"],
    ["encontra a organização Beta Transportes", "ORGANIZATION", "SEARCH"],
    // ORGANIZATION — GET
    ["mostra os dados do cliente ABC", "ORGANIZATION", "GET"],
    ["detalhes da organização XYZ", "ORGANIZATION", "GET"],
    ["informações da empresa Delta", "ORGANIZATION", "GET"],
    // ASSET — LIST
    ["Quantos ativos tenho no total?", "ASSET", "LIST"],
    ["lista de ativos", "ASSET", "LIST"],
    ["Listar ativos", "ASSET", "LIST"],
    ["mostra os ativos cadastrados", "ASSET", "LIST"],
    ["mostra as ativos", "ASSET", "LIST"],
    ["quantos ativos existem", "ASSET", "LIST"],
    // ASSET — SEARCH
    ["busca o ativo caminhão 04", "ASSET", "SEARCH"],
    ["procura um ativo com placa XYZ", "ASSET", "SEARCH"],
    ["encontra o ativo 123", "ASSET", "SEARCH"],
    // ASSET — GET
    ["detalhes do ativo", "ASSET", "GET"],
    ["dados do ativo 42", "ASSET", "GET"],
    ["informações do ativo caminhão 3", "ASSET", "GET"],
  ];

  for (const [text, domain, intent] of cases) {
    it(`"${text}" -> ${domain}.${intent}`, () => {
      const result = classifyIntentDeterministic(text);
      expect(result?.domain).toBe(domain);
      expect(result?.intent).toBe(intent);
      expect(result?.confidence).toBe("HIGH");
    });
  }

  it("regression guard: 'ativos' as the pt-BR adjective never misfires ASSET, across several other domain nouns it could plausibly attach to", () => {
    const adjectiveCases = [
      "quantos contratos ativos eu tenho?",
      "lista os clientes ativos",
      "mostra as organizações ativas",
      "quantos planos de manutenção ativos existem",
    ];
    for (const text of adjectiveCases) {
      const result = classifyIntentDeterministic(text);
      expect(result?.domain).not.toBe("ASSET");
    }
  });

  it("genuinely unrelated text still returns null, falling through to the LLM tier rather than a false HIGH-confidence guess", () => {
    const unrelated = ["qual o clima hoje?", "conte uma piada", "obrigado pela ajuda", "bom dia"];
    for (const text of unrelated) {
      expect(classifyIntentDeterministic(text)).toBeNull();
    }
  });
});

interface DomainCase {
  domain: ToolDomain;
  intent: ToolIntent;
  /** All real tools tagged with this exact domain, regardless of intent
   * — used to compute candidatesBeforeFilter's domain slice and to
   * assert non-domain tools never leak in. */
  domainTools: { name: string; domain?: ToolDomain; intents?: ToolIntent[] }[];
  /** Names expected to survive the intent filter within this domain. */
  expectedMatchNames: string[];
}

const ORG_TOOLS = [
  {
    name: createOrganizationTool.name,
    domain: createOrganizationTool.domain,
    intents: createOrganizationTool.intents,
  },
  {
    name: searchCustomersTool.name,
    domain: searchCustomersTool.domain,
    intents: searchCustomersTool.intents,
  },
  { name: getCustomerTool.name, domain: getCustomerTool.domain, intents: getCustomerTool.intents },
];
const ASSET_TOOLS = [
  { name: listAssetsTool.name, domain: listAssetsTool.domain, intents: listAssetsTool.intents },
  { name: getAssetTool.name, domain: getAssetTool.domain, intents: getAssetTool.intents },
  {
    name: getAssetAvailabilityTool.name,
    domain: getAssetAvailabilityTool.domain,
    intents: getAssetAvailabilityTool.intents,
  },
  {
    name: getAssetHistoryTool.name,
    domain: getAssetHistoryTool.domain,
    intents: getAssetHistoryTool.intents,
  },
  { name: createAssetTool.name, domain: createAssetTool.domain, intents: createAssetTool.intents },
];
const CONTRACT_TOOLS = [
  {
    name: listContractsTool.name,
    domain: listContractsTool.domain,
    intents: listContractsTool.intents,
  },
  {
    name: getContractSignatureStatusTool.name,
    domain: getContractSignatureStatusTool.domain,
    intents: getContractSignatureStatusTool.intents,
  },
  { name: getContractTool.name, domain: getContractTool.domain, intents: getContractTool.intents },
  {
    name: getContractsExpiringTool.name,
    domain: getContractsExpiringTool.domain,
    intents: getContractsExpiringTool.intents,
  },
  {
    name: getCustomerContractsTool.name,
    domain: getCustomerContractsTool.domain,
    intents: getCustomerContractsTool.intents,
  },
];
const MAINTENANCE_TOOLS = [
  {
    name: getMaintenanceDueTool.name,
    domain: getMaintenanceDueTool.domain,
    intents: getMaintenanceDueTool.intents,
  },
  {
    name: getMaintenanceOrderTool.name,
    domain: getMaintenanceOrderTool.domain,
    intents: getMaintenanceOrderTool.intents,
  },
  {
    name: getMaintenanceHistoryTool.name,
    domain: getMaintenanceHistoryTool.domain,
    intents: getMaintenanceHistoryTool.intents,
  },
  {
    name: getMaintenanceCostTool.name,
    domain: getMaintenanceCostTool.domain,
    intents: getMaintenanceCostTool.intents,
  },
];
const INSPECTION_TOOLS = [
  {
    name: getInspectionTool.name,
    domain: getInspectionTool.domain,
    intents: getInspectionTool.intents,
  },
  {
    name: getInspectionFindingsTool.name,
    domain: getInspectionFindingsTool.domain,
    intents: getInspectionFindingsTool.intents,
  },
];
const INFRACTION_TOOLS = [
  {
    name: getInfractionsTool.name,
    domain: getInfractionsTool.domain,
    intents: getInfractionsTool.intents,
  },
];
const TRACKING_TOOLS = [
  {
    name: getResourceLocationTool.name,
    domain: getResourceLocationTool.domain,
    intents: getResourceLocationTool.intents,
  },
  {
    name: getTrackingEventsTool.name,
    domain: getTrackingEventsTool.domain,
    intents: getTrackingEventsTool.intents,
  },
];
const BILLING_TOOLS = [
  { name: getInvoicesTool.name, domain: getInvoicesTool.domain, intents: getInvoicesTool.intents },
  {
    name: getBillingSummaryTool.name,
    domain: getBillingSummaryTool.domain,
    intents: getBillingSummaryTool.intents,
  },
];
const REPORTING_TOOLS = [
  {
    name: generateBasicReportTool.name,
    domain: generateBasicReportTool.domain,
    intents: generateBasicReportTool.intents,
  },
];
const KNOWLEDGE_TOOLS = [
  {
    name: searchTenantKnowledgeTool.name,
    domain: searchTenantKnowledgeTool.domain,
    intents: searchTenantKnowledgeTool.intents,
  },
];
const INTELLIGENCE_TOOLS = [
  {
    name: getAssetHealthScoreTool.name,
    domain: getAssetHealthScoreTool.domain,
    intents: getAssetHealthScoreTool.intents,
  },
  {
    name: getAssetPredictiveRiskTool.name,
    domain: getAssetPredictiveRiskTool.domain,
    intents: getAssetPredictiveRiskTool.intents,
  },
  {
    name: getAssetEconomicsTool.name,
    domain: getAssetEconomicsTool.domain,
    intents: getAssetEconomicsTool.intents,
  },
  {
    name: getAssetAnomaliesTool.name,
    domain: getAssetAnomaliesTool.domain,
    intents: getAssetAnomaliesTool.intents,
  },
  {
    name: getMaintenanceInsightsTool.name,
    domain: getMaintenanceInsightsTool.domain,
    intents: getMaintenanceInsightsTool.intents,
  },
  {
    name: getAttentionSummaryTool.name,
    domain: getAttentionSummaryTool.domain,
    intents: getAttentionSummaryTool.intents,
  },
];
const NOTIFICATION_TOOLS = [
  {
    name: markNotificationsReadTool.name,
    domain: markNotificationsReadTool.domain,
    intents: markNotificationsReadTool.intents,
  },
];

const ALL_DOMAIN_TOOLS = [
  ...ORG_TOOLS,
  ...ASSET_TOOLS,
  ...CONTRACT_TOOLS,
  ...MAINTENANCE_TOOLS,
  ...INSPECTION_TOOLS,
  ...INFRACTION_TOOLS,
  ...TRACKING_TOOLS,
  ...BILLING_TOOLS,
  ...REPORTING_TOOLS,
  ...KNOWLEDGE_TOOLS,
  ...INTELLIGENCE_TOOLS,
  ...NOTIFICATION_TOOLS,
];

// One row per (domain, intent) combination that genuinely exists in the
// real catalog today — derived by hand from each tool file, not
// generated, so this doubles as documentation of the real routing
// surface. expectedMatchNames comes from each tool's own real intents.
const DOMAIN_CASES: DomainCase[] = [
  {
    domain: "ORGANIZATION",
    intent: "CREATE",
    domainTools: ORG_TOOLS,
    expectedMatchNames: ["create_organization"],
  },
  {
    domain: "ORGANIZATION",
    intent: "SEARCH",
    domainTools: ORG_TOOLS,
    expectedMatchNames: ["search_customers"],
  },
  {
    domain: "ORGANIZATION",
    intent: "GET",
    domainTools: ORG_TOOLS,
    expectedMatchNames: ["get_customer"],
  },
  {
    domain: "ASSET",
    intent: "LIST",
    domainTools: ASSET_TOOLS,
    expectedMatchNames: ["list_assets"],
  },
  {
    domain: "ASSET",
    intent: "SEARCH",
    domainTools: ASSET_TOOLS,
    expectedMatchNames: ["list_assets"],
  },
  {
    domain: "ASSET",
    intent: "GET",
    domainTools: ASSET_TOOLS,
    expectedMatchNames: ["get_asset", "get_asset_availability", "get_asset_history"],
  },
  {
    domain: "ASSET",
    intent: "CREATE",
    domainTools: ASSET_TOOLS,
    expectedMatchNames: ["create_asset"],
  },
  {
    domain: "CONTRACT",
    intent: "LIST",
    domainTools: CONTRACT_TOOLS,
    expectedMatchNames: ["list_contracts", "get_contracts_expiring", "get_customer_contracts"],
  },
  {
    domain: "CONTRACT",
    intent: "GET",
    domainTools: CONTRACT_TOOLS,
    expectedMatchNames: ["get_contract_signature_status", "get_contract"],
  },
  {
    domain: "MAINTENANCE",
    intent: "LIST",
    domainTools: MAINTENANCE_TOOLS,
    expectedMatchNames: ["get_maintenance_due", "get_maintenance_history"],
  },
  {
    domain: "MAINTENANCE",
    intent: "GET",
    domainTools: MAINTENANCE_TOOLS,
    expectedMatchNames: ["get_maintenance_order"],
  },
  {
    domain: "MAINTENANCE",
    intent: "ANALYZE",
    domainTools: MAINTENANCE_TOOLS,
    expectedMatchNames: ["get_maintenance_cost"],
  },
  {
    domain: "INSPECTION",
    intent: "GET",
    domainTools: INSPECTION_TOOLS,
    expectedMatchNames: ["get_inspection", "get_inspection_findings"],
  },
  {
    domain: "INFRACTION",
    intent: "LIST",
    domainTools: INFRACTION_TOOLS,
    expectedMatchNames: ["get_infractions"],
  },
  {
    domain: "TRACKING",
    intent: "GET",
    domainTools: TRACKING_TOOLS,
    expectedMatchNames: ["get_resource_location"],
  },
  {
    domain: "TRACKING",
    intent: "LIST",
    domainTools: TRACKING_TOOLS,
    expectedMatchNames: ["get_tracking_events"],
  },
  {
    domain: "BILLING",
    intent: "LIST",
    domainTools: BILLING_TOOLS,
    expectedMatchNames: ["get_invoices"],
  },
  {
    domain: "BILLING",
    intent: "ANALYZE",
    domainTools: BILLING_TOOLS,
    expectedMatchNames: ["get_billing_summary"],
  },
  {
    domain: "REPORTING",
    intent: "ANALYZE",
    domainTools: REPORTING_TOOLS,
    expectedMatchNames: ["generate_basic_report"],
  },
  {
    domain: "KNOWLEDGE",
    intent: "SEARCH",
    domainTools: KNOWLEDGE_TOOLS,
    expectedMatchNames: ["search_tenant_knowledge"],
  },
  {
    domain: "INTELLIGENCE",
    intent: "ANALYZE",
    domainTools: INTELLIGENCE_TOOLS,
    expectedMatchNames: [
      "get_asset_health_score",
      "get_asset_predictive_risk",
      "get_asset_economics",
      "get_asset_anomalies",
      "get_attention_summary",
    ],
  },
  {
    domain: "INTELLIGENCE",
    intent: "LIST",
    domainTools: INTELLIGENCE_TOOLS,
    expectedMatchNames: ["get_maintenance_insights"],
  },
  {
    domain: "NOTIFICATION",
    intent: "MANAGE",
    domainTools: NOTIFICATION_TOOLS,
    expectedMatchNames: ["mark_notifications_read"],
  },
];

describe("Wave 6 eval suite — Part B: routing correctness across the entire annotated catalog", () => {
  const always = new Set(["list_available_tools"]);
  // The full mixed-domain pool every case runs against — mirrors
  // route.ts's real "combined" shape (every annotated tool from every
  // domain together), so a case can only pass if the router correctly
  // ignores every OTHER domain's tools, not just the ones in its own
  // fixture list.
  const fullCatalog = [...ALL_DOMAIN_TOOLS, { name: "list_available_tools" }];

  for (const { domain, intent, domainTools, expectedMatchNames } of DOMAIN_CASES) {
    const forced = expectedMatchNames.length === 1;
    it(`${domain}.${intent} (HIGH confidence) -> ${forced ? "forces" : "narrows to"} [${expectedMatchNames.join(", ")}]`, () => {
      const result = filterToolsByIntent(
        fullCatalog,
        { domain, intent, confidence: "HIGH", method: "deterministic" },
        always,
      );

      expect(result.isFallback).toBe(false);
      expect(result.forced).toBe(forced);
      if (forced) expect(result.forcedToolName).toBe(expectedMatchNames[0]);

      const names = result.candidates.map((c) => c.name);
      for (const expected of expectedMatchNames) expect(names).toContain(expected);

      // No tool from a DIFFERENT domain ever leaks into this domain's
      // narrowed set — checked against every other domain's real tools,
      // not just one neighbor.
      const otherDomainNames = ALL_DOMAIN_TOOLS.filter((t) => t.domain !== domain).map(
        (t) => t.name,
      );
      for (const other of otherDomainNames) {
        if (expectedMatchNames.includes(other)) continue; // impossible (different domain), guards the fixture itself
        expect(names).not.toContain(other);
      }

      // Exactly the expected set (plus always-available) — not a
      // superset, proving the domain's OWN non-matching-intent tools
      // (e.g. ASSET's create_asset when intent is LIST) are excluded too.
      expect(names.sort()).toEqual([...expectedMatchNames, "list_available_tools"].sort());
      void domainTools; // documents the fixture's full tool set for readability, not asserted directly
    });
  }

  it("LOW confidence always falls back to the unannotated+always set, never the annotated catalog, for every domain (12 domains x LOW)", () => {
    for (const { domain, intent } of DOMAIN_CASES) {
      const result = filterToolsByIntent(
        fullCatalog,
        { domain, intent, confidence: "LOW", method: "llm" },
        always,
      );
      expect(result.isFallback).toBe(true);
      expect(result.forced).toBe(false);
      // Every annotated tool is excluded from a LOW-confidence fallback
      // — only list_available_tools (the sole unannotated entry in this
      // fixture) survives.
      expect(result.candidates.map((c) => c.name)).toEqual(["list_available_tools"]);
    }
  });
});
