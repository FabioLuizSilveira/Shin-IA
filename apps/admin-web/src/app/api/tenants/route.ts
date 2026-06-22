import { NextResponse } from "next/server";
import { filterTenantsByStatus, sortTenantsByRevenue } from "@/lib/tenants";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

const MOCK_TENANTS: Tenant[] = [];

export async function GET() {
  const active = filterTenantsByStatus(MOCK_TENANTS, "active");
  const sorted = sortTenantsByRevenue(active);
  return NextResponse.json({ tenants: sorted, total: MOCK_TENANTS.length });
}
