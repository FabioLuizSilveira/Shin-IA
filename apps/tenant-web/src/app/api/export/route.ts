import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

type ExportEntity =
  | "operations"
  | "assets"
  | "contracts"
  | "invoices"
  | "resources"
  | "organizations";

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity") as ExportEntity | null;
  if (!entity) return new Response("Missing entity param", { status: 400 });

  const admin = createAdminClient();
  let rows: Record<string, unknown>[] = [];
  let filename = `${entity}-export`;

  if (entity === "operations") {
    const { data } = await admin
      .from("operations")
      .select(
        "id, type, status, scheduled_starts_at, scheduled_ends_at, started_at, completed_at, resources(name)",
      )
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = (data ?? []).map((r) => ({
      id: r.id,
      tipo: r.type,
      status: r.status,
      recurso: (r.resources as unknown as { name: string } | null)?.name ?? "",
      inicio_previsto: r.scheduled_starts_at
        ? new Date(r.scheduled_starts_at).toLocaleString("pt-BR")
        : "",
      fim_previsto: r.scheduled_ends_at
        ? new Date(r.scheduled_ends_at).toLocaleString("pt-BR")
        : "",
      iniciada_em: r.started_at ? new Date(r.started_at).toLocaleString("pt-BR") : "",
      concluida_em: r.completed_at ? new Date(r.completed_at).toLocaleString("pt-BR") : "",
    }));
    filename = "operacoes";
  } else if (entity === "assets") {
    const { data } = await admin
      .from("assets")
      .select("id, name, category, status, serial_number, created_at")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("name");
    rows = (data ?? []).map((r) => ({
      id: r.id,
      nome: r.name,
      categoria: r.category,
      status: r.status,
      numero_serie: r.serial_number ?? "",
      criado_em: new Date(r.created_at).toLocaleString("pt-BR"),
    }));
    filename = "ativos";
  } else if (entity === "contracts") {
    const { data } = await admin
      .from("contracts")
      .select(
        "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organizations(name)",
      )
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = (data ?? []).map((r) => ({
      id: r.id,
      tipo: r.type,
      status: r.status,
      organizacao: (r.organizations as unknown as { name: string } | null)?.name ?? "",
      valor: r.value_amount,
      moeda: r.value_currency,
      inicio: r.period_starts_at ? new Date(r.period_starts_at).toLocaleDateString("pt-BR") : "",
      fim: r.period_ends_at ? new Date(r.period_ends_at).toLocaleDateString("pt-BR") : "",
    }));
    filename = "contratos";
  } else if (entity === "invoices") {
    const { data } = await admin
      .from("invoices")
      .select(
        "id, status, total_amount, total_currency, due_date, paid_at, billing_accounts(organizations(name))",
      )
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = (data ?? []).map((r) => {
      const ba = r.billing_accounts as unknown as {
        organizations?: { name: string };
      } | null;
      return {
        id: r.id,
        status: r.status,
        organizacao: ba?.organizations?.name ?? "",
        valor: r.total_amount,
        moeda: r.total_currency,
        vencimento: new Date(r.due_date).toLocaleDateString("pt-BR"),
        pago_em: r.paid_at ? new Date(r.paid_at).toLocaleString("pt-BR") : "",
      };
    });
    filename = "faturas";
  } else if (entity === "resources") {
    const { data } = await admin
      .from("resources")
      .select("id, name, type, status, created_at")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("name");
    rows = (data ?? []).map((r) => ({
      id: r.id,
      nome: r.name,
      tipo: r.type,
      status: r.status,
      criado_em: new Date(r.created_at).toLocaleString("pt-BR"),
    }));
    filename = "recursos";
  } else if (entity === "organizations") {
    const { data } = await admin
      .from("organizations")
      .select("id, name, type, document, email, address_city, address_state")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("name");
    rows = (data ?? []).map((r) => ({
      id: r.id,
      nome: r.name,
      tipo: r.type,
      documento: r.document,
      email: r.email ?? "",
      cidade: r.address_city,
      estado: r.address_state,
    }));
    filename = "organizacoes";
  } else {
    return new Response("Unknown entity", { status: 400 });
  }

  const csv = toCsv(rows);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${today}.csv"`,
    },
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return "﻿" + lines.join("\r\n"); // BOM for Excel UTF-8 compatibility
}
