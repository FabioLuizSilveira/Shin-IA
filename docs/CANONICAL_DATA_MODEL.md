# Canonical Data Model — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

The Canonical Data Model (CDM) defines the authoritative data shapes used across API contracts, event payloads, and inter-engine communication. These structures are the source of truth for type generation and API documentation.

Canonical types are **read-optimized projections** — not necessarily 1:1 with aggregate persistence models. They represent what consumers receive, not how data is stored.

---

## Conventions

- All identifiers are UUID v4.
- All timestamps are ISO 8601 in UTC: `2026-06-20T14:00:00Z`.
- Monetary amounts are represented as `{ amount: number, currency: string }` (ISO 4217).
- Geographic coordinates: `{ lat: number, lng: number }` (WGS84 decimal degrees).
- Nullable fields are indicated with `?`.

---

## Identity & Access

### `Capability`

```typescript
type Capability = {
  id: string;
  name: string;                   // e.g. "tracking.geofence"
  description: string;
  scope: "tenant" | "asset" | "user";
  enabled: boolean;
  tenantId: string | null;        // null = global platform capability
  expiresAt: string | null;       // ISO 8601, null = indefinite
  createdAt: string;
  updatedAt: string;
};
```

---

## Tracking & Telematics

### `TrackingDevice`

```typescript
type TrackingDevice = {
  id: string;
  serialNumber: string;
  tenantId: string;
  assetId: string | null;
  providerId: string;
  providerName: string;
  model: string;
  status: "active" | "inactive" | "offline" | "maintenance";
  lastSeen: string | null;        // ISO 8601
  firmwareVersion: string | null;
  simIccid: string | null;
  capabilities: string[];         // e.g. ["gps", "accelerometer"]
  createdAt: string;
  updatedAt: string;
};
```

---

### `TrackingPosition`

```typescript
type TrackingPosition = {
  deviceId: string;
  assetId: string;
  tenantId: string;
  coordinates: {
    lat: number;
    lng: number;
    altitude: number | null;      // meters
  };
  speed: number;                  // km/h
  heading: number;                // 0–359 degrees
  accuracy: number | null;        // meters
  ignition: boolean | null;
  odometer: number | null;        // km
  timestamp: string;              // Device timestamp (ISO 8601)
  receivedAt: string;             // Server ingestion timestamp
};
```

---

### `TrackingEvent`

```typescript
type TrackingEventType =
  | "speeding"
  | "idle"
  | "geofence_enter"
  | "geofence_exit"
  | "harsh_brake"
  | "harsh_acceleration"
  | "ignition_on"
  | "ignition_off"
  | "panic"
  | "tow_detected"
  | "device_offline"
  | "device_online";

type TrackingEvent = {
  id: string;
  type: TrackingEventType;
  deviceId: string;
  assetId: string;
  tenantId: string;
  occurredAt: string;
  position: TrackingPosition | null;
  geofenceId: string | null;      // populated for geofence_enter / geofence_exit
  metadata: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
};
```

---

### `Geofence`

```typescript
type GeofenceGeometry =
  | { type: "circle"; center: { lat: number; lng: number }; radiusMeters: number }
  | { type: "polygon"; coordinates: Array<{ lat: number; lng: number }> };

type Geofence = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  geometry: GeofenceGeometry;
  color: string;                  // hex color for UI display
  alertOnEnter: boolean;
  alertOnExit: boolean;
  assignedAssets: string[];       // empty = applies to all assets
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

---

## Commercial (Commission)

### `CommissionPlan`

```typescript
type CommissionPlanType = "percentage" | "fixed" | "tiered" | "hybrid";

type CommissionPlan = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: CommissionPlanType;
  rules: CommissionRuleSummary[];
  validFrom: string;              // ISO 8601 date
  validUntil: string | null;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type CommissionRuleSummary = {
  id: string;
  condition: string;              // Human-readable summary of rule condition
  rate: number;
  basis: "gross_value" | "net_value" | "quantity";
  capAmount: number | null;
  priority: number;
};
```

---

### `CommissionTransaction`

```typescript
type CommissionTransaction = {
  id: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  planId: string;
  planName: string;
  ruleId: string;
  campaignId: string | null;
  campaignName: string | null;
  reference: {
    id: string;
    type: string;                 // e.g. "order", "invoice", "renewal"
    description: string | null;
  };
  grossAmount: Money;
  commissionAmount: Money;
  status: "pending" | "approved" | "rejected" | "settled";
  calculatedAt: string;
  settledAt: string | null;
};

type Money = {
  amount: number;
  currency: string;               // ISO 4217
};
```

---

### `CommissionSettlement`

```typescript
type CommissionSettlement = {
  id: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  period: {
    from: string;                 // ISO 8601 date
    to: string;
  };
  transactionCount: number;
  transactionIds: string[];
  totalAmount: Money;
  status: "draft" | "submitted" | "approved" | "paid";
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};
```

---

## Shared Value Objects

### `Money`

```typescript
type Money = {
  amount: number;   // Always non-negative; use context to determine debit/credit
  currency: string; // ISO 4217 (e.g. "BRL", "USD")
};
```

### `DateRange`

```typescript
type DateRange = {
  from: string;  // ISO 8601 date
  to: string;    // ISO 8601 date (inclusive)
};
```

### `Coordinates`

```typescript
type Coordinates = {
  lat: number;   // WGS84 decimal degrees
  lng: number;
};
```

### `AuditInfo`

```typescript
type AuditInfo = {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};
```

### `PagedResult<T>`

```typescript
type PagedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```
