import type { ExternalInfraction } from "@shina/infractions-engine";

// Fase I (item 34 do spec: "não assumir um único layout universal de CSV
// -- suportar mapeamento de coluna"). Nenhum precedente de import
// upload->preview->mapeamento->validação->import existe em nenhuma outra
// parte do repo (só exportação, api/export) -- este arquivo é 100% novo,
// deliberadamente puro (sem SupabaseClient) para ser testável isolado,
// mesmo padrão de packages/infractions-engine/src/normalize.ts.

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

// Parser mínimo, sem dependência externa: suporta aspas duplas (com ""
// escapando uma aspa literal dentro de um campo), vírgula ou ponto e
// vírgula como delimitador (detectado pelo cabeçalho -- planilhas
// brasileiras exportam com ; com frequência maior que CSVs "americanos").
export function parseCsv(text: string): CsvTable {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n", 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < normalized.length) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Last field/row if the text didn't end with a trailing newline.
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const [headers, ...dataRows] = nonEmpty;
  return { headers: headers ?? [], rows: dataRows };
}

// Alvo do mapeamento: cada chave é o campo real de ExternalInfraction que
// o import consegue preencher (os dois obrigatórios -- plate/occurredAt
// -- mais os opcionais mais comuns). rawPayload/source/externalId ficam
// de fora do mapeamento manual (source é sempre "csv_import" aqui,
// externalId não tem equivalente confiável em planilha).
export const CSV_IMPORT_TARGET_FIELDS = [
  "plate",
  "renavam",
  "autoNumber",
  "authorityCode",
  "authorityName",
  "infractionCode",
  "description",
  "occurredAt",
  "location",
  "municipality",
  "state",
  "amountCents",
  "dueDate",
  "driverIdentificationDeadline",
  "defenseDeadline",
  "paymentDeadline",
  "discountDeadline",
] as const;

export type CsvImportTargetField = (typeof CSV_IMPORT_TARGET_FIELDS)[number];

export type ColumnMapping = Partial<Record<CsvImportTargetField, string>>;

// Sugestão de mapeamento por semelhança de nome de cabeçalho -- só uma
// conveniência de UI (o tenant sempre confirma/ajusta antes de importar),
// nunca decide sozinha o que é "placa" numa planilha ambígua.
const HEADER_HINTS: Record<CsvImportTargetField, string[]> = {
  plate: ["placa", "plate"],
  renavam: ["renavam"],
  autoNumber: ["auto", "auto de infração", "numero do auto", "número do auto", "ait"],
  authorityCode: ["codigo orgao", "código órgão", "orgao autuador", "órgão autuador"],
  authorityName: ["orgao", "órgão", "autoridade", "authority"],
  infractionCode: ["codigo infracao", "código infração", "enquadramento", "infraction code"],
  description: ["descricao", "descrição", "infracao", "infração", "description"],
  occurredAt: ["data", "data infracao", "data da infração", "occurred", "date"],
  location: ["local", "endereco", "endereço", "location"],
  municipality: ["municipio", "município", "cidade", "city"],
  state: ["uf", "estado", "state"],
  amountCents: ["valor", "amount"],
  dueDate: ["vencimento", "due date"],
  driverIdentificationDeadline: ["prazo indicacao", "prazo indicação", "driver identification"],
  defenseDeadline: ["prazo defesa", "defense deadline"],
  paymentDeadline: ["prazo pagamento", "payment deadline"],
  discountDeadline: ["prazo desconto", "discount deadline"],
};

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  for (const field of CSV_IMPORT_TARGET_FIELDS) {
    const hints = HEADER_HINTS[field];
    const idx = normalizedHeaders.findIndex((h) => hints.some((hint) => h.includes(hint)));
    if (idx >= 0) mapping[field] = headers[idx];
  }
  return mapping;
}

export interface MappedRow {
  rowIndex: number; // 0-based, relative to the data rows (header excluded)
  infraction: ExternalInfraction | null;
  errors: string[];
}

// Parses a BR-formatted amount ("R$ 195,34", "195.34", "19534") into
// cents. Returns null (never throws) on anything unrecognizable -- an
// unparseable amount is a per-row warning, not a reason to reject the
// whole row (item 34: uma linha inválida nunca derruba o lote inteiro).
function parseAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  // "1.234,56" (BR) vs "1234.56" (US) -- if both separators are present,
  // whichever comes last is the decimal separator.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function parseDateLike(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // dd/mm/yyyy[ hh:mm] -- the common BR spreadsheet format.
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = brMatch;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.000Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Maps every raw CSV row through the confirmed column mapping into an
// ExternalInfraction, collecting per-row errors instead of throwing --
// the caller decides what to do with rows that have errors (skip them,
// still import the valid ones).
export function mapCsvRows(table: CsvTable, mapping: ColumnMapping): MappedRow[] {
  const colIndex = new Map<CsvImportTargetField, number>();
  for (const field of CSV_IMPORT_TARGET_FIELDS) {
    const header = mapping[field];
    if (!header) continue;
    const idx = table.headers.indexOf(header);
    if (idx >= 0) colIndex.set(field, idx);
  }

  return table.rows.map((row, rowIndex) => {
    const errors: string[] = [];
    const get = (field: CsvImportTargetField): string => {
      const idx = colIndex.get(field);
      return idx === undefined ? "" : (row[idx] ?? "").trim();
    };

    const plate = get("plate");
    if (!plate) errors.push("placa ausente");

    const occurredAtRaw = get("occurredAt");
    const occurredAt = occurredAtRaw ? parseDateLike(occurredAtRaw) : null;
    if (!occurredAtRaw) errors.push("data da infração ausente");
    else if (!occurredAt) errors.push(`data da infração inválida: "${occurredAtRaw}"`);

    if (errors.length > 0) {
      return { rowIndex, infraction: null, errors };
    }

    const amountRaw = get("amountCents");
    const amountCents = amountRaw ? parseAmountCents(amountRaw) : null;
    if (amountRaw && amountCents === null) {
      errors.push(`valor inválido, importado sem valor: "${amountRaw}"`);
    }

    const infraction: ExternalInfraction = {
      source: "csv_import",
      externalId: null,
      autoNumber: get("autoNumber") || null,
      authorityCode: get("authorityCode") || null,
      authorityName: get("authorityName") || null,
      infractionCode: get("infractionCode") || null,
      description: get("description") || null,
      plate,
      renavam: get("renavam") || null,
      occurredAt: occurredAt!,
      location: get("location") || null,
      municipality: get("municipality") || null,
      state: get("state") || null,
      amountCents,
      amountCurrency: "BRL",
      dueDate: parseDateLike(get("dueDate")) || null,
      driverIdentificationDeadline: parseDateLike(get("driverIdentificationDeadline")) || null,
      defenseDeadline: parseDateLike(get("defenseDeadline")) || null,
      paymentDeadline: parseDateLike(get("paymentDeadline")) || null,
      discountDeadline: parseDateLike(get("discountDeadline")) || null,
      externalStatus: null,
      rawPayload: Object.fromEntries(table.headers.map((h, i) => [h, row[i] ?? null])),
    };

    return { rowIndex, infraction, errors };
  });
}
