import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnyStudioConfig,
  StudioDraft,
  StudioDraftRepository,
  StudioType,
  StudioVersion,
  StudioVersionRepository,
} from "@shina/studio";

// Supabase-backed adapters for @shina/studio's generic draft/publish/version
// model — one implementation serves all 10 studio types (see
// supabase/migrations/20260058000000_studio.sql for why this is only two
// tables, not ten).

interface DraftRow {
  id: string;
  tenant_id: string;
  studio_type: string;
  config: AnyStudioConfig;
  updated_at: string;
  updated_by: string;
}

interface VersionRow {
  id: string;
  tenant_id: string;
  studio_type: string;
  version: number;
  config: AnyStudioConfig;
  published_at: string;
  published_by: string;
  changelog: string | null;
}

function rowToDraft(row: DraftRow): StudioDraft<AnyStudioConfig> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studioType: row.studio_type as StudioType,
    config: row.config,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function rowToVersion(row: VersionRow): StudioVersion<AnyStudioConfig> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studioType: row.studio_type as StudioType,
    version: row.version,
    config: row.config,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    changelog: row.changelog ?? undefined,
  };
}

export function createStudioDraftRepository(db: SupabaseClient): StudioDraftRepository {
  return {
    async save(draft) {
      const { data, error } = await db
        .from("studio_drafts")
        .upsert(
          {
            tenant_id: draft.tenantId,
            studio_type: draft.studioType,
            config: draft.config,
            updated_at: draft.updatedAt,
            updated_by: draft.updatedBy,
          },
          { onConflict: "tenant_id,studio_type" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return rowToDraft(data as DraftRow);
    },
    async findByStudio(studioType, tenantId) {
      const { data, error } = await db
        .from("studio_drafts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("studio_type", studioType)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToDraft(data as DraftRow) : null;
    },
    async delete(studioType, tenantId) {
      const { error } = await db
        .from("studio_drafts")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("studio_type", studioType);
      if (error) throw new Error(error.message);
    },
  };
}

export function createStudioVersionRepository(db: SupabaseClient): StudioVersionRepository {
  return {
    async save(version) {
      const { data, error } = await db
        .from("studio_versions")
        .insert({
          tenant_id: version.tenantId,
          studio_type: version.studioType,
          version: version.version,
          config: version.config,
          published_at: version.publishedAt,
          published_by: version.publishedBy,
          changelog: version.changelog ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return rowToVersion(data as VersionRow);
    },
    async findById(id) {
      const { data, error } = await db
        .from("studio_versions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToVersion(data as VersionRow) : null;
    },
    async findLatest(studioType, tenantId) {
      const { data, error } = await db
        .from("studio_versions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("studio_type", studioType)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToVersion(data as VersionRow) : null;
    },
    async listByStudio(studioType, tenantId) {
      const { data, error } = await db
        .from("studio_versions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("studio_type", studioType)
        .order("version", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => rowToVersion(row as VersionRow));
    },
  };
}
