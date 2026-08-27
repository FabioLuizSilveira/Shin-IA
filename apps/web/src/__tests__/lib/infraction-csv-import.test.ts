import { describe, expect, it } from "vitest";
import {
  parseCsv,
  suggestColumnMapping,
  mapCsvRows,
  type ColumnMapping,
} from "@/lib/infraction-csv-import";

describe("parseCsv", () => {
  it("parses a simple comma-delimited csv", () => {
    const { headers, rows } = parseCsv("placa,data\nABC1234,01/01/2026\nDEF5678,02/01/2026");
    expect(headers).toEqual(["placa", "data"]);
    expect(rows).toEqual([
      ["ABC1234", "01/01/2026"],
      ["DEF5678", "02/01/2026"],
    ]);
  });

  it("detects semicolon delimiter (common BR spreadsheet export)", () => {
    const { headers, rows } = parseCsv("placa;data\nABC1234;01/01/2026");
    expect(headers).toEqual(["placa", "data"]);
    expect(rows).toEqual([["ABC1234", "01/01/2026"]]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const { headers, rows } = parseCsv(
      'placa,descricao\nABC1234,"Avançar sinal, sem parar"\nDEF5678,"Disse ""pare"""',
    );
    expect(headers).toEqual(["placa", "descricao"]);
    expect(rows[0]).toEqual(["ABC1234", "Avançar sinal, sem parar"]);
    expect(rows[1]).toEqual(["DEF5678", 'Disse "pare"']);
  });

  it("tolerates a trailing newline without producing a phantom empty row", () => {
    const { rows } = parseCsv("placa,data\nABC1234,01/01/2026\n");
    expect(rows).toHaveLength(1);
  });

  it("returns empty headers/rows for an empty string", () => {
    const { headers, rows } = parseCsv("");
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });
});

describe("suggestColumnMapping", () => {
  it("matches common BR headers by substring, case-insensitively", () => {
    const mapping = suggestColumnMapping(["Placa", "Data da Infração", "Valor", "UF"]);
    expect(mapping.plate).toBe("Placa");
    expect(mapping.occurredAt).toBe("Data da Infração");
    expect(mapping.amountCents).toBe("Valor");
    expect(mapping.state).toBe("UF");
  });

  it("leaves a field unmapped when no header matches", () => {
    const mapping = suggestColumnMapping(["column_x", "column_y"]);
    expect(mapping.plate).toBeUndefined();
  });

  it("never maps 'Data da Infração' to description -- regression for a real bug found live in fase i", () => {
    const mapping = suggestColumnMapping(["Placa", "Data da Infração", "Descrição", "Valor"]);
    expect(mapping.occurredAt).toBe("Data da Infração");
    expect(mapping.description).toBe("Descrição");
  });
});

describe("mapCsvRows", () => {
  const mapping: ColumnMapping = {
    plate: "placa",
    occurredAt: "data",
    amountCents: "valor",
  };

  it("maps a valid row into an ExternalInfraction with source csv_import", () => {
    const table = {
      headers: ["placa", "data", "valor"],
      rows: [["ABC1234", "01/01/2026", "195,34"]],
    };
    const [result] = mapCsvRows(table, mapping);
    expect(result.errors).toEqual([]);
    expect(result.infraction?.source).toBe("csv_import");
    expect(result.infraction?.plate).toBe("ABC1234");
    expect(result.infraction?.amountCents).toBe(19534);
    expect(result.infraction?.occurredAt).toMatch(/^2026-01-01T/);
  });

  it("rejects a row with no plate -- never invents one", () => {
    const table = { headers: ["placa", "data"], rows: [["", "01/01/2026"]] };
    const [result] = mapCsvRows(table, { plate: "placa", occurredAt: "data" });
    expect(result.infraction).toBeNull();
    expect(result.errors).toContain("placa ausente");
  });

  it("rejects a row with an unparseable date -- never guesses a fallback date", () => {
    const table = { headers: ["placa", "data"], rows: [["ABC1234", "not a date"]] };
    const [result] = mapCsvRows(table, { plate: "placa", occurredAt: "data" });
    expect(result.infraction).toBeNull();
    expect(result.errors.some((e) => e.includes("inválida"))).toBe(true);
  });

  it("one invalid row never blocks the others in the same batch", () => {
    const table = {
      headers: ["placa", "data"],
      rows: [
        ["", "01/01/2026"],
        ["DEF5678", "02/01/2026"],
      ],
    };
    const results = mapCsvRows(table, { plate: "placa", occurredAt: "data" });
    expect(results[0].infraction).toBeNull();
    expect(results[1].infraction).not.toBeNull();
    expect(results[1].infraction?.plate).toBe("DEF5678");
  });

  it("imports a row without a mapped amount column as null, not zero", () => {
    const table = { headers: ["placa", "data"], rows: [["ABC1234", "01/01/2026"]] };
    const [result] = mapCsvRows(table, { plate: "placa", occurredAt: "data" });
    expect(result.infraction?.amountCents).toBeNull();
  });

  it("flags an unparseable amount as a warning but still imports the row", () => {
    const table = { headers: ["placa", "data", "valor"], rows: [["ABC1234", "01/01/2026", "n/a"]] };
    const [result] = mapCsvRows(table, mapping);
    expect(result.infraction).not.toBeNull();
    expect(result.infraction?.amountCents).toBeNull();
    expect(result.errors.some((e) => e.includes("valor inválido"))).toBe(true);
  });

  it("keeps the full raw row in rawPayload for audit", () => {
    const table = { headers: ["placa", "data"], rows: [["ABC1234", "01/01/2026"]] };
    const [result] = mapCsvRows(table, { plate: "placa", occurredAt: "data" });
    expect(result.infraction?.rawPayload).toEqual({ placa: "ABC1234", data: "01/01/2026" });
  });
});
