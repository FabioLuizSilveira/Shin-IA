import type { BlueprintCategory, BlueprintManifest } from "./types.js";

export class BlueprintRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BlueprintRegistryError";
  }
}

export class BlueprintRegistry {
  private readonly store = new Map<string, BlueprintManifest>();

  constructor(seed: BlueprintManifest[] = []) {
    for (const m of seed) {
      this.store.set(m.id, m);
    }
  }

  register(manifest: BlueprintManifest): void {
    this.store.set(manifest.id, manifest);
  }

  get(id: string): BlueprintManifest {
    const manifest = this.store.get(id);
    if (!manifest) {
      throw new BlueprintRegistryError(
        `Blueprint "${id}" is not registered`,
        "BLUEPRINT_NOT_FOUND",
      );
    }
    return manifest;
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  list(): BlueprintManifest[] {
    return Array.from(this.store.values());
  }

  listByCategory(category: BlueprintCategory): BlueprintManifest[] {
    return Array.from(this.store.values()).filter((m) => m.category === category);
  }

  listByStatus(status: BlueprintManifest["status"]): BlueprintManifest[] {
    return Array.from(this.store.values()).filter((m) => m.status === status);
  }

  unregister(id: string): void {
    if (!this.store.has(id)) {
      throw new BlueprintRegistryError(
        `Cannot unregister: blueprint "${id}" is not registered`,
        "BLUEPRINT_NOT_FOUND",
      );
    }
    this.store.delete(id);
  }
}
