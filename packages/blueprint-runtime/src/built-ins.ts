import type { BlueprintFieldSchema, BlueprintManifest } from "./types.js";

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
  customFields: BlueprintFieldSchema[],
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
    customFields,
    dependencies: [],
    minPlatformVersion: "2.0.0",
    status: "active",
  };
}

// Field schemas below were empty in every built-in blueprint (confirmed via
// packages audit) — install() only stored them opaquely, nothing ever
// populated asset_types from them. These are real, grounded in the fleet/
// rental domain this platform actually serves (see
// apps/web/src/lib/blueprint-installer.ts for where they get applied).

export const BUILT_IN_BLUEPRINTS: BlueprintManifest[] = [
  makeManifest("mobility", "Mobilidade", "mobility", "Gestão geral de mobilidade e frota", [
    { key: "plate", label: "Placa", type: "text", required: true },
    { key: "brand", label: "Marca", type: "text", required: false },
    { key: "model", label: "Modelo", type: "text", required: false },
    { key: "year", label: "Ano", type: "number", required: false },
  ]),
  makeManifest(
    "rental-cars",
    "Aluguel de Carros",
    "mobility",
    "Operações de locação de veículos com gestão de motoristas",
    [
      { key: "plate", label: "Placa", type: "text", required: true },
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "model", label: "Modelo", type: "text", required: true },
      { key: "year", label: "Ano", type: "number", required: false },
      {
        key: "transmission",
        label: "Câmbio",
        type: "select",
        required: false,
        options: ["manual", "automatic"],
      },
      { key: "seats", label: "Lugares", type: "number", required: false, defaultValue: 5 },
      {
        key: "requires_cnh_category_b",
        label: "Exige CNH categoria B",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  ),
  makeManifest(
    "rental-motorcycles",
    "Aluguel de Motos",
    "mobility",
    "Locação de motos com rastreamento e manutenção",
    [
      { key: "plate", label: "Placa", type: "text", required: true },
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "model", label: "Modelo", type: "text", required: true },
      { key: "engine_cc", label: "Cilindrada (cc)", type: "number", required: false },
      {
        key: "requires_cnh_category_a",
        label: "Exige CNH categoria A",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  ),
  makeManifest(
    "forklift",
    "Empilhadeira",
    "industrial",
    "Gestão de frota de empilhadeiras com conformidade de segurança",
    [
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "model", label: "Modelo", type: "text", required: false },
      { key: "capacity_kg", label: "Capacidade (kg)", type: "number", required: true },
      {
        key: "energy_source",
        label: "Fonte de energia",
        type: "select",
        required: false,
        options: ["combustion", "electric", "gas"],
      },
      { key: "mast_height_m", label: "Altura do mastro (m)", type: "number", required: false },
      { key: "last_inspection_date", label: "Última inspeção", type: "date", required: false },
    ],
  ),
  makeManifest("munk", "Munk", "industrial", "Operações e agendamento de equipamento Munk", [
    { key: "brand", label: "Marca", type: "text", required: true },
    { key: "max_load_kg", label: "Carga máxima (kg)", type: "number", required: true },
    { key: "max_reach_m", label: "Alcance máximo (m)", type: "number", required: false },
    { key: "chassis_plate", label: "Placa do chassi", type: "text", required: false },
  ]),
  makeManifest(
    "crane",
    "Grua Móvel",
    "construction",
    "Operação de grua móvel e rastreamento de carga",
    [
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "max_load_ton", label: "Carga máxima (ton)", type: "number", required: true },
      { key: "boom_length_m", label: "Comprimento da lança (m)", type: "number", required: false },
      {
        key: "requires_certified_operator",
        label: "Exige operador certificado",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  ),
  makeManifest(
    "tower-crane",
    "Guindaste de Torre",
    "construction",
    "Operação de guindaste de torre com limites de carga",
    [
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "max_load_ton", label: "Carga máxima (ton)", type: "number", required: true },
      { key: "jib_length_m", label: "Comprimento da lança (m)", type: "number", required: false },
      { key: "hook_height_m", label: "Altura do gancho (m)", type: "number", required: false },
      { key: "last_inspection_date", label: "Última inspeção", type: "date", required: false },
    ],
  ),
  makeManifest(
    "agriculture",
    "Agricultura",
    "agriculture",
    "Frota de equipamentos agrícolas e rastreamento de colheita",
    [
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "model", label: "Modelo", type: "text", required: false },
      { key: "power_hp", label: "Potência (hp)", type: "number", required: false },
      {
        key: "implement_type",
        label: "Tipo de implemento",
        type: "select",
        required: false,
        options: ["tractor", "harvester", "planter", "sprayer", "other"],
      },
      { key: "hour_meter", label: "Horímetro", type: "number", required: false },
    ],
    { integration: true },
  ),
  makeManifest(
    "construction",
    "Equipamentos de Construção",
    "construction",
    "Gestão de maquinário pesado de construção",
    [
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "model", label: "Modelo", type: "text", required: false },
      {
        key: "equipment_type",
        label: "Tipo de equipamento",
        type: "select",
        required: false,
        options: ["excavator", "bulldozer", "loader", "compactor", "other"],
      },
      { key: "hour_meter", label: "Horímetro", type: "number", required: false },
      { key: "last_maintenance_date", label: "Última manutenção", type: "date", required: false },
    ],
  ),
  makeManifest(
    "generic-assets",
    "Ativos Genéricos",
    "generic",
    "Template flexível para qualquer tipo de ativo",
    [
      { key: "serial_number", label: "Número de série", type: "text", required: false },
      { key: "brand", label: "Marca", type: "text", required: false },
      { key: "notes", label: "Observações", type: "text", required: false },
    ],
  ),
];
