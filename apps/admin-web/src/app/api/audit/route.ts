import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [ops, contracts, invoices] = await Promise.all([
    admin
      .from("operations")
      .select("id, type, status, updated_at, tenant_id, tenants(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    admin
      .from("contracts")
      .select("id, type, status, updated_at, tenant_id, tenants(name), organizations(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    admin
      .from("invoices")
      .select("id, status, total_amount, total_currency, updated_at, tenant_id, tenants(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  type AuditEvent = {
    id: string;
    tenant: string;
    action: string;
    resource: string;
    status: string;
    time: string;
    ts: number;
  };

  const events: AuditEvent[] = [];

  const typeLabels: Record<string, string> = {
    delivery: "Entrega",
    pickup: "Coleta",
    maintenance: "Manutenção",
    service: "Serviço",
    rental: "Locação",
    subscription: "Assinatura",
    inspection: "Inspeção",
    transfer: "Transferência",
  };

  for (const op of ops.data ?? []) {
    const tenant =
      (op.tenants as unknown as { name: string } | null)?.name ?? op.tenant_id.slice(0, 8);
    events.push({
      id: op.id,
      tenant,
      action: `operation.${op.status}`,
      resource: typeLabels[op.type] ?? op.type,
      status: op.status,
      time: new Date(op.updated_at).toLocaleString("pt-BR"),
      ts: new Date(op.updated_at).getTime(),
    });
  }

  for (const c of contracts.data ?? []) {
    const tenant =
      (c.tenants as unknown as { name: string } | null)?.name ?? c.tenant_id.slice(0, 8);
    const org = (c.organizations as unknown as { name: string } | null)?.name ?? "—";
    events.push({
      id: c.id,
      tenant,
      action: `contract.${c.status}`,
      resource: org,
      status: c.status,
      time: new Date(c.updated_at).toLocaleString("pt-BR"),
      ts: new Date(c.updated_at).getTime(),
    });
  }

  for (const inv of invoices.data ?? []) {
    const tenant =
      (inv.tenants as unknown as { name: string } | null)?.name ?? inv.tenant_id.slice(0, 8);
    const brl = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: inv.total_currency,
    }).format(Number(inv.total_amount));
    events.push({
      id: inv.id,
      tenant,
      action: `invoice.${inv.status}`,
      resource: brl,
      status: inv.status,
      time: new Date(inv.updated_at).toLocaleString("pt-BR"),
      ts: new Date(inv.updated_at).getTime(),
    });
  }

  events.sort((a, b) => b.ts - a.ts);
  const data = events.slice(0, 20).map(({ ts: _ts, ...rest }) => rest);

  return NextResponse.json({ data });
}
