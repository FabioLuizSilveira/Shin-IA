import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// Bulk asset import via spreadsheet (CSV) — the tenant-facing companion to
// the single-asset POST /api/assets form. Deliberately CSV-only, not real
// .xlsx: no parsing dependency needed (Excel/Sheets/Numbers all export CSV
// natively), matching the export side's own CSV-only choice (api/export).
//
// Same field set and defaults as the single-asset form: name + category +
// tipo are required, serial_number and status are optional, branch is
// always the tenant's oldest branch (this codebase doesn't ask for branch
// on single-asset creation either — see api/assets POST).
const CATEGORY_LABEL_TO_VALUE: Record<string, string> = {
  veículo: "vehicle",
  veiculo: "vehicle",
  equipamento: "equipment",
  ferramenta: "tool",
  imóvel: "property",
  imovel: "property",
  tecnologia: "technology",
};
const VALID_CATEGORIES = new Set(["vehicle", "equipment", "tool", "property", "technology"]);

const STATUS_LABEL_TO_VALUE: Record<string, string> = {
  disponível: "available",
  disponivel: "available",
  "em uso": "in_use",
  manutenção: "maintenance",
  manutencao: "maintenance",
  desativado: "decommissioned",
};
const VALID_STATUSES = new Set(["available", "in_use", "maintenance", "decommissioned"]);

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Minimal CSV parser — quoted fields (with escaped "" inside), comma OR
// semicolon delimiter (auto-detected from the header line: pt-BR Excel
// exports semicolon-delimited CSV by default, everything else uses comma).
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

interface ImportError {
  line: number;
  error: string;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo CSV no campo 'file'." }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Planilha vazia — inclua o cabeçalho e ao menos uma linha de dados." },
      { status: 422 },
    );
  }

  const header = rows[0].map((h) => normalize(h));
  const col = (name: string) => header.indexOf(name);
  const idxName = col("nome");
  const idxCategory = col("categoria");
  const idxType = col("tipo");
  const idxSerial = col("numero_serie") !== -1 ? col("numero_serie") : col("número_série");
  const idxStatus = col("status");

  if (idxName === -1 || idxCategory === -1 || idxType === -1) {
    return NextResponse.json(
      {
        error:
          "Cabeçalho inválido. Colunas obrigatórias: nome, categoria, tipo. Baixe o modelo pra conferir.",
      },
      { status: 422 },
    );
  }

  const { data: branch, error: branchError } = await scope.db
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchError) return internalError(branchError);
  if (!branch) {
    return NextResponse.json({ error: "Tenant não tem filial cadastrada." }, { status: 422 });
  }

  const { data: assetTypes, error: typesError } = await scope.db
    .from("asset_types")
    .select("id, name, category")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .is("deleted_at", null);
  if (typesError) return internalError(typesError);
  const typeByKey = new Map(
    (assetTypes ?? []).map((t) => [`${t.category}::${normalize(t.name)}`, t.id]),
  );

  interface PendingRow {
    line: number;
    row: {
      id: string;
      tenant_id: string;
      branch_id: string;
      asset_type_id: string;
      name: string;
      serial_number: string | null;
      category: string;
      status: string;
    };
  }
  const errors: ImportError[] = [];
  const toInsert: PendingRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const line = i + 1; // 1-based, matching what a spreadsheet app shows
    const r = rows[i];
    const name = (r[idxName] ?? "").trim();
    const categoryRaw = normalize(r[idxCategory] ?? "");
    const typeRaw = (r[idxType] ?? "").trim();
    const serial = idxSerial !== -1 ? (r[idxSerial] ?? "").trim() : "";
    const statusRaw = idxStatus !== -1 ? normalize(r[idxStatus] ?? "") : "";

    if (!name) {
      errors.push({ line, error: "nome em branco" });
      continue;
    }
    const category = CATEGORY_LABEL_TO_VALUE[categoryRaw] ?? categoryRaw;
    if (!VALID_CATEGORIES.has(category)) {
      errors.push({
        line,
        error: `categoria "${r[idxCategory]}" inválida (use: Veículo, Equipamento, Ferramenta, Imóvel, Tecnologia)`,
      });
      continue;
    }
    if (!typeRaw) {
      errors.push({ line, error: "tipo em branco" });
      continue;
    }
    const assetTypeId = typeByKey.get(`${category}::${normalize(typeRaw)}`);
    if (!assetTypeId) {
      errors.push({
        line,
        error: `tipo "${typeRaw}" não encontrado para a categoria "${r[idxCategory]}" — cadastre o tipo antes de importar`,
      });
      continue;
    }
    let status = "available";
    if (statusRaw) {
      const mapped = STATUS_LABEL_TO_VALUE[statusRaw] ?? statusRaw;
      if (!VALID_STATUSES.has(mapped)) {
        errors.push({
          line,
          error: `status "${r[idxStatus]}" inválido (use: Disponível, Em uso, Manutenção, Desativado)`,
        });
        continue;
      }
      status = mapped;
    }

    toInsert.push({
      line,
      row: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        branch_id: branch.id,
        asset_type_id: assetTypeId,
        name,
        serial_number: serial || null,
        category,
        status,
      },
    });
  }

  // Row-by-row, not a single bulk insert: a duplicate serial_number (the
  // tenant's own unique index, or a repeat within the file) would fail an
  // all-in-one insert entirely, turning one bad row into zero imported
  // rows. Slower for large files, but "created: 47, errors: [line 12]" is
  // the whole point of a spreadsheet import — silently succeeding all or
  // nothing defeats it.
  let createdCount = 0;
  for (const { line, row } of toInsert) {
    const { error: insertError } = await scope.db.from("assets").insert(row);
    if (insertError) {
      errors.push({
        line,
        error:
          insertError.code === "23505"
            ? `número de série "${row.serial_number}" já cadastrado neste tenant`
            : insertError.message,
      });
      continue;
    }
    createdCount++;
  }

  if (createdCount > 0) {
    void logActivity(scope.db, {
      tenantId,
      actorId: scope.userId,
      entityType: "asset",
      entityId: "bulk",
      action: "bulk_imported",
      metadata: { count: createdCount, errorCount: errors.length, filename: file.name },
    });
  }

  errors.sort((a, b) => a.line - b.line);

  return NextResponse.json({
    data: {
      created: createdCount,
      totalRows: rows.length - 1,
      errors,
    },
  });
}
