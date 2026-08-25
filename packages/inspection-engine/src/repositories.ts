import type {
  BlueprintInspectionMapping,
  HydratedInspectionTemplate,
  InspectionPurpose,
} from "./types.js";

// Injected repository interfaces — same split as packages/tracking-
// engine's GeofenceEngine (constructor takes repos, never a Supabase
// client directly) and packages/blueprint-runtime's *Repository
// interfaces. The real Supabase-backed implementation lives in apps/web's
// lib/, not in this package.
export interface InspectionTemplateRepository {
  getHydratedTemplateById(templateId: string): Promise<HydratedInspectionTemplate | null>;
  getBlueprintMapping(
    blueprintId: string,
    purpose: InspectionPurpose,
  ): Promise<BlueprintInspectionMapping | null>;
}
