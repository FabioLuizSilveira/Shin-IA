import { costPerUnit } from "./cost.js";

// Asset Economics / TCO foundation (Etapa 16, P2). "Foundation" is the
// operative word in the spec here -- a real TCO needs acquisition cost,
// depreciation, and revenue attribution, none of which this platform
// tracks per-asset yet (rental revenue isn't attributed to a specific
// asset anywhere in the schema today). Rather than invent or approximate
// those, this only ever reports what can be honestly computed:
// maintenance-cost-based metrics always, and acquisition-cost-based ones
// (total cost of ownership, maintenance as % of acquisition) only when
// the tenant has actually entered an acquisition cost -- same "never
// invent a baseline" discipline as resolvePlanDue().

export interface AssetEconomicsResult {
  totalMaintenanceCostCents: number;
  maintenanceCostPerDayCents: number | null;
  maintenanceCostPerOdometerUnit: number | null;
  maintenanceCostPerHourMeterUnit: number | null;
  // Everything below is null whenever acquisitionCostCents wasn't provided
  // -- never approximated from maintenance cost alone.
  totalCostOfOwnershipCents: number | null;
  maintenanceCostAsFractionOfAcquisition: number | null;
}

export function computeAssetEconomics(input: {
  totalMaintenanceCostCents: number;
  acquisitionCostCents: number | null;
  ownershipDays: number | null;
  odometer: number | null;
  hourMeter: number | null;
}): AssetEconomicsResult {
  // Requires at least a full day of ownership -- a fresh asset (a few
  // seconds/minutes old) dividing by a near-zero ownershipDays would
  // otherwise produce an astronomically large, meaningless number
  // instead of no answer. Same "never present false precision"
  // discipline as costPerUnit() and resolvePlanDue().
  const maintenanceCostPerDayCents =
    input.ownershipDays !== null && input.ownershipDays >= 1
      ? input.totalMaintenanceCostCents / input.ownershipDays
      : null;

  const maintenanceCostPerOdometerUnit = costPerUnit(
    input.totalMaintenanceCostCents,
    input.odometer,
  );
  const maintenanceCostPerHourMeterUnit = costPerUnit(
    input.totalMaintenanceCostCents,
    input.hourMeter,
  );

  const hasAcquisitionCost = input.acquisitionCostCents !== null && input.acquisitionCostCents > 0;
  const totalCostOfOwnershipCents = hasAcquisitionCost
    ? input.acquisitionCostCents! + input.totalMaintenanceCostCents
    : null;
  const maintenanceCostAsFractionOfAcquisition = hasAcquisitionCost
    ? input.totalMaintenanceCostCents / input.acquisitionCostCents!
    : null;

  return {
    totalMaintenanceCostCents: input.totalMaintenanceCostCents,
    maintenanceCostPerDayCents,
    maintenanceCostPerOdometerUnit,
    maintenanceCostPerHourMeterUnit,
    totalCostOfOwnershipCents,
    maintenanceCostAsFractionOfAcquisition,
  };
}
