import type { SupabaseClient } from "@supabase/supabase-js";
import { StudioRuntime, type StudioType } from "@shina/studio";
import {
  createStudioDraftRepository,
  createStudioVersionRepository,
} from "@/lib/studio-repository";

export const STUDIO_TYPES: StudioType[] = [
  "branding",
  "workflow",
  "rule",
  "access_control",
  "dashboard",
  "forms",
  "blueprint",
  "integration",
  "notification",
  "commercial",
];

export function isStudioType(value: string): value is StudioType {
  return (STUDIO_TYPES as string[]).includes(value);
}

export function createStudioRuntime(db: SupabaseClient): StudioRuntime {
  return new StudioRuntime(createStudioDraftRepository(db), createStudioVersionRepository(db));
}
