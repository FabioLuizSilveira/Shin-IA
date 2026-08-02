import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlueprintManifest } from "@shina/blueprint-runtime";

// asset_types.category is a fixed DB enum (vehicle/equipment/tool/property/
// technology, see supabase/migrations/20260002000000_enum_types.sql) while
// blueprint categories are domain-shaped (mobility/agriculture/construction/
// industrial/generic) — this is the mapping between the two.
const CATEGORY_MAP: Record<BlueprintManifest["category"], string> = {
  mobility: "vehicle",
  agriculture: "equipment",
  construction: "equipment",
  industrial: "equipment",
  generic: "tool",
};

// Installing a blueprint used to only store its config opaquely
// (BlueprintInstaller.install() never touched asset_types) — this is the
// integration gap the templates-de-tipo-de-ativo use case needs: turn a
// blueprint's customFields schema into a real, editable asset_types row so
// the tenant gets a ready-made classification instead of building one field
// by field.
export async function applyBlueprintToAssetTypes(
  db: SupabaseClient,
  tenantId: string,
  manifest: BlueprintManifest,
): Promise<void> {
  const attributes: Record<string, unknown> = {
    fields: manifest.customFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options ?? null,
      defaultValue: f.defaultValue ?? null,
    })),
  };

  const { data: existing, error: findError } = await db
    .from("asset_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", manifest.displayName)
    .is("deleted_at", null)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing) {
    const { error } = await db
      .from("asset_types")
      .update({ attributes, category: CATEGORY_MAP[manifest.category], active: true })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await db.from("asset_types").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    name: manifest.displayName,
    category: CATEGORY_MAP[manifest.category],
    attributes,
    metadata: { source: "blueprint", blueprintId: manifest.id },
  });
  if (error) throw new Error(error.message);
}
