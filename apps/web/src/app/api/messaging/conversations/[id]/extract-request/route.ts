import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getEntitlements } from "@shina/commercial-platform";
import { extractOperationRequest } from "@/lib/ai/operation-request-extraction";
import {
  matchVehiclesForCapacity,
  matchAvailableVehiclesByFleetType,
  matchVehiclesByCapacityField,
  type AssetForMatching,
} from "@/lib/transport/resource-matching";
import { newCorrelationId } from "@/lib/audit-event";

export const dynamic = "force-dynamic";

// WAVE 5 — Multi-Operation Business Architecture v2: structured, read-only
// extraction of a passenger-transport/towing request from a WhatsApp
// conversation (spec sections 24-25). Same gating as .../suggest (Shinã
// Agent + WhatsApp both enabled + messaging_whatsapp entitlement) plus the
// messaging_whatsapp requirement doubles as the signal that this tenant
// actually has WhatsApp wired up at all.
//
// "Resource actions" (spec section 25, partial): when the extraction is
// confident about passengerCount, this also surfaces compatible vehicles
// (Wave 3's matchVehiclesForCapacity, reused as-is); for a towing_request
// it surfaces available tow trucks (matchAvailableVehiclesByFleetType,
// towing's own dispatch runtime) — READ-ONLY, no allocation, no Trip/
// Service Request created. A human still creates it explicitly.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.conversation.reply"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isFeatureEnabled(scope, "agent.enabled"))) {
    return NextResponse.json(
      { error: "Shinã ainda não está habilitada para este tenant." },
      { status: 403 },
    );
  }
  if (!(await isFeatureEnabled(scope, "messaging.whatsapp.enabled"))) {
    return NextResponse.json({ error: "Mensageria WhatsApp não habilitada." }, { status: 403 });
  }
  const entitlements = await getEntitlements(scope.db, {
    tenantId: scope.tenantId,
    product: "platform",
  });
  if (!entitlements.features.includes("messaging_whatsapp")) {
    return NextResponse.json(
      { error: "Plano atual não inclui mensageria WhatsApp" },
      { status: 403 },
    );
  }

  try {
    const result = await extractOperationRequest(scope.db, {
      tenantId: scope.tenantId,
      conversationId: id,
      correlationId: newCorrelationId(),
    });
    if (!result.extracted) {
      return NextResponse.json(
        { error: result.reason ?? "não foi possível extrair a solicitação" },
        {
          status: 422,
        },
      );
    }

    let compatibleVehicles: Array<{ id: string; name: string; seatCapacity: number | null }> = [];
    const passengerCount = result.transportFields?.passengerCount;
    if (
      result.intent === "passenger_transport_request" &&
      typeof passengerCount === "number" &&
      passengerCount > 0
    ) {
      const { data: assets } = await scope.db
        .from("assets")
        .select("id, name, status, metadata")
        .eq("tenant_id", scope.tenantId)
        .eq("category", "vehicle");
      const matched = matchVehiclesForCapacity(
        (assets ?? []) as AssetForMatching[],
        passengerCount,
      );
      compatibleVehicles = matched.map((a) => ({
        id: a.id,
        name: (a as unknown as { name: string }).name,
        seatCapacity: a.metadata.seatCapacity ?? null,
      }));
    }

    let compatibleTowTrucks: Array<{ id: string; name: string }> = [];
    if (result.intent === "towing_request") {
      const { data: assets } = await scope.db
        .from("assets")
        .select("id, name, status, metadata")
        .eq("tenant_id", scope.tenantId)
        .eq("category", "vehicle");
      const matched = matchAvailableVehiclesByFleetType(
        (assets ?? []) as AssetForMatching[],
        "tow_truck",
      );
      compatibleTowTrucks = matched.map((a) => ({
        id: a.id,
        name: (a as unknown as { name: string }).name,
      }));
    }

    let compatibleWaterTankTrucks: Array<{
      id: string;
      name: string;
      capacityLiters: number | null;
    }> = [];
    const litersRequested = result.waterTankFields?.litersRequested;
    if (
      result.intent === "water_tank_request" &&
      typeof litersRequested === "number" &&
      litersRequested > 0
    ) {
      const { data: assets } = await scope.db
        .from("assets")
        .select("id, name, status, metadata")
        .eq("tenant_id", scope.tenantId)
        .eq("category", "vehicle");
      const matched = matchVehiclesByCapacityField(
        (assets ?? []) as AssetForMatching[],
        "capacityLiters",
        litersRequested,
      );
      compatibleWaterTankTrucks = matched.map((a) => ({
        id: a.id,
        name: (a as unknown as { name: string }).name,
        capacityLiters: a.metadata.capacityLiters ?? null,
      }));
    }

    return NextResponse.json({
      data: { ...result, compatibleVehicles, compatibleTowTrucks, compatibleWaterTankTrucks },
    });
  } catch (err) {
    return internalError(err);
  }
}
