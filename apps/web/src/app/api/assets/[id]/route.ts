import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "in_use", "maintenance", "decommissioned"];

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
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "a valid status is required" }, { status: 422 });
  }

  const { data: current, error: fetchError } = await supabase
    .from("assets")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (current.status === "decommissioned") {
    return NextResponse.json(
      { error: "asset is decommissioned and cannot be changed" },
      { status: 422 },
    );
  }

  const { error: updateError } = await supabase
    .from("assets")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
