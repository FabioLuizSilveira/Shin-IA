import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContractTemplateEngine } from "./template-engine.js";

interface TemplateClauseFixture {
  is_mandatory: boolean;
  condition: unknown;
  sort_order: number;
  tenant_contract_clauses: { key: string; category: string; content: string };
}

// Minimal fake covering exactly the one query shape this file uses:
// tenant_contract_template_clauses joined to tenant_contract_clauses.
function makeDb(rows: TemplateClauseFixture[]): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("ContractTemplateEngine.render", () => {
  it("always includes mandatory clauses regardless of context", async () => {
    const db = makeDb([
      {
        is_mandatory: true,
        condition: null,
        sort_order: 0,
        tenant_contract_clauses: { key: "GENERAL", category: "general", content: "General terms." },
      },
    ]);

    const result = await ContractTemplateEngine.render(db, { templateId: "t1", context: {} });
    expect(result.includedClauseKeys).toEqual(["GENERAL"]);
  });

  it("includes a conditional clause only when its condition matches", async () => {
    const db = makeDb([
      {
        is_mandatory: false,
        condition: { field: "insuranceIncluded", op: "eq", value: true },
        sort_order: 0,
        tenant_contract_clauses: {
          key: "INSURANCE",
          category: "insurance",
          content: "Insurance terms.",
        },
      },
    ]);

    const withoutInsurance = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { insuranceIncluded: false },
    });
    expect(withoutInsurance.includedClauseKeys).toEqual([]);

    const withInsurance = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { insuranceIncluded: true },
    });
    expect(withInsurance.includedClauseKeys).toEqual(["INSURANCE"]);
  });

  it("forces PRIVACY/CONSUMER_RIGHTS in even if configured as optional, when relationship is consumer", async () => {
    const db = makeDb([
      {
        is_mandatory: false,
        condition: { field: "never", op: "eq", value: "matches-nothing" },
        sort_order: 0,
        tenant_contract_clauses: {
          key: "PRIVACY_NOTICE",
          category: "privacy",
          content: "Privacy notice.",
        },
      },
    ]);

    const consumer = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { consumerRelationship: "consumer" },
    });
    expect(consumer.includedClauseKeys).toEqual(["PRIVACY_NOTICE"]);

    const business = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { consumerRelationship: "business" },
    });
    expect(business.includedClauseKeys).toEqual([]);
  });

  it("renders {{variables}} and produces a hash that changes when content changes", async () => {
    const db = makeDb([
      {
        is_mandatory: true,
        condition: null,
        sort_order: 0,
        tenant_contract_clauses: {
          key: "SECURITY_DEPOSIT",
          category: "security_deposit",
          content: "Deposit of {{security_deposit_amount}}.",
        },
      },
    ]);

    const result = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { variables: { security_deposit_amount: "R$ 500,00" } },
    });
    expect(result.renderedContent).toBe("Deposit of R$ 500,00.");

    const other = await ContractTemplateEngine.render(db, {
      templateId: "t1",
      context: { variables: { security_deposit_amount: "R$ 900,00" } },
    });
    expect(other.contentHash).not.toBe(result.contentHash);
  });
});
