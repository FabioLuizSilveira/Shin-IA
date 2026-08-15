import type { TenantScope } from "@/lib/tenant-context";

// Wave 0.8 — ABAC branch scope, resolved and validated entirely server-side.
// The mobile audit found branch_scope_mode/branch_id computed into every
// JWT (branch_ids claim) but enforced in only 2 routes in the whole
// codebase — a real gap. This module is the reusable enforcement primitive
// for any future mobile route that touches a branch-scoped resource; no
// route in this wave consumes it yet (Wave 1 is bootstrap-only), but it's
// built and tested now so the pattern exists before the gap gets copied
// into new code.
//
// Never trust a branch_id supplied by the client for this decision — the
// resolver only reads tenant_user_roles (the same table the JWT's
// branch_ids claim is itself computed from) and, for branch_and_children,
// walks branches.parent_id server-side.
export interface BranchScope {
  mode: "root" | "branch" | "branch_and_children" | "custom";
  allowedBranchIds: string[] | null; // null = unrestricted (root)
}

export async function resolveActiveBranchScope(scope: TenantScope): Promise<BranchScope> {
  const { data: userRoles } = await scope.db
    .from("tenant_user_roles")
    .select("branch_scope_mode, branch_id")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .is("deleted_at", null);

  const rows = userRoles ?? [];
  if (rows.length === 0) return { mode: "custom", allowedBranchIds: [] };
  if (rows.some((r) => r.branch_scope_mode === "root")) {
    return { mode: "root", allowedBranchIds: null };
  }

  const directBranchIds = rows.map((r) => r.branch_id).filter((id): id is string => !!id);

  if (rows.every((r) => r.branch_scope_mode === "branch")) {
    return { mode: "branch", allowedBranchIds: Array.from(new Set(directBranchIds)) };
  }

  // branch_and_children: expand each direct branch to include its
  // descendants, walked from `branches` (parent_id), not from anything the
  // client asserts.
  const allowed = new Set(directBranchIds);
  let frontier = directBranchIds;
  while (frontier.length > 0) {
    const { data: children } = await scope.db
      .from("branches")
      .select("id")
      .in("parent_id", frontier)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    const next = (children ?? []).map((c) => c.id).filter((id) => !allowed.has(id));
    next.forEach((id) => allowed.add(id));
    frontier = next;
  }

  return { mode: "branch_and_children", allowedBranchIds: Array.from(allowed) };
}

// Validates that a specific branchId is actually within scope — the
// function a route calls before returning/mutating a branch-scoped
// resource, instead of trusting a branch_id read off the request.
export async function assertBranchAccess(scope: TenantScope, branchId: string): Promise<boolean> {
  const branchScope = await resolveActiveBranchScope(scope);
  if (branchScope.allowedBranchIds === null) return true; // root
  return branchScope.allowedBranchIds.includes(branchId);
}
