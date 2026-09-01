import { describe, it, expect } from "vitest";
import {
  SEGMENT_LABELS,
  BLUEPRINT_OPTIONS,
  type OnboardingStep1,
  type OnboardingStep2,
  type OnboardingStep3,
  type OnboardingStep4,
  type OnboardingStep5,
  type TenantSegment,
  type BlueprintId,
} from "../../types/onboarding";

// ── Helpers that mirror the wizard's validation functions ──────────────────

function validateStep1(d: Partial<OnboardingStep1>): string | null {
  if (!d.companyName?.trim()) return "Nome da empresa é obrigatório.";
  if (!d.cnpj || d.cnpj.replace(/\D/g, "").length < 14) return "CNPJ inválido.";
  if (!d.segment) return "Selecione o segmento da empresa.";
  return null;
}

function validateStep2(d: Partial<OnboardingStep2>): string | null {
  if (!d.branchName?.trim()) return "Nome da sede é obrigatório.";
  if (!d.branchCode?.trim()) return "Código da filial é obrigatório.";
  if (!d.city?.trim()) return "Cidade é obrigatória.";
  if (!d.state) return "Estado é obrigatório.";
  return null;
}

function validateStep3(d: Partial<OnboardingStep3>): string | null {
  if (!d.blueprintId) return "Selecione um blueprint para continuar.";
  return null;
}

function validateStep4(d: Partial<OnboardingStep4>): string | null {
  if (!d.planVersionId) return "Selecione um plano para continuar.";
  return null;
}

function validateStep5(d: Partial<OnboardingStep5>): string | null {
  if (!d.representativeName?.trim()) return "Informe seu nome completo.";
  if (!d.representativeRole?.trim()) return "Informe seu cargo.";
  if (
    !d.billingPhone?.trim() ||
    !d.billingAddress?.trim() ||
    !d.billingAddressNumber?.trim() ||
    !d.billingPostalCode?.trim() ||
    !d.billingProvince?.trim()
  ) {
    return "Preencha o endereço de cobrança completo.";
  }
  if (!d.declaredAuthority) return "É necessário declarar poderes de representação.";
  if (!d.contractAccepted) return "É necessário aceitar o contrato para continuar.";
  return null;
}

function formatCNPJ(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("validateStep1 — Company Data", () => {
  it("passes with valid data", () => {
    const d: OnboardingStep1 = {
      companyName: "Transportadora Alfa",
      cnpj: "12.345.678/0001-95",
      segment: "logistics",
    };
    expect(validateStep1(d)).toBeNull();
  });

  it("requires companyName", () => {
    expect(validateStep1({ cnpj: "12.345.678/0001-95", segment: "logistics" })).toMatch(/empresa/i);
  });

  it("rejects blank companyName", () => {
    expect(
      validateStep1({ companyName: "   ", cnpj: "12.345.678/0001-95", segment: "logistics" }),
    ).toMatch(/empresa/i);
  });

  it("requires valid CNPJ (14 digits)", () => {
    expect(
      validateStep1({ companyName: "Alfa", cnpj: "12.345.678/0001-9", segment: "logistics" }),
    ).toMatch(/CNPJ/i);
  });

  it("accepts formatted CNPJ with 14 digits", () => {
    expect(
      validateStep1({
        companyName: "Alfa",
        cnpj: "12.345.678/0001-95",
        segment: "logistics",
      }),
    ).toBeNull();
  });

  it("requires segment", () => {
    expect(validateStep1({ companyName: "Alfa", cnpj: "12.345.678/0001-95" })).toMatch(/segmento/i);
  });
});

describe("validateStep2 — Main Branch", () => {
  const valid: OnboardingStep2 = {
    branchName: "Matriz SP",
    branchCode: "MATRIZ-SP",
    city: "São Paulo",
    state: "SP",
  };

  it("passes with valid data", () => {
    expect(validateStep2(valid)).toBeNull();
  });

  it("requires branchName", () => {
    expect(validateStep2({ ...valid, branchName: "" })).toMatch(/sede/i);
  });

  it("requires branchCode", () => {
    expect(validateStep2({ ...valid, branchCode: "" })).toMatch(/código/i);
  });

  it("requires city", () => {
    expect(validateStep2({ ...valid, city: "" })).toMatch(/cidade/i);
  });

  it("requires state", () => {
    expect(validateStep2({ ...valid, state: "" })).toMatch(/estado/i);
  });
});

describe("validateStep3 — Blueprint", () => {
  it("passes when blueprintId is set", () => {
    expect(validateStep3({ blueprintId: "logistics_truck" })).toBeNull();
  });

  it("fails when blueprintId is missing", () => {
    expect(validateStep3({})).toMatch(/blueprint/i);
  });
});

describe("validateStep4 — Plan", () => {
  it("passes when planVersionId is set", () => {
    expect(validateStep4({ planVersionId: "pv-1" })).toBeNull();
  });

  it("fails when planVersionId is missing", () => {
    expect(validateStep4({})).toMatch(/plano/i);
  });
});

describe("validateStep5 — Contract", () => {
  const valid: OnboardingStep5 = {
    representativeName: "João Silva",
    representativeRole: "Sócio-diretor",
    declaredAuthority: true,
    contractAccepted: true,
    billingPhone: "11999999999",
    billingAddress: "Avenida Paulista",
    billingAddressNumber: "1000",
    billingPostalCode: "01310-000",
    billingProvince: "Bela Vista",
  };

  it("passes with valid data", () => {
    expect(validateStep5(valid)).toBeNull();
  });

  it("requires representative name", () => {
    expect(validateStep5({ ...valid, representativeName: "" })).toMatch(/nome/i);
  });

  it("requires representative role", () => {
    expect(validateStep5({ ...valid, representativeRole: "" })).toMatch(/cargo/i);
  });

  it("requires a complete billing address", () => {
    expect(validateStep5({ ...valid, billingPhone: "" })).toMatch(/endereço/i);
    expect(validateStep5({ ...valid, billingAddress: "" })).toMatch(/endereço/i);
    expect(validateStep5({ ...valid, billingAddressNumber: "" })).toMatch(/endereço/i);
    expect(validateStep5({ ...valid, billingPostalCode: "" })).toMatch(/endereço/i);
    expect(validateStep5({ ...valid, billingProvince: "" })).toMatch(/endereço/i);
  });

  it("requires declared authority", () => {
    expect(validateStep5({ ...valid, declaredAuthority: false })).toMatch(/poderes/i);
  });

  it("requires contract acceptance", () => {
    expect(validateStep5({ ...valid, contractAccepted: false })).toMatch(/aceitar/i);
  });
});

describe("formatCNPJ", () => {
  it("formats 14-digit raw input", () => {
    expect(formatCNPJ("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("ignores non-digit characters", () => {
    expect(formatCNPJ("12.345.678/0001-95")).toBe("12.345.678/0001-95");
  });

  it("truncates to 14 digits", () => {
    expect(formatCNPJ("123456789012345678")).toBe("12.345.678/9012-34");
  });

  it("handles partial input gracefully", () => {
    const result = formatCNPJ("12");
    expect(result).toBe("12");
  });
});

describe("generateSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(generateSlug("Transportadora Alfa")).toBe("transportadora-alfa");
  });

  it("removes accents", () => {
    expect(generateSlug("Çedilha Ação")).toBe("cedilha-acao");
  });

  it("collapses multiple spaces/special chars", () => {
    expect(generateSlug("Alfa  & Omega!!")).toBe("alfa-omega");
  });

  it("strips leading and trailing hyphens", () => {
    expect(generateSlug("  Alfa  ")).toBe("alfa");
  });

  it("truncates to 48 chars", () => {
    const long = "A".repeat(60);
    expect(generateSlug(long).length).toBeLessThanOrEqual(48);
  });
});

describe("SEGMENT_LABELS", () => {
  it("covers all TenantSegment values", () => {
    const segments: TenantSegment[] = [
      "urban_mobility",
      "logistics",
      "agriculture",
      "construction",
      "healthcare",
      "other",
    ];
    segments.forEach((seg) => {
      expect(SEGMENT_LABELS[seg]).toBeTruthy();
    });
  });
});

describe("BLUEPRINT_OPTIONS", () => {
  it("each option has required fields", () => {
    BLUEPRINT_OPTIONS.forEach((bp) => {
      expect(bp.id).toBeTruthy();
      expect(bp.name).toBeTruthy();
      expect(bp.description).toBeTruthy();
      expect(bp.icon).toBeTruthy();
      expect(Array.isArray(bp.segments)).toBe(true);
    });
  });

  it("covers all BlueprintIds", () => {
    const ids: BlueprintId[] = [
      "mobility_urban",
      "logistics_truck",
      "agriculture_field",
      "construction_fleet",
      "generic",
    ];
    const optionIds = BLUEPRINT_OPTIONS.map((b) => b.id);
    ids.forEach((id) => {
      expect(optionIds).toContain(id);
    });
  });

  it("generic blueprint covers remaining segments", () => {
    const generic = BLUEPRINT_OPTIONS.find((b) => b.id === "generic");
    expect(generic?.segments).toContain("healthcare");
    expect(generic?.segments).toContain("other");
  });
});
