import { describe, it, expect } from "vitest";
import {
  resolveReferentialExpression,
  relationForDomain,
  type ConversationEntityReference,
} from "../../../lib/ai/entity-context";

// Agent Runtime v3, Wave 1 — the real reported bug: "esse cliente que
// acabamos de cadastrar" and a repeated customer name had no way to
// resolve at all (the web chat sends zero conversation history/state).
// These tests exercise resolveReferentialExpression() in isolation (pure
// function, no db) — the live end-to-end path (create -> confirm ->
// record entity -> next message resolves it) is covered by this wave's
// live verification against the real server, not re-derived here.

function entity(overrides: Partial<ConversationEntityReference> = {}): ConversationEntityReference {
  return {
    entityType: "ORGANIZATION",
    entityId: "11111111-1111-1111-1111-111111111111",
    displayName: "Eduardo Gomid",
    relation: "CURRENT_CUSTOMER",
    source: "CREATED_IN_CONVERSATION",
    referencedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Wave 1 — resolveReferentialExpression: the real reported case", () => {
  it("the exact second message from the bug report resolves by name echo", () => {
    const recent = [entity()];
    const text =
      "Quero fazer um contrato de locação para esse cliente que acabamos de cadastrar, o Eduardo Gomid. Quais os próximos passos?";
    const result = resolveReferentialExpression(text, recent);
    expect(result.status).toBe("RESOLVED");
    expect(result.entity?.entityId).toBe(entity().entityId);
  });

  it("'esse cliente' alone (no name echo) still resolves to the recent CURRENT_CUSTOMER", () => {
    const recent = [entity()];
    const result = resolveReferentialExpression("faça uma locação para esse cliente", recent);
    expect(result.status).toBe("RESOLVED");
  });

  it("'ele' resolves when it's the only recent entity", () => {
    const recent = [entity()];
    const result = resolveReferentialExpression("ele tem alguma cobrança pendente?", recent);
    expect(result.status).toBe("RESOLVED");
    expect(result.entity?.displayName).toBe("Eduardo Gomid");
  });

  it("no recent entities at all -> NONE, never a false resolution", () => {
    const result = resolveReferentialExpression("faça uma locação para esse cliente", []);
    expect(result.status).toBe("NONE");
  });

  it("unrelated text with a recent entity present -> NONE (no referential expression to resolve)", () => {
    const recent = [entity()];
    const result = resolveReferentialExpression("qual o clima hoje?", recent);
    expect(result.status).toBe("NONE");
  });
});

describe("Wave 4 — 'esse ativo'/'esse veículo' resolves to CURRENT_ASSET (the master prompt's own Maintenance example)", () => {
  function assetEntity(
    overrides: Partial<ConversationEntityReference> = {},
  ): ConversationEntityReference {
    return entity({
      entityType: "ASSET",
      entityId: "22222222-2222-2222-2222-222222222222",
      displayName: "Honda CG",
      relation: "CURRENT_ASSET",
      ...overrides,
    });
  }

  it("'esse ônibus está fazendo um barulho estranho' resolves the recent CURRENT_ASSET", () => {
    const recent = [assetEntity()];
    const result = resolveReferentialExpression(
      "esse ônibus está fazendo um barulho estranho, abre uma manutenção",
      recent,
    );
    expect(result.status).toBe("RESOLVED");
    expect(result.entity?.entityId).toBe(assetEntity().entityId);
  });

  it("'esse ativo'/'esse veículo' also resolve", () => {
    const recent = [assetEntity()];
    expect(resolveReferentialExpression("esse ativo precisa de manutenção", recent).status).toBe(
      "RESOLVED",
    );
    expect(resolveReferentialExpression("vamos vistoriar esse veículo", recent).status).toBe(
      "RESOLVED",
    );
  });

  it("no recent ASSET entity -> NONE, never resolved against an unrelated entity", () => {
    const recent = [entity()]; // only a CURRENT_CUSTOMER
    const result = resolveReferentialExpression("esse ativo precisa de manutenção", recent);
    expect(result.status).toBe("NONE");
  });
});

describe("Wave 1 — ambiguity is never silently guessed (spec section 10)", () => {
  it("two customers named the same -> name-echo match is AMBIGUOUS, not an arbitrary pick", () => {
    const recent = [
      entity({ entityId: "a", displayName: "Eduardo Silva" }),
      entity({ entityId: "b", displayName: "Eduardo Silva" }),
    ];
    const result = resolveReferentialExpression("faça uma locação para Eduardo Silva", recent);
    expect(result.status).toBe("AMBIGUOUS");
    expect(result.candidates).toHaveLength(2);
  });

  it("'ele' with more than one recent entity of different relations is AMBIGUOUS, not resolved to the first one", () => {
    const recent = [
      entity({ entityId: "cust-1", relation: "CURRENT_CUSTOMER" }),
      entity({
        entityId: "asset-1",
        entityType: "ASSET",
        displayName: "Fiat Mobi",
        relation: "CURRENT_ASSET",
      }),
    ];
    const result = resolveReferentialExpression("ele está disponível?", recent);
    expect(result.status).toBe("AMBIGUOUS");
  });
});

describe("Wave 1 — relationForDomain", () => {
  it("maps ORGANIZATION -> CURRENT_CUSTOMER (the domain this wave's tools actually support)", () => {
    expect(relationForDomain("ORGANIZATION")).toBe("CURRENT_CUSTOMER");
  });

  it("a domain with no resultEntity()-producing tool yet returns null, never a guessed relation", () => {
    expect(relationForDomain("KNOWLEDGE")).toBeNull();
  });
});
