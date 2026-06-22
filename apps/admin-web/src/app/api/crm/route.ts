import { NextResponse } from "next/server";
import { groupByStage, computePipelineValue } from "@/lib/crm";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

const MOCK_LEADS: Lead[] = [];

export async function GET() {
  const pipeline = groupByStage(MOCK_LEADS);
  const value = computePipelineValue(MOCK_LEADS);
  return NextResponse.json({ pipeline, value });
}
