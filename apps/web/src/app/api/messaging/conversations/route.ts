import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  listConversations,
  getUnreadCounts,
  type ConversationFilter,
} from "@shina/messaging-platform";

export const dynamic = "force-dynamic";

const VALID_FILTERS: ConversationFilter[] = [
  "all",
  "unassigned",
  "mine",
  "customers",
  "leads",
  "closed",
];

// WAVE 2 — Operational Inbox listing. Filters mirror spec section 11:
// Todas/Não atribuídas/Minhas/Clientes/Leads/Encerradas (Comercial/
// Cobrança/Operação are per-tenant team routing, not built in this wave).
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.conversation.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filterParam = req.nextUrl.searchParams.get("filter") as ConversationFilter | null;
  const filter = filterParam && VALID_FILTERS.includes(filterParam) ? filterParam : "all";

  try {
    const [conversations, unread] = await Promise.all([
      listConversations(scope.db, { tenantId: scope.tenantId, filter, userId: scope.userId }),
      getUnreadCounts(scope.db, scope.tenantId),
    ]);
    const unreadMap = Object.fromEntries(unread.map((u) => [u.conversationId, u.unreadCount]));
    return NextResponse.json({
      data: conversations.map((c) => ({ ...c, unreadCount: unreadMap[c.id] ?? 0 })),
    });
  } catch (err) {
    return internalError(err);
  }
}
