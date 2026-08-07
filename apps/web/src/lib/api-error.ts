import { NextResponse } from "next/server";

// Security fix (BAIXO-18): routes used to return raw Postgres/PostgREST
// error.message straight to the client — those messages routinely include
// internal schema details (table/column/constraint names, e.g. the
// blueprint_instances_tenant_blueprint_unique constraint name leaking on a
// duplicate-install attempt). This logs the real error server-side
// (captured by Sentry, already configured for this app) and returns a
// generic message instead — callers still get a proper status code, just
// not the internals.
export function internalError(err: unknown, status = 500) {
  console.error("[api]", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Internal server error" }, { status });
}
