import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BlueprintRuntime,
  type BlueprintInstance,
  type BlueprintInstanceRepository,
  type BlueprintManifest,
  type BlueprintManifestRepository,
  type BlueprintVersion,
  type BlueprintVersionRepository,
} from "@shina/blueprint-runtime";

function rowToInstance(row: {
  id: string;
  tenant_id: string;
  blueprint_id: string;
  blueprint_version: string;
  config: Record<string, unknown>;
  status: string;
  installed_at: string;
  updated_at: string;
  installed_by: string;
}): BlueprintInstance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    blueprintId: row.blueprint_id,
    blueprintVersion: row.blueprint_version,
    config: row.config,
    status: row.status as BlueprintInstance["status"],
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
    installedBy: row.installed_by,
  };
}

function createInstanceRepository(db: SupabaseClient): BlueprintInstanceRepository {
  return {
    async save(instance) {
      const { data, error } = await db
        .from("blueprint_instances")
        .upsert(
          {
            id: instance.id,
            tenant_id: instance.tenantId,
            blueprint_id: instance.blueprintId,
            blueprint_version: instance.blueprintVersion,
            config: instance.config,
            status: instance.status,
            installed_at: instance.installedAt,
            updated_at: instance.updatedAt,
            installed_by: instance.installedBy,
          },
          { onConflict: "tenant_id,blueprint_id" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return rowToInstance(data);
    },
    async findById(id) {
      const { data, error } = await db
        .from("blueprint_instances")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToInstance(data) : null;
    },
    async findByTenant(tenantId) {
      const { data, error } = await db
        .from("blueprint_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("installed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToInstance);
    },
    async findByTenantAndBlueprint(tenantId, blueprintId) {
      const { data, error } = await db
        .from("blueprint_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("blueprint_id", blueprintId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToInstance(data) : null;
    },
    async delete(id) {
      const { error } = await db.from("blueprint_instances").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

// No manifest/version persistence — the registry is always seeded in-memory
// from BUILT_IN_BLUEPRINTS (see runtime.ts), and this integration only uses
// install/uninstall, which never touch these repos. Stubs satisfy the
// runtime's constructor without pretending to back real storage.
function createNoopManifestRepository(): BlueprintManifestRepository {
  return {
    async save(manifest) {
      return manifest;
    },
    async findById() {
      return null;
    },
    async findAll() {
      return [];
    },
    async findByCategory() {
      return [];
    },
    async delete() {},
  };
}

function createNoopVersionRepository(): BlueprintVersionRepository {
  return {
    async save(version: BlueprintVersion) {
      return version;
    },
    async findByBlueprintAndVersion() {
      return null;
    },
    async findLatest() {
      return null;
    },
    async listByBlueprint() {
      return [];
    },
    async markAllNotLatest() {},
  };
}

export function createBlueprintRuntime(db: SupabaseClient): BlueprintRuntime {
  return new BlueprintRuntime({
    manifestRepo: createNoopManifestRepository(),
    instanceRepo: createInstanceRepository(db),
    versionRepo: createNoopVersionRepository(),
    seedBuiltIns: true,
  });
}

export type { BlueprintManifest };
