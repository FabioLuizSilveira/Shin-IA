import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlueprintInspectionMapping,
  HydratedInspectionTemplate,
  InspectionFieldType,
  InspectionPurpose,
  InspectionTemplateItem,
  InspectionTemplateRepository,
  InspectionTemplateStatus,
  SelectOption,
} from "@shina/inspection-engine";

// Row -> domain mapping, same split as blueprint-runtime-factory.ts: this
// file is the only place that knows about snake_case columns; everything
// downstream (packages/inspection-engine, API routes) works with the
// camelCase domain shape.
interface TemplateRow {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  asset_type_id: string | null;
  status: string;
  version: number;
}

interface SectionRow {
  id: string;
  template_id: string;
  key: string;
  title: string;
  instructions: string | null;
  sort_order: number;
}

interface ItemRow {
  id: string;
  section_id: string;
  template_id: string;
  key: string;
  label: string;
  field_type: string;
  required: boolean;
  instructions: string | null;
  reference_image_url: string | null;
  min_photos: number | null;
  max_photos: number | null;
  select_options: SelectOption[] | null;
  condition: InspectionTemplateItem["condition"];
  approval_gate: boolean;
  sort_order: number;
}

function rowToItem(row: ItemRow): InspectionTemplateItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    templateId: row.template_id,
    key: row.key,
    label: row.label,
    fieldType: row.field_type as InspectionFieldType,
    required: row.required,
    instructions: row.instructions,
    referenceImageUrl: row.reference_image_url,
    minPhotos: row.min_photos,
    maxPhotos: row.max_photos,
    selectOptions: row.select_options,
    condition: row.condition,
    approvalGate: row.approval_gate,
    sortOrder: row.sort_order,
  };
}

export function createInspectionTemplateRepository(
  db: SupabaseClient,
): InspectionTemplateRepository {
  return {
    async getHydratedTemplateById(templateId: string): Promise<HydratedInspectionTemplate | null> {
      const { data: templateRow, error: templateError } = await db
        .from("inspection_templates")
        .select("id, tenant_id, key, name, asset_type_id, status, version")
        .eq("id", templateId)
        .is("deleted_at", null)
        .maybeSingle<TemplateRow>();
      if (templateError) throw new Error(templateError.message);
      if (!templateRow) return null;

      const { data: sectionRows, error: sectionsError } = await db
        .from("inspection_template_sections")
        .select("id, template_id, key, title, instructions, sort_order")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true })
        .returns<SectionRow[]>();
      if (sectionsError) throw new Error(sectionsError.message);

      const { data: itemRows, error: itemsError } = await db
        .from("inspection_template_items")
        .select(
          "id, section_id, template_id, key, label, field_type, required, instructions, reference_image_url, min_photos, max_photos, select_options, condition, approval_gate, sort_order",
        )
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true })
        .returns<ItemRow[]>();
      if (itemsError) throw new Error(itemsError.message);

      const itemsBySectionId = new Map<string, InspectionTemplateItem[]>();
      for (const row of itemRows ?? []) {
        const item = rowToItem(row);
        const list = itemsBySectionId.get(item.sectionId) ?? [];
        list.push(item);
        itemsBySectionId.set(item.sectionId, list);
      }

      return {
        id: templateRow.id,
        tenantId: templateRow.tenant_id,
        key: templateRow.key,
        name: templateRow.name,
        assetTypeId: templateRow.asset_type_id,
        status: templateRow.status as InspectionTemplateStatus,
        version: templateRow.version,
        sections: (sectionRows ?? []).map((section) => ({
          id: section.id,
          templateId: section.template_id,
          key: section.key,
          title: section.title,
          instructions: section.instructions,
          sortOrder: section.sort_order,
          items: itemsBySectionId.get(section.id) ?? [],
        })),
      };
    },

    async getBlueprintMapping(
      blueprintId: string,
      purpose: InspectionPurpose,
    ): Promise<BlueprintInspectionMapping | null> {
      const { data, error } = await db
        .from("blueprint_inspection_mappings")
        .select(
          "id, blueprint_id, purpose, template_id, is_default, required, ai_damage_detection_enabled, ai_requires_human_approval",
        )
        .eq("blueprint_id", blueprintId)
        .eq("purpose", purpose)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id,
        blueprintId: data.blueprint_id,
        purpose: data.purpose as InspectionPurpose,
        templateId: data.template_id,
        isDefault: data.is_default,
        required: data.required,
        aiDamageDetectionEnabled: data.ai_damage_detection_enabled,
        aiRequiresHumanApproval: data.ai_requires_human_approval,
      };
    },
  };
}
