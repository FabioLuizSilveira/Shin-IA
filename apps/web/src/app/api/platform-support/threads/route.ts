import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requirePlatformRole } from "@/lib/platform-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/platform-support/threads — one row per tenant that has ever
// exchanged a support message, with its latest message and whether the
// platform side has unread messages from that tenant. Powers both the
// platform bell (aggregate unread count) and the thread-picker list in
// platform/support.
export async function GET() {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: messages, error } = await admin
    .from("support_messages")
    .select("id, tenant_id, sender_role, body, created_at, read_by_platform_at, tenants(name)")
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  const byTenant = new Map<
    string,
    {
      tenantId: string;
      tenantName: string;
      lastMessage: string;
      lastSenderRole: string;
      lastCreatedAt: string;
      unreadCount: number;
    }
  >();

  for (const m of messages ?? []) {
    const tenantName = (m as unknown as { tenants: { name: string }[] | { name: string } | null })
      .tenants;
    const resolvedTenantName = Array.isArray(tenantName)
      ? (tenantName[0]?.name ?? "—")
      : (tenantName?.name ?? "—");
    const existing = byTenant.get(m.tenant_id);
    if (!existing) {
      byTenant.set(m.tenant_id, {
        tenantId: m.tenant_id,
        tenantName: resolvedTenantName,
        lastMessage: m.body,
        lastSenderRole: m.sender_role,
        lastCreatedAt: m.created_at,
        unreadCount: m.sender_role === "tenant" && !m.read_by_platform_at ? 1 : 0,
      });
    } else if (m.sender_role === "tenant" && !m.read_by_platform_at) {
      existing.unreadCount += 1;
    }
  }

  return NextResponse.json({ data: Array.from(byTenant.values()) });
}
