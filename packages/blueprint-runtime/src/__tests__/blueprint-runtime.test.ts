import { describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_BLUEPRINTS,
  BlueprintConfigurator,
  BlueprintConfiguratorError,
  BlueprintInstaller,
  BlueprintInstallerError,
  BlueprintRegistry,
  BlueprintRegistryError,
  BlueprintRuntime,
  BlueprintVersioning,
  BlueprintVersioningError,
} from "../index.js";
import type {
  BlueprintInstance,
  BlueprintInstanceRepository,
  BlueprintManifest,
  BlueprintManifestRepository,
  BlueprintVersion,
  BlueprintVersionRepository,
} from "../index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Installer/configurator lifecycle tests below exercise install/uninstall/
// upgrade mechanics, not the real "mobility" blueprint's business fields —
// deliberately a local fixture with no required fields (rather than pulling
// the real BUILT_IN_BLUEPRINTS entry, which now has real customFields for
// the fleet/rental domain — see built-ins.ts) so these tests stay decoupled
// from that content.
const realMobility = BUILT_IN_BLUEPRINTS.find((b) => b.id === "mobility")!;
const mobilityManifest: BlueprintManifest = { ...realMobility, customFields: [] };

const customManifest: BlueprintManifest = {
  id: "custom-test",
  name: "custom-test",
  displayName: "Custom Test Blueprint",
  version: "1.0.0",
  category: "generic",
  description: "A custom test blueprint",
  author: "Test",
  capabilities: {
    tracking: true,
    maintenance: false,
    commercial: false,
    notifications: true,
    reporting: false,
    workflow: false,
    integration: false,
  },
  customFields: [
    { key: "fleetSize", label: "Fleet Size", type: "number", required: true },
    { key: "region", label: "Region", type: "text", required: false },
  ],
  dependencies: [],
  minPlatformVersion: "2.0.0",
  status: "active",
};

function makeInstance(overrides: Partial<BlueprintInstance> = {}): BlueprintInstance {
  return {
    id: "inst-1",
    tenantId: "t1",
    blueprintId: "mobility",
    blueprintVersion: "1.0.0",
    config: {},
    status: "active",
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    installedBy: "actor1",
    ...overrides,
  };
}

function makeInstanceRepo(instance: BlueprintInstance | null = null): BlueprintInstanceRepository {
  return {
    save: vi.fn().mockImplementation((i: BlueprintInstance) => Promise.resolve(i)),
    findById: vi.fn().mockResolvedValue(instance),
    findByTenant: vi.fn().mockResolvedValue(instance ? [instance] : []),
    findByTenantAndBlueprint: vi.fn().mockResolvedValue(instance),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeVersionRepo(
  version: BlueprintVersion | null = null,
  versions: BlueprintVersion[] = [],
): BlueprintVersionRepository {
  return {
    save: vi.fn().mockImplementation((v: BlueprintVersion) => Promise.resolve(v)),
    findByBlueprintAndVersion: vi.fn().mockResolvedValue(version),
    findLatest: vi.fn().mockResolvedValue(version),
    listByBlueprint: vi.fn().mockResolvedValue(versions),
    markAllNotLatest: vi.fn().mockResolvedValue(undefined),
  };
}

function makeManifestRepo(): BlueprintManifestRepository {
  return {
    save: vi.fn().mockImplementation((m: BlueprintManifest) => Promise.resolve(m)),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findByCategory: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── BlueprintRegistry ────────────────────────────────────────────────────────

describe("BlueprintRegistry", () => {
  it("initializes with seeded blueprints", () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    expect(registry.has("mobility")).toBe(true);
  });

  it("initializes empty by default", () => {
    const registry = new BlueprintRegistry();
    expect(registry.list()).toHaveLength(0);
  });

  it("registers a new blueprint", () => {
    const registry = new BlueprintRegistry();
    registry.register(customManifest);
    expect(registry.has("custom-test")).toBe(true);
  });

  it("gets a registered blueprint", () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const bp = registry.get("mobility");
    expect(bp.displayName).toBe("Mobility");
  });

  it("throws on get for unknown blueprint", () => {
    const registry = new BlueprintRegistry();
    expect(() => registry.get("unknown")).toThrow(BlueprintRegistryError);
  });

  it("BlueprintRegistryError has correct code", () => {
    const registry = new BlueprintRegistry();
    try {
      registry.get("nope");
    } catch (e) {
      expect((e as BlueprintRegistryError).code).toBe("BLUEPRINT_NOT_FOUND");
    }
  });

  it("lists all blueprints", () => {
    const registry = new BlueprintRegistry(BUILT_IN_BLUEPRINTS);
    expect(registry.list().length).toBe(BUILT_IN_BLUEPRINTS.length);
  });

  it("lists blueprints by category", () => {
    const registry = new BlueprintRegistry(BUILT_IN_BLUEPRINTS);
    const mobility = registry.listByCategory("mobility");
    expect(mobility.length).toBeGreaterThan(0);
    expect(mobility.every((b) => b.category === "mobility")).toBe(true);
  });

  it("lists blueprints by status", () => {
    const registry = new BlueprintRegistry(BUILT_IN_BLUEPRINTS);
    const active = registry.listByStatus("active");
    expect(active.length).toBeGreaterThan(0);
  });

  it("lists empty when category has no blueprints", () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    expect(registry.listByCategory("construction")).toHaveLength(0);
  });

  it("unregisters a blueprint", () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    registry.unregister("mobility");
    expect(registry.has("mobility")).toBe(false);
  });

  it("throws when unregistering unknown blueprint", () => {
    const registry = new BlueprintRegistry();
    expect(() => registry.unregister("unknown")).toThrow(BlueprintRegistryError);
  });
});

// ─── BUILT_IN_BLUEPRINTS ──────────────────────────────────────────────────────

describe("BUILT_IN_BLUEPRINTS", () => {
  it("has 10 blueprints", () => {
    expect(BUILT_IN_BLUEPRINTS).toHaveLength(10);
  });

  it("all have valid categories", () => {
    const validCategories = ["mobility", "agriculture", "construction", "industrial", "generic"];
    for (const bp of BUILT_IN_BLUEPRINTS) {
      expect(validCategories).toContain(bp.category);
    }
  });

  it("agriculture blueprint has integration capability", () => {
    const ag = BUILT_IN_BLUEPRINTS.find((b) => b.id === "agriculture");
    expect(ag?.capabilities.integration).toBe(true);
  });
});

// ─── BlueprintInstaller ───────────────────────────────────────────────────────

describe("BlueprintInstaller", () => {
  it("validates a blueprint that exists with no required fields", () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo());
    const result = installer.validate("mobility", {});
    expect(result.valid).toBe(true);
  });

  it("fails validation for unknown blueprint", () => {
    const registry = new BlueprintRegistry();
    const installer = new BlueprintInstaller(registry, makeInstanceRepo());
    const result = installer.validate("nonexistent", {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not registered"))).toBe(true);
  });

  it("fails validation when required field is missing", () => {
    const registry = new BlueprintRegistry([customManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo());
    const result = installer.validate("custom-test", {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fleetSize"))).toBe(true);
  });

  it("passes validation when required field is present", () => {
    const registry = new BlueprintRegistry([customManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo());
    const result = installer.validate("custom-test", { fleetSize: 10 });
    expect(result.valid).toBe(true);
  });

  it("installs a blueprint successfully", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const instanceRepo = makeInstanceRepo(null);
    // First call (check existing) returns null, second call (save) returns instance
    const installer = new BlueprintInstaller(registry, instanceRepo);
    const instance = await installer.install("t1", "mobility", {}, "actor1");
    expect(instance.blueprintId).toBe("mobility");
    expect(instance.tenantId).toBe("t1");
    expect(instance.status).toBe("active");
  });

  it("throws VALIDATION_FAILED when config invalid", async () => {
    const registry = new BlueprintRegistry([customManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(null));
    await expect(installer.install("t1", "custom-test", {}, "actor1")).rejects.toThrow(
      BlueprintInstallerError,
    );
    try {
      await installer.install("t1", "custom-test", {}, "actor1");
    } catch (e) {
      expect((e as BlueprintInstallerError).code).toBe("VALIDATION_FAILED");
    }
  });

  it("throws ALREADY_INSTALLED when blueprint is already installed", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const existingInstance = makeInstance();
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(existingInstance));
    await expect(installer.install("t1", "mobility", {}, "actor1")).rejects.toThrow(
      BlueprintInstallerError,
    );
    try {
      await installer.install("t1", "mobility", {}, "actor1");
    } catch (e) {
      expect((e as BlueprintInstallerError).code).toBe("ALREADY_INSTALLED");
    }
  });

  it("uninstalls a blueprint", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const existingInstance = makeInstance();
    const instanceRepo = makeInstanceRepo(existingInstance);
    const installer = new BlueprintInstaller(registry, instanceRepo);
    await installer.uninstall("t1", "mobility");
    expect(instanceRepo.delete).toHaveBeenCalledWith("inst-1");
  });

  it("throws NOT_INSTALLED on uninstall when not found", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(null));
    await expect(installer.uninstall("t1", "mobility")).rejects.toThrow(BlueprintInstallerError);
    try {
      await installer.uninstall("t1", "mobility");
    } catch (e) {
      expect((e as BlueprintInstallerError).code).toBe("NOT_INSTALLED");
    }
  });

  it("upgrades a blueprint version", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const existingInstance = makeInstance();
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(existingInstance));
    const upgraded = await installer.upgrade("t1", "mobility", "2.0.0", "actor1");
    expect(upgraded.blueprintVersion).toBe("2.0.0");
  });

  it("throws NOT_INSTALLED on upgrade when not found", async () => {
    const registry = new BlueprintRegistry([mobilityManifest]);
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(null));
    await expect(installer.upgrade("t1", "mobility", "2.0.0", "actor1")).rejects.toThrow(
      BlueprintInstallerError,
    );
    try {
      await installer.upgrade("t1", "mobility", "2.0.0", "actor1");
    } catch (e) {
      expect((e as BlueprintInstallerError).code).toBe("NOT_INSTALLED");
    }
  });

  it("throws BLUEPRINT_NOT_FOUND on upgrade when blueprint unregistered", async () => {
    const registry = new BlueprintRegistry();
    const existingInstance = makeInstance();
    const installer = new BlueprintInstaller(registry, makeInstanceRepo(existingInstance));
    await expect(installer.upgrade("t1", "mobility", "2.0.0", "actor1")).rejects.toThrow(
      BlueprintInstallerError,
    );
    try {
      await installer.upgrade("t1", "mobility", "2.0.0", "actor1");
    } catch (e) {
      expect((e as BlueprintInstallerError).code).toBe("BLUEPRINT_NOT_FOUND");
    }
  });
});

// ─── BlueprintConfigurator ────────────────────────────────────────────────────

describe("BlueprintConfigurator", () => {
  it("gets config when installed", async () => {
    const instance = makeInstance({ config: { fleetSize: 20 } });
    const configurator = new BlueprintConfigurator(makeInstanceRepo(instance));
    const config = await configurator.getConfig("t1", "mobility");
    expect(config["fleetSize"]).toBe(20);
  });

  it("throws NOT_INSTALLED on getConfig when not found", async () => {
    const configurator = new BlueprintConfigurator(makeInstanceRepo(null));
    await expect(configurator.getConfig("t1", "mobility")).rejects.toThrow(
      BlueprintConfiguratorError,
    );
    try {
      await configurator.getConfig("t1", "mobility");
    } catch (e) {
      expect((e as BlueprintConfiguratorError).code).toBe("NOT_INSTALLED");
    }
  });

  it("updates config merging with existing", async () => {
    const instance = makeInstance({ config: { fleetSize: 10, region: "BR" } });
    const configurator = new BlueprintConfigurator(makeInstanceRepo(instance));
    const updated = await configurator.updateConfig("t1", "mobility", { fleetSize: 25 }, "actor1");
    expect(updated.config["fleetSize"]).toBe(25);
    expect(updated.config["region"]).toBe("BR");
  });

  it("throws NOT_INSTALLED on updateConfig when not found", async () => {
    const configurator = new BlueprintConfigurator(makeInstanceRepo(null));
    await expect(configurator.updateConfig("t1", "mobility", { x: 1 }, "actor1")).rejects.toThrow(
      BlueprintConfiguratorError,
    );
  });

  it("resets config to empty", async () => {
    const instance = makeInstance({ config: { fleetSize: 10 } });
    const configurator = new BlueprintConfigurator(makeInstanceRepo(instance));
    const reset = await configurator.resetConfig("t1", "mobility", "actor1");
    expect(reset.config).toEqual({});
  });

  it("throws NOT_INSTALLED on resetConfig when not found", async () => {
    const configurator = new BlueprintConfigurator(makeInstanceRepo(null));
    await expect(configurator.resetConfig("t1", "mobility", "actor1")).rejects.toThrow(
      BlueprintConfiguratorError,
    );
  });
});

// ─── BlueprintVersioning ──────────────────────────────────────────────────────

describe("BlueprintVersioning", () => {
  it("creates a version record", async () => {
    const versionRepo = makeVersionRepo();
    const versioning = new BlueprintVersioning(versionRepo, makeInstanceRepo());
    const version = await versioning.createVersion(mobilityManifest, "First release", "actor1");
    expect(version.isLatest).toBe(true);
    expect(version.blueprintId).toBe("mobility");
    expect(versionRepo.markAllNotLatest).toHaveBeenCalledWith("mobility");
  });

  it("returns version history", async () => {
    const existing: BlueprintVersion = {
      id: "v1",
      blueprintId: "mobility",
      version: "1.0.0",
      manifest: mobilityManifest,
      changelog: "Initial",
      releasedAt: new Date().toISOString(),
      isLatest: true,
      releasedBy: "actor1",
    };
    const versioning = new BlueprintVersioning(
      makeVersionRepo(existing, [existing]),
      makeInstanceRepo(),
    );
    const history = await versioning.getVersionHistory("mobility");
    expect(history).toHaveLength(1);
  });

  it("returns null when no latest version", async () => {
    const versioning = new BlueprintVersioning(makeVersionRepo(null), makeInstanceRepo());
    const latest = await versioning.getLatest("mobility");
    expect(latest).toBeNull();
  });

  it("returns latest version", async () => {
    const existing: BlueprintVersion = {
      id: "v1",
      blueprintId: "mobility",
      version: "1.0.0",
      manifest: mobilityManifest,
      changelog: "Release",
      releasedAt: new Date().toISOString(),
      isLatest: true,
      releasedBy: "actor1",
    };
    const versioning = new BlueprintVersioning(makeVersionRepo(existing), makeInstanceRepo());
    const latest = await versioning.getLatest("mobility");
    expect(latest?.version).toBe("1.0.0");
  });

  it("rollbacks to a target version", async () => {
    const bpVersion: BlueprintVersion = {
      id: "v1",
      blueprintId: "mobility",
      version: "1.0.0",
      manifest: mobilityManifest,
      changelog: "Initial",
      releasedAt: new Date().toISOString(),
      isLatest: false,
      releasedBy: "actor1",
    };
    const instance = makeInstance();
    const versioning = new BlueprintVersioning(
      makeVersionRepo(bpVersion),
      makeInstanceRepo(instance),
    );
    const rolledBack = await versioning.rollback("t1", "mobility", "1.0.0", "actor1");
    expect(rolledBack.blueprintVersion).toBe("1.0.0");
  });

  it("throws VERSION_NOT_FOUND when target version missing", async () => {
    const versioning = new BlueprintVersioning(makeVersionRepo(null), makeInstanceRepo());
    await expect(versioning.rollback("t1", "mobility", "0.9.0", "actor1")).rejects.toThrow(
      BlueprintVersioningError,
    );
    try {
      await versioning.rollback("t1", "mobility", "0.9.0", "actor1");
    } catch (e) {
      expect((e as BlueprintVersioningError).code).toBe("VERSION_NOT_FOUND");
    }
  });

  it("throws NOT_INSTALLED when instance not found during rollback", async () => {
    const bpVersion: BlueprintVersion = {
      id: "v1",
      blueprintId: "mobility",
      version: "1.0.0",
      manifest: mobilityManifest,
      changelog: "Initial",
      releasedAt: new Date().toISOString(),
      isLatest: false,
      releasedBy: "actor1",
    };
    const versioning = new BlueprintVersioning(makeVersionRepo(bpVersion), makeInstanceRepo(null));
    await expect(versioning.rollback("t1", "mobility", "1.0.0", "actor1")).rejects.toThrow(
      BlueprintVersioningError,
    );
    try {
      await versioning.rollback("t1", "mobility", "1.0.0", "actor1");
    } catch (e) {
      expect((e as BlueprintVersioningError).code).toBe("NOT_INSTALLED");
    }
  });
});

// ─── BlueprintRuntime ─────────────────────────────────────────────────────────

describe("BlueprintRuntime", () => {
  function makeRuntime(instance: BlueprintInstance | null = null) {
    return new BlueprintRuntime({
      manifestRepo: makeManifestRepo(),
      instanceRepo: makeInstanceRepo(instance),
      versionRepo: makeVersionRepo(),
      seedBuiltIns: true,
    });
  }

  it("seeds built-in blueprints", () => {
    const runtime = makeRuntime();
    expect(runtime.listBlueprints().length).toBe(BUILT_IN_BLUEPRINTS.length);
  });

  it("does not seed when seedBuiltIns is false", () => {
    const runtime = new BlueprintRuntime({
      manifestRepo: makeManifestRepo(),
      instanceRepo: makeInstanceRepo(),
      versionRepo: makeVersionRepo(),
      seedBuiltIns: false,
    });
    expect(runtime.listBlueprints()).toHaveLength(0);
  });

  it("registers a new blueprint", () => {
    const runtime = makeRuntime();
    runtime.registerBlueprint(customManifest);
    expect(runtime.registry.has("custom-test")).toBe(true);
  });

  it("gets a blueprint by id", () => {
    const runtime = makeRuntime();
    const bp = runtime.getBlueprint("mobility");
    expect(bp.displayName).toBe("Mobility");
  });

  it("validates install config", () => {
    // "generic-assets" has no required customFields, unlike "mobility" (see built-ins.ts) —
    // this test is about the seeded-registry validate() path, not blueprint-specific content.
    const runtime = makeRuntime();
    const result = runtime.validate("generic-assets", {});
    expect(result.valid).toBe(true);
  });

  it("installs a blueprint", async () => {
    const runtime = makeRuntime(null);
    const instance = await runtime.install("t1", "generic-assets", {}, "actor1");
    expect(instance.blueprintId).toBe("generic-assets");
  });

  it("gets version history", async () => {
    const runtime = makeRuntime();
    const history = await runtime.getVersionHistory("mobility");
    expect(Array.isArray(history)).toBe(true);
  });
});
