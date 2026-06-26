import type { CanonicalMessage, TrackingProviderName } from "./types.js";

/**
 * All provider adapters normalise raw payloads into the canonical message
 * format understood by TrackingRuntime. No concrete HTTP/SDK calls live here
 * — adapters are pure transformation functions.
 */
export interface TrackingAdapter {
  readonly providerName: TrackingProviderName;
  normalise(rawPayload: Record<string, unknown>, receivedAt: string): CanonicalMessage;
}

// ─── Sascar ──────────────────────────────────────────────────────────────────

export class SascarAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "sascar";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["deviceId"] ?? raw["id"] ?? ""),
      providerName: this.providerName,
      position: this.extractPosition(raw, receivedAt),
      telemetry: this.extractTelemetry(raw),
      rawPayload: raw,
      receivedAt,
    };
  }

  private extractPosition(raw: Record<string, unknown>, receivedAt: string) {
    if (!raw["lat"] && !raw["latitude"]) return undefined;
    return {
      latitude: Number(raw["lat"] ?? raw["latitude"]),
      longitude: Number(raw["lng"] ?? raw["longitude"]),
      speed: raw["speed"] !== undefined ? Number(raw["speed"]) : undefined,
      heading: raw["heading"] !== undefined ? Number(raw["heading"]) : undefined,
      fixedAt: String(raw["gpsTime"] ?? raw["fixedAt"] ?? receivedAt),
    };
  }

  private extractTelemetry(raw: Record<string, unknown>) {
    const readings = [];
    const now = new Date().toISOString();
    if (raw["ignition"] !== undefined)
      readings.push({ key: "ignition" as const, value: Boolean(raw["ignition"]), measuredAt: now });
    if (raw["odometer"] !== undefined)
      readings.push({
        key: "odometer" as const,
        value: Number(raw["odometer"]),
        unit: "km",
        measuredAt: now,
      });
    return readings.length > 0 ? readings : undefined;
  }
}

// ─── Omnilink ────────────────────────────────────────────────────────────────

export class OmnilinkAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "omnilink";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    const data = (raw["data"] as Record<string, unknown>) ?? raw;
    return {
      externalDeviceId: String(raw["vehicleId"] ?? raw["deviceId"] ?? ""),
      providerName: this.providerName,
      position: data["lat"]
        ? {
            latitude: Number(data["lat"]),
            longitude: Number(data["lng"]),
            speed: data["vel"] !== undefined ? Number(data["vel"]) : undefined,
            fixedAt: String(data["dt"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Teltonika ───────────────────────────────────────────────────────────────

export class TeltonikaAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "teltonika";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    const records = Array.isArray(raw["records"])
      ? (raw["records"] as Record<string, unknown>[])
      : [raw];
    const latest = records[records.length - 1] ?? {};

    return {
      externalDeviceId: String(raw["imei"] ?? ""),
      providerName: this.providerName,
      position: latest["lat"]
        ? {
            latitude: Number(latest["lat"]),
            longitude: Number(latest["lon"]),
            altitude: latest["alt"] !== undefined ? Number(latest["alt"]) : undefined,
            speed: latest["speed"] !== undefined ? Number(latest["speed"]) : undefined,
            heading: latest["angle"] !== undefined ? Number(latest["angle"]) : undefined,
            fixedAt: String(latest["timestamp"] ?? receivedAt),
          }
        : undefined,
      telemetry: this.extractTelemetry(latest, receivedAt),
      rawPayload: raw,
      receivedAt,
    };
  }

  private extractTelemetry(record: Record<string, unknown>, receivedAt: string) {
    const readings = [];
    const io = (record["io"] as Record<string, unknown>) ?? {};
    if (io["1"] !== undefined)
      readings.push({
        key: "ignition" as const,
        value: Boolean(Number(io["1"])),
        measuredAt: receivedAt,
      });
    if (io["fuel"] !== undefined)
      readings.push({
        key: "fuel_level" as const,
        value: Number(io["fuel"]),
        unit: "%",
        measuredAt: receivedAt,
      });
    if (io["battery"] !== undefined)
      readings.push({
        key: "battery_voltage" as const,
        value: Number(io["battery"]),
        unit: "V",
        measuredAt: receivedAt,
      });
    return readings.length > 0 ? readings : undefined;
  }
}

// ─── Concox ──────────────────────────────────────────────────────────────────

export class ConcoxAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "concox";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["imei"] ?? raw["device_id"] ?? ""),
      providerName: this.providerName,
      position: raw["gps"]
        ? {
            latitude: Number((raw["gps"] as Record<string, unknown>)["lat"]),
            longitude: Number((raw["gps"] as Record<string, unknown>)["lng"]),
            speed: Number((raw["gps"] as Record<string, unknown>)["speed"] ?? 0),
            fixedAt: String(raw["datetime"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Queclink ────────────────────────────────────────────────────────────────

export class QueclinkAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "queclink";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["imei"] ?? ""),
      providerName: this.providerName,
      position: raw["latitude"]
        ? {
            latitude: Number(raw["latitude"]),
            longitude: Number(raw["longitude"]),
            speed: raw["speed"] !== undefined ? Number(raw["speed"]) : undefined,
            heading: raw["course"] !== undefined ? Number(raw["course"]) : undefined,
            fixedAt: String(raw["sendTime"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Autotrac ────────────────────────────────────────────────────────────────

export class AutotracAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "autotrac";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["movel"] ?? raw["deviceId"] ?? ""),
      providerName: this.providerName,
      position: raw["posicao"]
        ? {
            latitude: Number((raw["posicao"] as Record<string, unknown>)["lat"]),
            longitude: Number((raw["posicao"] as Record<string, unknown>)["lon"]),
            speed: Number((raw["posicao"] as Record<string, unknown>)["vel"] ?? 0),
            fixedAt: String(raw["dataHora"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Positron ────────────────────────────────────────────────────────────────

export class PositronAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "positron";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["serial"] ?? raw["device"] ?? ""),
      providerName: this.providerName,
      position: raw["lat"]
        ? {
            latitude: Number(raw["lat"]),
            longitude: Number(raw["lng"]),
            speed: raw["speed"] !== undefined ? Number(raw["speed"]) : undefined,
            fixedAt: String(raw["time"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Custom (passthrough) ─────────────────────────────────────────────────────

export class CustomAdapter implements TrackingAdapter {
  readonly providerName: TrackingProviderName = "custom";

  normalise(raw: Record<string, unknown>, receivedAt: string): CanonicalMessage {
    return {
      externalDeviceId: String(raw["deviceId"] ?? raw["id"] ?? ""),
      providerName: this.providerName,
      position: raw["latitude"]
        ? {
            latitude: Number(raw["latitude"]),
            longitude: Number(raw["longitude"]),
            altitude: raw["altitude"] !== undefined ? Number(raw["altitude"]) : undefined,
            speed: raw["speed"] !== undefined ? Number(raw["speed"]) : undefined,
            heading: raw["heading"] !== undefined ? Number(raw["heading"]) : undefined,
            fixedAt: String(raw["fixedAt"] ?? receivedAt),
          }
        : undefined,
      rawPayload: raw,
      receivedAt,
    };
  }
}

// ─── Adapter Registry ─────────────────────────────────────────────────────────

export class AdapterRegistry {
  private adapters = new Map<TrackingProviderName, TrackingAdapter>([
    ["sascar", new SascarAdapter()],
    ["omnilink", new OmnilinkAdapter()],
    ["autotrac", new AutotracAdapter()],
    ["positron", new PositronAdapter()],
    ["teltonika", new TeltonikaAdapter()],
    ["concox", new ConcoxAdapter()],
    ["queclink", new QueclinkAdapter()],
    ["custom", new CustomAdapter()],
  ]);

  register(adapter: TrackingAdapter): void {
    this.adapters.set(adapter.providerName, adapter);
  }

  get(name: TrackingProviderName): TrackingAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`no adapter registered for provider: ${name}`);
    return adapter;
  }

  has(name: TrackingProviderName): boolean {
    return this.adapters.has(name);
  }

  list(): TrackingProviderName[] {
    return [...this.adapters.keys()];
  }
}
