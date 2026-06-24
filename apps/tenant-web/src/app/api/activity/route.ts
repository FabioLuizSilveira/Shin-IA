import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [ops, contracts, invoices, resources] = await Promise.all([
    admin
      .from("operations")
      .select("id, type, status, updated_at, resources(name)")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    admin
      .from("contracts")
      .select("id, type, status, updated_at, organizations(name)")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("invoices")
      .select(
        "id, status, total_amount, total_currency, updated_at, billing_accounts(organizations(name))",
      )
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("resources")
      .select("id, name, type, status, updated_at")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(4),
  ]);

  type Event = {
    time: string;
    title: string;
    description: string;
    type: "info" | "success" | "warning" | "error";
    ts: number;
  };
  const events: Event[] = [];

  const typeLabels: Record<string, string> = {
    delivery: "Entrega",
    pickup: "Coleta",
    maintenance: "Manutenção",
    inspection: "Inspeção",
    transfer: "Transferência",
    service: "Serviço",
    rental: "Locação",
    subscription: "Assinatura",
    human: "Humano",
    vehicle: "Veículo",
    equipment: "Equipamento",
  };

  // Operations events
  for (const op of ops.data ?? []) {
    const label = typeLabels[op.type] ?? op.type;
    const resource = (op.resources as unknown as { name: string } | null)?.name ?? "—";
    let evType: Event["type"] = "info";
    let title = `Operação ${label}`;

    if (op.status === "completed") {
      evType = "success";
      title = `Operação concluída: ${label}`;
    } else if (op.status === "failed") {
      evType = "error";
      title = `Operação falhou: ${label}`;
    } else if (op.status === "cancelled") {
      evType = "warning";
      title = `Operação cancelada: ${label}`;
    } else if (op.status === "in_progress") {
      evType = "info";
      title = `Operação em andamento: ${label}`;
    }

    events.push({
      ts: new Date(op.updated_at).getTime(),
      time: formatRelative(op.updated_at),
      title,
      description: `Recurso: ${resource}`,
      type: evType,
    });
  }

  // Contracts events
  for (const c of contracts.data ?? []) {
    const orgName = (c.organizations as unknown as { name: string } | null)?.name ?? "—";
    let evType: Event["type"] = "info";
    let title = `Contrato atualizado`;

    if (c.status === "active") {
      evType = "success";
      title = "Contrato ativado";
    } else if (c.status === "terminated") {
      evType = "error";
      title = "Contrato encerrado";
    } else if (c.status === "suspended") {
      evType = "warning";
      title = "Contrato suspenso";
    }

    events.push({
      ts: new Date(c.updated_at).getTime(),
      time: formatRelative(c.updated_at),
      title,
      description: orgName,
      type: evType,
    });
  }

  // Invoices events
  for (const inv of invoices.data ?? []) {
    const billingAcc = inv.billing_accounts as unknown as {
      organizations?: { name: string };
    } | null;
    const orgName = billingAcc?.organizations?.name ?? "—";
    const brl = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: inv.total_currency,
    }).format(Number(inv.total_amount));
    let evType: Event["type"] = "info";
    let title = "Fatura atualizada";

    if (inv.status === "paid") {
      evType = "success";
      title = `Fatura paga: ${brl}`;
    } else if (inv.status === "overdue") {
      evType = "error";
      title = `Fatura vencida: ${brl}`;
    } else if (inv.status === "issued") {
      evType = "info";
      title = `Fatura emitida: ${brl}`;
    }

    events.push({
      ts: new Date(inv.updated_at).getTime(),
      time: formatRelative(inv.updated_at),
      title,
      description: orgName,
      type: evType,
    });
  }

  // Resources events
  for (const r of resources.data ?? []) {
    const typeLabel = typeLabels[r.type] ?? r.type;
    let evType: Event["type"] = "info";
    let title = `Recurso atualizado`;

    if (r.status === "available") {
      evType = "success";
      title = `Recurso disponível`;
    } else if (r.status === "busy") {
      evType = "info";
      title = `Recurso ocupado`;
    } else if (r.status === "maintenance") {
      evType = "warning";
      title = `Recurso em manutenção`;
    } else if (r.status === "offline") {
      evType = "warning";
      title = `Recurso offline`;
    }

    events.push({
      ts: new Date(r.updated_at).getTime(),
      time: formatRelative(r.updated_at),
      title,
      description: `${r.name} · ${typeLabel}`,
      type: evType,
    });
  }

  // Sort by most recent, take top 12
  events.sort((a, b) => b.ts - a.ts);
  const items = events.slice(0, 12).map(({ ts: _ts, ...rest }) => rest);

  return NextResponse.json({ data: items });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}
