import { NextResponse } from "next/server";
import { groupInvoicesByStatus, computeOutstandingBalance } from "@/lib/billing";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

const MOCK_INVOICES: Invoice[] = [];

export async function GET() {
  const grouped = groupInvoicesByStatus(MOCK_INVOICES);
  const outstanding = computeOutstandingBalance(MOCK_INVOICES);
  return NextResponse.json({ grouped, outstanding });
}
