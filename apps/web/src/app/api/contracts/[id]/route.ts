import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, created_at, organizations(id, name, type, document, email)";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  return NextResponse.json({ data });
}

// Matches components/ui/contract-detail.tsx's ACTIONS map exactly.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "terminated"],
  active: ["suspended", "terminated"],
  suspended: ["active", "terminated"],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { status?: string };
  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabase
    .from("contracts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
