# Event Catalog — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

All domain events emitted by the platform engines. Events are the primary mechanism for cross-engine communication and audit trail.

---

## Conventions

### Event Name Format

```
<domain>.<entity>.<past_tense_verb>
```

Examples: `commission.plan_created`, `tracking.geofence_entered`, `permission.role_assigned`

### Event Envelope

Every event is wrapped in a standard envelope:

```typescript
type DomainEvent<T> = {
  id: string;                    // UUID — unique event identifier
  type: string;                  // e.g. "commission.plan_created"
  version: number;               // Schema version (starts at 1)
  occurredAt: string;            // ISO 8601 UTC
  tenantId: string | null;       // null for platform-level events
  actorId: string | null;        // User or system that triggered the event
  correlationId: string | null;  // Request correlation ID for tracing
  causationId: string | null;    // ID of the event that caused this one
  payload: T;
};
```

---

## Commission Events (`commission.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `commission.plan_created` | New CommissionPlan saved as draft | `planId`, `planName`, `type` |
| `commission.plan_activated` | Plan status changed to active | `planId`, `validFrom` |
| `commission.plan_archived` | Plan status changed to archived | `planId`, `archivedBy` |
| `commission.rule_added` | CommissionRule added to plan | `planId`, `ruleId`, `rate`, `basis` |
| `commission.rule_updated` | CommissionRule modified | `planId`, `ruleId`, `changes` |
| `commission.rule_removed` | CommissionRule removed from plan | `planId`, `ruleId` |
| `commission.campaign_created` | New CommissionCampaign created | `campaignId`, `planId`, `startDate`, `endDate` |
| `commission.campaign_started` | Campaign becomes active (startDate reached) | `campaignId` |
| `commission.campaign_ended` | Campaign period ended | `campaignId`, `totalTransactions` |
| `commission.transaction_calculated` | Commission amount computed for a qualifying event | `transactionId`, `agentId`, `commissionAmount` |
| `commission.transaction_approved` | Transaction approved for settlement | `transactionId`, `approvedBy` |
| `commission.transaction_rejected` | Transaction rejected | `transactionId`, `rejectedBy`, `reason` |
| `commission.settlement_created` | Settlement batch created | `settlementId`, `agentId`, `period`, `totalAmount` |
| `commission.settlement_submitted` | Settlement submitted for approval | `settlementId` |
| `commission.settlement_approved` | Settlement approved | `settlementId`, `approvedBy` |
| `commission.settlement_paid` | Settlement marked as paid | `settlementId`, `paidAt` |
| `commission.approval_requested` | Approval workflow initiated | `approvalId`, `entityType`, `entityId` |
| `commission.approval_approved` | Approval step approved | `approvalId`, `approverId`, `step` |
| `commission.approval_rejected` | Approval rejected | `approvalId`, `rejectedBy`, `reason` |
| `commission.approval_escalated` | Approval escalated to next level | `approvalId`, `escalatedTo` |

---

## Tracking Events (`tracking.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `tracking.device_provisioned` | New TrackingDevice registered | `deviceId`, `serialNumber`, `providerId` |
| `tracking.device_assigned` | Device linked to an asset | `deviceId`, `assetId` |
| `tracking.device_unassigned` | Device unlinked from asset | `deviceId`, `previousAssetId` |
| `tracking.device_online` | Device reconnected after offline period | `deviceId`, `offlineDurationSeconds` |
| `tracking.device_offline` | Device stopped sending data | `deviceId`, `lastSeen` |
| `tracking.device_decommissioned` | Device permanently retired | `deviceId` |
| `tracking.position_received` | Raw position ingested from device | `deviceId`, `assetId`, `coordinates`, `timestamp` |
| `tracking.event_detected` | Pattern detected over telemetry stream | `eventId`, `type`, `assetId`, `position` |
| `tracking.event_acknowledged` | Event acknowledged by operator | `eventId`, `acknowledgedBy` |
| `tracking.geofence_created` | New Geofence defined | `geofenceId`, `name`, `type` |
| `tracking.geofence_updated` | Geofence geometry or config changed | `geofenceId`, `changes` |
| `tracking.geofence_deleted` | Geofence removed | `geofenceId` |
| `tracking.geofence_entered` | Asset entered a geofence boundary | `geofenceId`, `assetId`, `enteredAt`, `position` |
| `tracking.geofence_exited` | Asset exited a geofence boundary | `geofenceId`, `assetId`, `exitedAt`, `dwellTimeSeconds` |
| `tracking.speeding_detected` | Asset exceeded speed threshold | `assetId`, `speed`, `threshold`, `position` |
| `tracking.idle_started` | Asset engine idle for threshold duration | `assetId`, `idleSince`, `position` |
| `tracking.idle_ended` | Asset stopped idling | `assetId`, `idleDurationSeconds` |
| `tracking.trip_started` | Ignition on after rest period | `assetId`, `deviceId`, `startPosition` |
| `tracking.trip_ended` | Ignition off after movement | `assetId`, `deviceId`, `endPosition`, `distanceKm`, `durationSeconds` |

---

## Permission Events (`permission.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `permission.created` | New Permission defined | `permissionId`, `name`, `resource`, `action` |
| `permission.updated` | Permission definition changed | `permissionId`, `changes` |
| `permission.deprecated` | Permission marked deprecated | `permissionId`, `replacedBy` |
| `permission.granted` | Permission added to a role | `permissionId`, `roleId` |
| `permission.revoked` | Permission removed from a role | `permissionId`, `roleId` |

---

## Role Events (`role.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `role.created` | New Role created | `roleId`, `name`, `tenantId` |
| `role.updated` | Role name or metadata changed | `roleId`, `changes` |
| `role.deleted` | Role removed | `roleId` |
| `role.permission_added` | Permission added to role | `roleId`, `permissionId` |
| `role.permission_removed` | Permission removed from role | `roleId`, `permissionId` |
| `role.assigned` | Role assigned to a user | `roleId`, `userId`, `assignedBy` |
| `role.revoked` | Role removed from user | `roleId`, `userId`, `revokedBy` |
| `role.cloned` | Role duplicated as starting point | `sourceRoleId`, `newRoleId` |

---

## Delegation Events (`delegation.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `delegation.created` | Access delegation grant created | `delegationId`, `grantorId`, `granteeId`, `expiresAt` |
| `delegation.accepted` | Grantee accepted the delegation | `delegationId`, `acceptedAt` |
| `delegation.revoked` | Delegation revoked before expiry | `delegationId`, `revokedBy` |
| `delegation.expired` | Delegation expiry date passed | `delegationId` |
| `delegation.permission_added` | Additional permission added to delegation | `delegationId`, `permissionId` |
| `delegation.permission_removed` | Permission removed from delegation | `delegationId`, `permissionId` |

---

## Impersonation Events (`impersonation.*`)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `impersonation.started` | Platform operator began impersonation session | `impersonationId`, `operatorId`, `targetUserId`, `tenantId`, `reason` |
| `impersonation.ended` | Impersonation session terminated | `impersonationId`, `durationSeconds`, `actionsPerformed` |
| `impersonation.action_performed` | Any action taken during impersonation | `impersonationId`, `action`, `resource`, `timestamp` |

> **Security note:** `impersonation.*` events are always written to the immutable platform audit log, regardless of tenant audit settings.

---

## Event Retention Policy

| Domain | Retention | Storage |
|--------|-----------|---------|
| `tracking.position_received` | 90 days hot / 2 years cold | Time-series (Timescale or Hypertable) |
| `tracking.*` (non-position) | 1 year | Standard table |
| `commission.*` | 7 years | Standard table (regulatory) |
| `permission.*`, `role.*` | Indefinite | Audit log |
| `delegation.*` | Indefinite | Audit log |
| `impersonation.*` | Indefinite | Platform audit log (immutable) |

---

## Event Consumers

| Consumer | Events Subscribed |
|----------|------------------|
| Notification Engine | `tracking.geofence_entered`, `tracking.geofence_exited`, `tracking.speeding_detected`, `commission.transaction_approved` |
| Reporting Engine | All `commission.*`, all `tracking.*` aggregated events |
| Workflow Engine | `commission.approval_requested`, `commission.settlement_submitted` |
| AI Engine | `tracking.position_received`, `tracking.event_detected` |
| Audit Service | `impersonation.*`, `permission.*`, `role.*`, `delegation.*` |
