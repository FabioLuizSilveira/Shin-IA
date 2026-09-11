import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePricingWithRules } from "./pricing.js";
import {
  detectPlaceholders,
  renderAnnex,
  validateContractReadiness,
  resolveContractExecutionMode,
  composeOnboardingContract,
  freezeOnboardingContract,
} from "./contract-composition.js";

const PRICING_RULES = {
  currency: "BRL",
  extensionPriceCents: { tracking: 9900, integrations: 14900, tracking_pro: 19900 },
  commitmentDiscountPct: [
    { minMonths: 12, pct: 10 },
    { minMonths: 24, pct: 15 },
  ],
  yearlyPrepayDiscountPct: 15,
  volumeDiscountPctByAssetCount: [
    { minAssets: 100, pct: 5 },
    { minAssets: 300, pct: 10 },
  ],
};

describe("WAVE 3 — deterministic pricing", () => {
  it("base + extensions, no discounts", () => {
    const r = computePricingWithRules(
      { basePlanPriceCents: 59900, billingCycle: "monthly", extensions: ["tracking"] },
      1,
      PRICING_RULES,
    );
    expect(r.subtotalCents).toBe(69800);
    expect(r.discountCents).toBe(0);
    expect(r.totalMonthlyCents).toBe(69800);
    expect(r.totalYearlyCents).toBe(69800 * 12);
    expect(r.lineItems.map((l) => l.code)).toEqual(["base_plan", "ext:tracking"]);
  });

  it("stacks commitment + volume + annual discounts additively", () => {
    const r = computePricingWithRules(
      {
        basePlanPriceCents: 59900,
        billingCycle: "yearly",
        extensions: [],
        commitmentPeriodMonths: 24,
        assetQuantity: 350,
      },
      1,
      PRICING_RULES,
    );
    // 15 (commitment 24m) + 10 (volume 300+) + 15 (annual) = 40%
    expect(r.appliedDiscounts.map((d) => d.code).sort()).toEqual([
      "commitment",
      "volume",
      "yearly_prepay",
    ]);
    expect(r.discountCents).toBe(Math.round((59900 * 40) / 100));
    expect(r.totalMonthlyCents).toBe(59900 - Math.round((59900 * 40) / 100));
  });

  it("is deterministic and order-independent on extensions", () => {
    const a = computePricingWithRules(
      {
        basePlanPriceCents: 1000,
        billingCycle: "monthly",
        extensions: ["tracking", "integrations"],
      },
      1,
      PRICING_RULES,
    );
    const b = computePricingWithRules(
      {
        basePlanPriceCents: 1000,
        billingCycle: "monthly",
        extensions: ["integrations", "tracking"],
      },
      1,
      PRICING_RULES,
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("WAVE 3 — placeholder detection", () => {
  it("catches [PREENCHER], {{token}} and ___ blanks", () => {
    const hits = detectPlaceholders("Plano: {{planoNome}}\nCNPJ: [PREENCHER]\nAssinatura: _____");
    const codes = hits.map((h) => h.code).sort();
    expect(codes).toEqual(["BLANK_LINE", "MUSTACHE", "PREENCHER"]);
  });

  it("renderAnnex leaves unknown tokens intact (never blanks silently)", () => {
    const out = renderAnnex("A: {{a}} B: {{b}}", { a: "1" });
    expect(out).toBe("A: 1 B: {{b}}");
    expect(detectPlaceholders(out)).toHaveLength(1);
  });
});

describe("WAVE 3 — readiness gate", () => {
  it("not ready when required vars missing", () => {
    const r = validateContractReadiness(["planoNome"], []);
    expect(r.ready).toBe(false);
    expect(r.issues[0].code).toBe("MISSING_VARS");
  });
  it("ready when nothing missing and no residuals", () => {
    expect(validateContractReadiness([], []).ready).toBe(true);
  });
});

describe("WAVE 3 — execution mode", () => {
  it("commitment > 12m or material change => electronic signature; 12m is click-accept", () => {
    expect(resolveContractExecutionMode({ commitmentPeriodMonths: 24 })).toBe(
      "electronic_signature",
    );
    expect(resolveContractExecutionMode({ materialChange: true })).toBe("electronic_signature");
    expect(resolveContractExecutionMode({ commitmentPeriodMonths: 12 })).toBe("click_accept");
    expect(resolveContractExecutionMode({ commitmentPeriodMonths: 0 })).toBe("click_accept");
  });
});

// ── FakeDb for compose/freeze ─────────────────────────────────────────────
interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private op: "select" | "insert" = "select";
  private payload: Row = {};
  private eqs: Array<{ c: string; v: unknown }> = [];
  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  eq(c: string, v: unknown) {
    this.eqs.push({ c, v });
    return this;
  }
  private match() {
    return (this.db.tables[this.table] ?? []).filter((r) => this.eqs.every((f) => r[f.c] === f.v));
  }
  maybeSingle() {
    if (this.op === "insert") return this.single();
    return Promise.resolve({ data: this.match()[0] ?? null, error: null });
  }
  single() {
    if (this.op === "insert") {
      const row = {
        id: `${this.table}-${(this.db.tables[this.table]?.length ?? 0) + 1}`,
        ...this.payload,
      };
      (this.db.tables[this.table] ??= []).push(row);
      return Promise.resolve({ data: row, error: null });
    }
    const first = this.match()[0];
    return Promise.resolve(
      first ? { data: first, error: null } : { data: null, error: { message: "nf" } },
    );
  }
}
class FakeDb {
  tables: Record<string, Row[]> = {};
  from(t: string) {
    return new FakeQuery(this, t);
  }
}

const REQUIRED = ["planoNome", "mensalidadeReais"];
function seedDb() {
  const db = new FakeDb();
  db.tables.contract_versions = [
    { id: "cv1", content: "Corpo legal sem pendências.", status: "published" },
    { id: "cv-holes", content: "Corpo com CNPJ [PREENCHER].", status: "published" },
  ];
  db.tables.contract_composition_templates = [
    {
      id: "tpl1",
      key: "platform_commercial_annex",
      active: true,
      body: "ANEXO\nPlano: {{planoNome}}\nMensalidade: R$ {{mensalidadeReais}}",
      required_vars: REQUIRED,
    },
  ];
  db.tables.onboarding_contract_snapshots = [];
  return db;
}
const asClient = (db: FakeDb) => db as unknown as SupabaseClient;

const baseInput = {
  tenantId: "t1",
  commercialConfigurationId: "cfg1",
  contractVersionId: "cv1",
  compositionTemplateKey: "platform_commercial_annex",
  createdBy: "u1",
};

describe("WAVE 3 — compose + freeze", () => {
  it("composes and hashes; ready when all vars present", async () => {
    const db = seedDb();
    const c = await composeOnboardingContract(asClient(db), {
      ...baseInput,
      vars: { planoNome: "Professional", mensalidadeReais: "599,00" },
    });
    expect(c.readiness.ready).toBe(true);
    expect(c.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.composedContent).toContain("Professional");
  });

  it("freeze refused when a required var is missing (incomplete-contract STOP)", async () => {
    const db = seedDb();
    await expect(
      freezeOnboardingContract(asClient(db), {
        ...baseInput,
        vars: { planoNome: "Professional" },
      }),
    ).rejects.toThrow(/not ready to freeze/);
  });

  it("freeze refused when the legal body still has [PREENCHER] and not allowed", async () => {
    const db = seedDb();
    await expect(
      freezeOnboardingContract(asClient(db), {
        ...baseInput,
        contractVersionId: "cv-holes",
        vars: { planoNome: "P", mensalidadeReais: "1" },
      }),
    ).rejects.toThrow(/unresolved placeholder/);
  });

  it("freezes once; a second freeze for the same config is refused", async () => {
    const db = seedDb();
    const vars = { planoNome: "Professional", mensalidadeReais: "599,00" };
    const first = await freezeOnboardingContract(asClient(db), { ...baseInput, vars });
    expect(first.status).toBe("frozen");
    await expect(freezeOnboardingContract(asClient(db), { ...baseInput, vars })).rejects.toThrow(
      /already exists/,
    );
  });

  it("same vars => same content hash (deterministic freeze)", async () => {
    const db1 = seedDb();
    const db2 = seedDb();
    const vars = { planoNome: "Professional", mensalidadeReais: "599,00" };
    const a = await freezeOnboardingContract(asClient(db1), { ...baseInput, vars });
    const b = await freezeOnboardingContract(asClient(db2), { ...baseInput, vars });
    expect(a.contentHash).toBe(b.contentHash);
  });
});
