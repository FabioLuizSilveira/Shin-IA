import type { BlueprintManifest } from "./types.js";

const BASE_CAPABILITIES = {
  tracking: true,
  maintenance: true,
  commercial: true,
  notifications: true,
  reporting: true,
  workflow: true,
  integration: false,
};

function makeManifest(
  id: string,
  displayName: string,
  category: BlueprintManifest["category"],
  description: string,
  extra: Partial<typeof BASE_CAPABILITIES> = {},
): BlueprintManifest {
  return {
    id,
    name: id,
    displayName,
    version: "1.0.0",
    category,
    description,
    author: "Shinã Platform",
    capabilities: { ...BASE_CAPABILITIES, ...extra },
    customFields: [],
    dependencies: [],
    minPlatformVersion: "2.0.0",
    status: "active",
  };
}

export const BUILT_IN_BLUEPRINTS: BlueprintManifest[] = [
  makeManifest("mobility", "Mobility", "mobility", "General mobility and fleet management"),
  makeManifest(
    "rental-cars",
    "Rental Cars",
    "mobility",
    "Car rental operations with driver management",
  ),
  makeManifest(
    "rental-motorcycles",
    "Rental Motorcycles",
    "mobility",
    "Motorcycle rental with tracking and maintenance",
  ),
  makeManifest(
    "forklift",
    "Forklift",
    "industrial",
    "Forklift fleet management with safety compliance",
  ),
  makeManifest("munk", "Munk", "industrial", "Munk equipment operations and scheduling"),
  makeManifest(
    "crane",
    "Crane (Grua)",
    "construction",
    "Mobile crane operations and load tracking",
  ),
  makeManifest(
    "tower-crane",
    "Tower Crane (Guindaste)",
    "construction",
    "Tower crane operations with load limits",
  ),
  makeManifest(
    "agriculture",
    "Agriculture",
    "agriculture",
    "Agricultural equipment fleet and harvest tracking",
    { integration: true },
  ),
  makeManifest(
    "construction",
    "Construction Equipment",
    "construction",
    "Heavy construction machinery management",
  ),
  makeManifest(
    "generic-assets",
    "Generic Assets",
    "generic",
    "Flexible blueprint for any asset type",
  ),
];
