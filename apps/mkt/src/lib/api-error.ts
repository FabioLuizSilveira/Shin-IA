import { NextResponse } from "next/server";

// Security fix (BAIXO-18): see apps/web/src/lib/api-error.ts for the
// rationale — same gap existed here.
export function internalError(err: unknown, status = 500) {
  console.error("[api]", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Internal server error" }, { status });
}
