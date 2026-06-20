# Domain Model — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

This document describes the **DDD Aggregates** and their bounded contexts. Each aggregate defines its own consistency boundary, owns its identity, and communicates with other aggregates via domain events.

---

## Bounded Contexts

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    Identity &   │   │ Fleet & Resource │   │   Operations    │
│  Access (IAM)   │   │   Management    │   │   Management    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    Tracking &   │   │    Billing &    │   │   Commercial    │
│   Telematics    │   │    Finance      │   │   (Commission)  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
┌─────────────────┐   ┌─────────────────┐
│   Workflow &    │   │  Config & Rules  │
│   Automation    │   │                 │
└─────────────────┘   └─────────────────┘
```

---

## Identity & Access Context

### Aggregate: `User`
Represents an authenticated principal within a tenant. Owns credentials, roles, and profile.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | Owning tenant |
| `email` | string | Unique per tenant |
| `roles` | Role[] | Assigned roles |
| `branchScope` | BranchScope | Organizational access boundary |
| `status` | enum | active / suspended / invited |

**Events emitted:** `user.created`, `user.activated`, `user.suspended`, `user.role_assigned`, `user.role_revoked`

---

### Aggregate: `Role`
A named collection of permissions assignable to users.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | null = platform role |
| `name` | string | |
| `permissions` | Permission[] | |
| `isSystem` | boolean | System roles cannot be deleted |

**Events emitted:** `role.created`, `role.updated`, `role.deleted`, `role.permission_added`

---

### Aggregate: `Delegation`
Models a time-bounded access delegation from one user to another.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `grantor` | UserId | |
| `grantee` | UserId | |
| `permissions` | Permission[] | Subset of grantor's permissions |
| `expiresAt` | datetime | |
| `status` | enum | active / expired / revoked |

**Events emitted:** `delegation.created`, `delegation.expired`, `delegation.revoked`

---

### Aggregate: `Impersonation`
Records a platform operator temporarily acting as a tenant user for support purposes.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `operatorId` | UserId | Platform operator |
| `targetUserId` | UserId | Impersonated user |
| `tenantId` | UUID | |
| `reason` | string | Required |
| `startedAt` | datetime | |
| `endedAt` | datetime | null if active |
| `auditLog` | AuditEntry[] | All actions taken during session |

**Events emitted:** `impersonation.started`, `impersonation.ended`

---

## Fleet & Resource Context

### Aggregate: `Capability`
Represents a named feature capability that can be attached to a tenant, asset, or user scope. Used for capability-based access control and feature gating.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `name` | string | e.g. "tracking.geofence", "commission.campaigns" |
| `description` | string | |
| `scope` | enum | tenant / asset / user |
| `enabled` | boolean | |
| `tenantId` | UUID | null = global |
| `expiresAt` | datetime | null = indefinite |

**Events emitted:** `capability.enabled`, `capability.disabled`, `capability.expired`

---

## Tracking & Telematics Context

### Aggregate: `TrackingDevice`
A physical hardware device installed in an asset that emits location and telemetry data.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `serialNumber` | string | Unique hardware identifier |
| `tenantId` | UUID | |
| `assetId` | UUID | Assigned resource |
| `providerId` | UUID | Tracking provider |
| `model` | string | Hardware model |
| `status` | enum | active / inactive / offline / maintenance |
| `lastSeen` | datetime | |
| `firmwareVersion` | string | |
| `simIccid` | string | SIM card identifier |

**Events emitted:** `tracking_device.provisioned`, `tracking_device.assigned`, `tracking_device.offline`, `tracking_device.online`

---

### Aggregate: `TrackingProvider`
An external GPS/telematics provider integration (e.g., Teltonika, Calamp, Queclink).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `name` | string | |
| `protocol` | enum | mqtt / http / ftp |
| `credentials` | encrypted | |
| `status` | enum | active / inactive |
| `capabilities` | string[] | e.g. ["gps", "accelerometer", "can_bus"] |

---

### Value Object: `TrackingPosition`
An immutable point-in-time position record emitted by a device. High-volume — stored in a time-series optimized table.

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | UUID | |
| `assetId` | UUID | |
| `tenantId` | UUID | |
| `latitude` | decimal | |
| `longitude` | decimal | |
| `altitude` | decimal | meters |
| `speed` | decimal | km/h |
| `heading` | integer | degrees |
| `accuracy` | decimal | meters |
| `timestamp` | datetime | Device timestamp |
| `receivedAt` | datetime | Server ingestion timestamp |
| `ignition` | boolean | |
| `odometer` | decimal | km |

---

### Aggregate: `TrackingEvent`
A detected event derived from telemetry stream processing (not a raw position).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `type` | enum | speeding / idle / geofence_enter / geofence_exit / harsh_brake / harsh_acceleration / ignition_on / ignition_off |
| `deviceId` | UUID | |
| `assetId` | UUID | |
| `tenantId` | UUID | |
| `occurredAt` | datetime | |
| `position` | TrackingPosition | Position at event time |
| `metadata` | JSON | Event-specific data |
| `acknowledged` | boolean | |

**Events emitted:** `tracking.event_detected`, `tracking.event_acknowledged`

---

### Aggregate: `Geofence`
A defined geographic boundary used to detect asset entry/exit events.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | |
| `name` | string | |
| `type` | enum | circle / polygon |
| `geometry` | GeoJSON | |
| `color` | string | UI display |
| `alertOnEnter` | boolean | |
| `alertOnExit` | boolean | |
| `assignedAssets` | AssetId[] | Empty = all assets |
| `active` | boolean | |

**Events emitted:** `geofence.created`, `geofence.asset_entered`, `geofence.asset_exited`

---

### Value Object: `GeofenceEvent`
Records a specific asset crossing a geofence boundary. Linked to a `TrackingEvent` of type `geofence_enter` or `geofence_exit`.

| Field | Type | Notes |
|-------|------|-------|
| `geofenceId` | UUID | |
| `assetId` | UUID | |
| `eventType` | enum | enter / exit |
| `occurredAt` | datetime | |
| `position` | TrackingPosition | |
| `dwellTimeSeconds` | integer | For exit events: time inside |

---

### Value Object: `TelemetryReading`
A generic sensor reading from a device, beyond GPS position (e.g., temperature, fuel level, CAN bus signals).

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | UUID | |
| `assetId` | UUID | |
| `metric` | string | e.g. "fuel_level", "temperature", "engine_rpm" |
| `value` | decimal | |
| `unit` | string | e.g. "percent", "celsius", "rpm" |
| `timestamp` | datetime | |

---

## Commercial (Commission) Context

### Aggregate: `CommissionPlan`
Defines the overall commission structure for a sales team, agent, or product line.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | |
| `name` | string | |
| `type` | enum | percentage / fixed / tiered / hybrid |
| `rules` | CommissionRule[] | |
| `validFrom` | date | |
| `validUntil` | date | null = indefinite |
| `status` | enum | draft / active / archived |

**Events emitted:** `commission.plan_created`, `commission.plan_activated`, `commission.plan_archived`

---

### Aggregate: `CommissionRule`
A single rule within a `CommissionPlan` defining how commission is calculated for a condition.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `planId` | UUID | |
| `condition` | RuleExpression | DSL condition |
| `rate` | decimal | Percentage or fixed amount |
| `basis` | enum | gross_value / net_value / quantity |
| `capAmount` | decimal | null = no cap |
| `priority` | integer | Rule evaluation order |

---

### Aggregate: `CommissionCampaign`
A time-limited incentive campaign that modifies or overrides standard commission rules.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | |
| `name` | string | |
| `planId` | UUID | Associated plan |
| `overrideRules` | CommissionRule[] | |
| `bonus` | decimal | Flat bonus on top |
| `startDate` | date | |
| `endDate` | date | |
| `eligibleAgents` | AgentId[] | Empty = all agents |
| `status` | enum | draft / active / ended |

**Events emitted:** `commission.campaign_started`, `commission.campaign_ended`

---

### Aggregate: `CommissionTransaction`
Records a single commission calculation event triggered by a qualifying business transaction (e.g., a sale, a renewal).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | |
| `agentId` | UUID | Earning agent |
| `planId` | UUID | Applied plan |
| `ruleId` | UUID | Applied rule |
| `campaignId` | UUID | null if no active campaign |
| `referenceId` | UUID | Source transaction (order, invoice) |
| `referenceType` | string | |
| `grossAmount` | decimal | Transaction gross value |
| `commissionAmount` | decimal | Calculated commission |
| `currency` | string | ISO 4217 |
| `status` | enum | pending / approved / rejected / settled |
| `calculatedAt` | datetime | |

**Events emitted:** `commission.transaction_calculated`, `commission.transaction_approved`, `commission.transaction_rejected`

---

### Aggregate: `CommissionSettlement`
A batch settlement grouping multiple `CommissionTransaction` records for payout.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `tenantId` | UUID | |
| `agentId` | UUID | |
| `period` | DateRange | Settlement period |
| `transactions` | TransactionId[] | |
| `totalAmount` | decimal | |
| `currency` | string | |
| `status` | enum | draft / submitted / approved / paid |
| `paidAt` | datetime | |

**Events emitted:** `commission.settlement_created`, `commission.settlement_approved`, `commission.settlement_paid`

---

### Aggregate: `CommissionApproval`
Tracks the approval workflow for a commission transaction or settlement that requires human review.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Aggregate root |
| `entityType` | enum | transaction / settlement |
| `entityId` | UUID | |
| `requestedBy` | UserId | |
| `approvers` | ApprovalStep[] | |
| `currentStep` | integer | |
| `status` | enum | pending / approved / rejected / escalated |
| `comments` | Comment[] | |

**Events emitted:** `commission.approval_requested`, `commission.approval_approved`, `commission.approval_rejected`, `commission.approval_escalated`
