# Event Catalog — Shinã Platform

> Last updated: 2026-06-22 (Gate 2 — Integration Engine events added)

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
  id: string; // UUID — unique event identifier
  type: string; // e.g. "commission.plan_created"
  version: number; // Schema version (starts at 1)
  occurredAt: string; // ISO 8601 UTC
  tenantId: string | null; // null for platform-level events
  actorId: string | null; // User or system that triggered the event
  correlationId: string | null; // Request correlation ID for tracing
  causationId: string | null; // ID of the event that caused this one
  payload: T;
};
```

---

## Commission Events (`commission.*`)

| Event                               | Trigger                                           | Key Payload Fields                                 |
| ----------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `commission.plan_created`           | New CommissionPlan saved as draft                 | `planId`, `planName`, `type`                       |
| `commission.plan_activated`         | Plan status changed to active                     | `planId`, `validFrom`                              |
| `commission.plan_archived`          | Plan status changed to archived                   | `planId`, `archivedBy`                             |
| `commission.rule_added`             | CommissionRule added to plan                      | `planId`, `ruleId`, `rate`, `basis`                |
| `commission.rule_updated`           | CommissionRule modified                           | `planId`, `ruleId`, `changes`                      |
| `commission.rule_removed`           | CommissionRule removed from plan                  | `planId`, `ruleId`                                 |
| `commission.campaign_created`       | New CommissionCampaign created                    | `campaignId`, `planId`, `startDate`, `endDate`     |
| `commission.campaign_started`       | Campaign becomes active (startDate reached)       | `campaignId`                                       |
| `commission.campaign_ended`         | Campaign period ended                             | `campaignId`, `totalTransactions`                  |
| `commission.transaction_calculated` | Commission amount computed for a qualifying event | `transactionId`, `agentId`, `commissionAmount`     |
| `commission.transaction_approved`   | Transaction approved for settlement               | `transactionId`, `approvedBy`                      |
| `commission.transaction_rejected`   | Transaction rejected                              | `transactionId`, `rejectedBy`, `reason`            |
| `commission.settlement_created`     | Settlement batch created                          | `settlementId`, `agentId`, `period`, `totalAmount` |
| `commission.settlement_submitted`   | Settlement submitted for approval                 | `settlementId`                                     |
| `commission.settlement_approved`    | Settlement approved                               | `settlementId`, `approvedBy`                       |
| `commission.settlement_paid`        | Settlement marked as paid                         | `settlementId`, `paidAt`                           |
| `commission.approval_requested`     | Approval workflow initiated                       | `approvalId`, `entityType`, `entityId`             |
| `commission.approval_approved`      | Approval step approved                            | `approvalId`, `approverId`, `step`                 |
| `commission.approval_rejected`      | Approval rejected                                 | `approvalId`, `rejectedBy`, `reason`               |
| `commission.approval_escalated`     | Approval escalated to next level                  | `approvalId`, `escalatedTo`                        |

---

## Tracking Events (`tracking.*`)

| Event                            | Trigger                                  | Key Payload Fields                                                    |
| -------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `tracking.device_provisioned`    | New TrackingDevice registered            | `deviceId`, `serialNumber`, `providerId`                              |
| `tracking.device_assigned`       | Device linked to an asset                | `deviceId`, `assetId`                                                 |
| `tracking.device_unassigned`     | Device unlinked from asset               | `deviceId`, `previousAssetId`                                         |
| `tracking.device_online`         | Device reconnected after offline period  | `deviceId`, `offlineDurationSeconds`                                  |
| `tracking.device_offline`        | Device stopped sending data              | `deviceId`, `lastSeen`                                                |
| `tracking.device_decommissioned` | Device permanently retired               | `deviceId`                                                            |
| `tracking.position_received`     | Raw position ingested from device        | `deviceId`, `assetId`, `coordinates`, `timestamp`                     |
| `tracking.event_detected`        | Pattern detected over telemetry stream   | `eventId`, `type`, `assetId`, `position`                              |
| `tracking.event_acknowledged`    | Event acknowledged by operator           | `eventId`, `acknowledgedBy`                                           |
| `tracking.geofence_created`      | New Geofence defined                     | `geofenceId`, `name`, `type`                                          |
| `tracking.geofence_updated`      | Geofence geometry or config changed      | `geofenceId`, `changes`                                               |
| `tracking.geofence_deleted`      | Geofence removed                         | `geofenceId`                                                          |
| `tracking.geofence_entered`      | Asset entered a geofence boundary        | `geofenceId`, `assetId`, `enteredAt`, `position`                      |
| `tracking.geofence_exited`       | Asset exited a geofence boundary         | `geofenceId`, `assetId`, `exitedAt`, `dwellTimeSeconds`               |
| `tracking.speeding_detected`     | Asset exceeded speed threshold           | `assetId`, `speed`, `threshold`, `position`                           |
| `tracking.idle_started`          | Asset engine idle for threshold duration | `assetId`, `idleSince`, `position`                                    |
| `tracking.idle_ended`            | Asset stopped idling                     | `assetId`, `idleDurationSeconds`                                      |
| `tracking.trip_started`          | Ignition on after rest period            | `assetId`, `deviceId`, `startPosition`                                |
| `tracking.trip_ended`            | Ignition off after movement              | `assetId`, `deviceId`, `endPosition`, `distanceKm`, `durationSeconds` |

---

## Permission Events (`permission.*`)

| Event                   | Trigger                        | Key Payload Fields                           |
| ----------------------- | ------------------------------ | -------------------------------------------- |
| `permission.created`    | New Permission defined         | `permissionId`, `name`, `resource`, `action` |
| `permission.updated`    | Permission definition changed  | `permissionId`, `changes`                    |
| `permission.deprecated` | Permission marked deprecated   | `permissionId`, `replacedBy`                 |
| `permission.granted`    | Permission added to a role     | `permissionId`, `roleId`                     |
| `permission.revoked`    | Permission removed from a role | `permissionId`, `roleId`                     |

---

## Role Events (`role.*`)

| Event                     | Trigger                           | Key Payload Fields               |
| ------------------------- | --------------------------------- | -------------------------------- |
| `role.created`            | New Role created                  | `roleId`, `name`, `tenantId`     |
| `role.updated`            | Role name or metadata changed     | `roleId`, `changes`              |
| `role.deleted`            | Role removed                      | `roleId`                         |
| `role.permission_added`   | Permission added to role          | `roleId`, `permissionId`         |
| `role.permission_removed` | Permission removed from role      | `roleId`, `permissionId`         |
| `role.assigned`           | Role assigned to a user           | `roleId`, `userId`, `assignedBy` |
| `role.revoked`            | Role removed from user            | `roleId`, `userId`, `revokedBy`  |
| `role.cloned`             | Role duplicated as starting point | `sourceRoleId`, `newRoleId`      |

---

## Delegation Events (`delegation.*`)

| Event                           | Trigger                                   | Key Payload Fields                                    |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `delegation.created`            | Access delegation grant created           | `delegationId`, `grantorId`, `granteeId`, `expiresAt` |
| `delegation.accepted`           | Grantee accepted the delegation           | `delegationId`, `acceptedAt`                          |
| `delegation.revoked`            | Delegation revoked before expiry          | `delegationId`, `revokedBy`                           |
| `delegation.expired`            | Delegation expiry date passed             | `delegationId`                                        |
| `delegation.permission_added`   | Additional permission added to delegation | `delegationId`, `permissionId`                        |
| `delegation.permission_removed` | Permission removed from delegation        | `delegationId`, `permissionId`                        |

---

## Impersonation Events (`impersonation.*`)

| Event                            | Trigger                                       | Key Payload Fields                                                    |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `impersonation.started`          | Platform operator began impersonation session | `impersonationId`, `operatorId`, `targetUserId`, `tenantId`, `reason` |
| `impersonation.ended`            | Impersonation session terminated              | `impersonationId`, `durationSeconds`, `actionsPerformed`              |
| `impersonation.action_performed` | Any action taken during impersonation         | `impersonationId`, `action`, `resource`, `timestamp`                  |

> **Security note:** `impersonation.*` events are always written to the immutable platform audit log, regardless of tenant audit settings.

---

## Event Retention Policy

| Domain                       | Retention                  | Storage                               |
| ---------------------------- | -------------------------- | ------------------------------------- |
| `tracking.position_received` | 90 days hot / 2 years cold | Time-series (Timescale or Hypertable) |
| `tracking.*` (non-position)  | 1 year                     | Standard table                        |
| `commission.*`               | 7 years                    | Standard table (regulatory)           |
| `permission.*`, `role.*`     | Indefinite                 | Audit log                             |
| `delegation.*`               | Indefinite                 | Audit log                             |
| `impersonation.*`            | Indefinite                 | Platform audit log (immutable)        |

---

## Integration Events (`integration.*`)

### Provider Events

| Event                              | Trigger                         | Key Payload Fields                           |
| ---------------------------------- | ------------------------------- | -------------------------------------------- |
| `integration.provider_registered`  | New IntegrationProvider created | `providerId`, `name`, `category`, `authType` |
| `integration.provider_updated`     | Provider configuration changed  | `providerId`, `changes`                      |
| `integration.provider_activated`   | Status changed to active        | `providerId`                                 |
| `integration.provider_deactivated` | Status changed to inactive      | `providerId`, `reason`                       |

### REST Endpoint Events

| Event                            | Trigger                 | Key Payload Fields                                              |
| -------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `integration.endpoint_called`    | HTTP request dispatched | `endpointId`, `providerId`, `method`, `attempt`                 |
| `integration.endpoint_succeeded` | 2xx response received   | `endpointId`, `statusCode`, `durationMs`                        |
| `integration.endpoint_failed`    | Non-2xx or timeout      | `endpointId`, `statusCode`, `errorCode`, `attempt`, `willRetry` |

### Webhook Events

| Event                                   | Trigger                        | Key Payload Fields                                   |
| --------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `integration.webhook_delivered`         | Outbound POST returned 2xx     | `webhookId`, `targetUrl`, `statusCode`, `durationMs` |
| `integration.webhook_failed`            | Outbound POST failed           | `webhookId`, `statusCode`, `attempt`, `willRetry`    |
| `integration.webhook_received`          | Valid inbound webhook accepted | `webhookId`, `eventType`, `payloadSizeBytes`         |
| `integration.webhook_signature_invalid` | HMAC signature mismatch        | `webhookId`, `sourceIp`                              |
| `integration.webhook_suspended`         | Failure threshold reached      | `webhookId`, `failureCount`                          |

### API Key Events

| Event                              | Trigger                      | Key Payload Fields                          |
| ---------------------------------- | ---------------------------- | ------------------------------------------- |
| `integration.api_key_issued`       | New ApiKey created           | `keyId`, `direction`, `keyPrefix`, `scopes` |
| `integration.api_key_used`         | Key authenticated a request  | `keyId`, `keyPrefix`, `endpoint`            |
| `integration.api_key_revoked`      | Key manually revoked         | `keyId`, `revokedBy`                        |
| `integration.api_key_expired`      | Key passed `expiresAt`       | `keyId`, `keyPrefix`                        |
| `integration.api_key_rotation_due` | `rotationDueAt` date reached | `keyId`, `keyPrefix`                        |

### OAuth Client Events

| Event                                    | Trigger                               | Key Payload Fields                    |
| ---------------------------------------- | ------------------------------------- | ------------------------------------- |
| `integration.oauth_token_obtained`       | First access token acquired           | `clientId`, `providerId`, `scopes`    |
| `integration.oauth_token_refreshed`      | Token refreshed before expiry         | `clientId`, `providerId`              |
| `integration.oauth_token_expired`        | Token expired without refresh         | `clientId`, `providerId`              |
| `integration.oauth_authorization_failed` | Authorization server rejected request | `clientId`, `providerId`, `errorCode` |

### External IAM Events

| Event                                | Trigger                              | Key Payload Fields                  |
| ------------------------------------ | ------------------------------------ | ----------------------------------- |
| `integration.iam_configured`         | ExternalIam saved                    | `iamId`, `protocol`, `issuer`       |
| `integration.iam_login_succeeded`    | SSO login successful                 | `iamId`, `userId`, `protocol`       |
| `integration.iam_login_failed`       | SSO login failed                     | `iamId`, `protocol`, `errorCode`    |
| `integration.iam_user_provisioned`   | JIT user created from IdP attributes | `iamId`, `userId`, `email`          |
| `integration.iam_user_deprovisioned` | User removed via SCIM or sync        | `iamId`, `userId`                   |
| `integration.iam_sync_completed`     | Attribute sync cycle finished        | `iamId`, `usersProcessed`, `errors` |

### Sync Job Events

| Event                            | Trigger                                 | Key Payload Fields                                    |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `integration.sync_job_started`   | SyncJobRun begins                       | `jobId`, `runId`, `trigger`                           |
| `integration.sync_job_completed` | Run ends with no errors                 | `jobId`, `runId`, `processedRecords`, `durationMs`    |
| `integration.sync_job_partial`   | Run completed with some record failures | `jobId`, `runId`, `failedRecords`, `processedRecords` |
| `integration.sync_job_failed`    | Run failed entirely                     | `jobId`, `runId`, `errorCode`                         |
| `integration.sync_job_paused`    | Job paused by user or system            | `jobId`, `reason`                                     |

---

## Event Consumers

| Consumer            | Events Subscribed                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification Engine | `tracking.geofence_entered`, `tracking.geofence_exited`, `tracking.speeding_detected`, `commission.transaction_approved`, `integration.sync_job_failed`, `integration.webhook_suspended`, `integration.api_key_rotation_due` |
| Reporting Engine    | All `commission.*`, all `tracking.*` aggregated events, `integration.sync_job_completed`, `integration.sync_job_partial`                                                                                                     |
| Workflow Engine     | `commission.approval_requested`, `commission.settlement_submitted`                                                                                                                                                           |
| AI Engine           | `tracking.position_received`, `tracking.event_detected`                                                                                                                                                                      |
| Audit Service       | `impersonation.*`, `permission.*`, `role.*`, `delegation.*`, `integration.api_key_revoked`, `integration.iam_login_failed`, `integration.webhook_signature_invalid`                                                          |
| Integration Engine  | `tracking.position_received` (for outbound webhook routing)                                                                                                                                                                  |
