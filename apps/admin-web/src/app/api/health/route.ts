import { NextResponse } from "next/server";
import { computeHealthStatus } from "@/lib/health";
import type { HealthCheck } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATFORM_CHECKS: HealthCheck[] = [
  { name: "API Gateway", status: "healthy", latencyMs: 12 },
  { name: "Database", status: "healthy", latencyMs: 4 },
  { name: "Cache", status: "healthy", latencyMs: 1 },
];

export async function GET() {
  const result = computeHealthStatus(PLATFORM_CHECKS);
  return NextResponse.json(result);
}
