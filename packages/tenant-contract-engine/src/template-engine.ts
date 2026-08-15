import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "./hash.js";
import { evaluateCondition } from "./clause-conditions.js";
import type { ClauseCondition, RenderContext, RenderedContract } from "./types.js";

// Consumer-protection clause categories can never be dropped when the
// relationship is consumer/undetermined (item 17: "não permitir cláusula
// configurável que elimine direito legal obrigatório") — enforced here,
// regardless of what a tenant configured on the template_clauses row.
const ALWAYS_MANDATORY_FOR_CONSUMER = new Set(["privacy", "consumer_rights"]);

interface TemplateClauseRow {
  is_mandatory: boolean;
  condition: ClauseCondition | null;
  sort_order: number;
  tenant_contract_clauses: {
    key: string;
    category: string;
    content: string;
  };
}

function renderVariables(content: string, variables: Record<string, string | number> = {}): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : String(value);
  });
}

export const ContractTemplateEngine = {
  async render(
    db: SupabaseClient,
    input: { templateId: string; context: RenderContext },
  ): Promise<RenderedContract> {
    const { data, error } = await db
      .from("tenant_contract_template_clauses")
      .select(
        "is_mandatory, condition, sort_order, tenant_contract_clauses(key, category, content)",
      )
      .eq("template_id", input.templateId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`failed to load template clauses: ${error.message}`);

    const rows = (data ?? []) as unknown as TemplateClauseRow[];
    const consumerRelationship = input.context.consumerRelationship ?? "undetermined";
    const forcedMandatory = consumerRelationship !== "business";

    const included: TemplateClauseRow[] = [];
    for (const row of rows) {
      const category = row.tenant_contract_clauses.category;
      const isForcedByConsumerProtection =
        forcedMandatory && ALWAYS_MANDATORY_FOR_CONSUMER.has(category);
      if (row.is_mandatory || isForcedByConsumerProtection) {
        included.push(row);
        continue;
      }
      if (row.condition && evaluateCondition(row.condition, input.context)) {
        included.push(row);
      }
    }

    const renderedContent = included
      .map((row) => renderVariables(row.tenant_contract_clauses.content, input.context.variables))
      .join("\n\n");
    const contentHash = await hashContent(renderedContent);

    return {
      renderedContent,
      contentHash,
      includedClauseKeys: included.map((row) => row.tenant_contract_clauses.key),
    };
  },
};
