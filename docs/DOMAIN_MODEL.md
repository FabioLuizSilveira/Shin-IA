# Domain Model — Shinã Platform

> Last updated: 2026-06-22 (Gate 2 — Integration bounded context added)

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
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Workflow &    │   │  Config & Rules  │   │  Integration &  │
│   Automation    │   │                 │   │  External Sys.  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Identity & Access Context

### Aggregate: `User`

Represents an authenticated principal within a tenant. Owns credentials, roles, and profile.

| Field         | Type        | Notes                          |
| ------------- | ----------- | ------------------------------ |
| `id`          | UUID        | Aggregate root                 |
| `tenantId`    | UUID        | Owning tenant                  |
| `email`       | string      | Unique per tenant              |
| `roles`       | Role[]      | Assigned roles                 |
| `branchScope` | BranchScope | Organizational access boundary |
| `status`      | enum        | active / suspended / invited   |

**Events emitted:** `user.created`, `user.activated`, `user.suspended`, `user.role_assigned`, `user.role_revoked`

---

### Aggregate: `Role`

A named collection of permissions assignable to users.

| Field         | Type         | Notes                          |
| ------------- | ------------ | ------------------------------ |
| `id`          | UUID         | Aggregate root                 |
| `tenantId`    | UUID         | null = platform role           |
| `name`        | string       |                                |
| `permissions` | Permission[] |                                |
| `isSystem`    | boolean      | System roles cannot be deleted |

**Events emitted:** `role.created`, `role.updated`, `role.deleted`, `role.permission_added`

---

### Aggregate: `Delegation`

Models a time-bounded access delegation from one user to another.

| Field         | Type         | Notes                           |
| ------------- | ------------ | ------------------------------- |
| `id`          | UUID         | Aggregate root                  |
| `grantor`     | UserId       |                                 |
| `grantee`     | UserId       |                                 |
| `permissions` | Permission[] | Subset of grantor's permissions |
| `expiresAt`   | datetime     |                                 |
| `status`      | enum         | active / expired / revoked      |

**Events emitted:** `delegation.created`, `delegation.expired`, `delegation.revoked`

---

### Aggregate: `Impersonation`

Records a platform operator temporarily acting as a tenant user for support purposes.

| Field          | Type         | Notes                            |
| -------------- | ------------ | -------------------------------- |
| `id`           | UUID         | Aggregate root                   |
| `operatorId`   | UserId       | Platform operator                |
| `targetUserId` | UserId       | Impersonated user                |
| `tenantId`     | UUID         |                                  |
| `reason`       | string       | Required                         |
| `startedAt`    | datetime     |                                  |
| `endedAt`      | datetime     | null if active                   |
| `auditLog`     | AuditEntry[] | All actions taken during session |

**Events emitted:** `impersonation.started`, `impersonation.ended`

---

## Fleet & Resource Context

### Aggregate: `Capability`

Represents a named feature capability that can be attached to a tenant, asset, or user scope. Used for capability-based access control and feature gating.

| Field         | Type     | Notes                                            |
| ------------- | -------- | ------------------------------------------------ |
| `id`          | UUID     | Aggregate root                                   |
| `name`        | string   | e.g. "tracking.geofence", "commission.campaigns" |
| `description` | string   |                                                  |
| `scope`       | enum     | tenant / asset / user                            |
| `enabled`     | boolean  |                                                  |
| `tenantId`    | UUID     | null = global                                    |
| `expiresAt`   | datetime | null = indefinite                                |

**Events emitted:** `capability.enabled`, `capability.disabled`, `capability.expired`

---

## Tracking & Telematics Context

### Aggregate: `TrackingDevice`

A physical hardware device installed in an asset that emits location and telemetry data.

| Field             | Type     | Notes                                     |
| ----------------- | -------- | ----------------------------------------- |
| `id`              | UUID     | Aggregate root                            |
| `serialNumber`    | string   | Unique hardware identifier                |
| `tenantId`        | UUID     |                                           |
| `assetId`         | UUID     | Assigned resource                         |
| `providerId`      | UUID     | Tracking provider                         |
| `model`           | string   | Hardware model                            |
| `status`          | enum     | active / inactive / offline / maintenance |
| `lastSeen`        | datetime |                                           |
| `firmwareVersion` | string   |                                           |
| `simIccid`        | string   | SIM card identifier                       |

**Events emitted:** `tracking_device.provisioned`, `tracking_device.assigned`, `tracking_device.offline`, `tracking_device.online`

---

### Aggregate: `TrackingProvider`

An external GPS/telematics provider integration (e.g., Teltonika, Calamp, Queclink).

| Field          | Type      | Notes                                    |
| -------------- | --------- | ---------------------------------------- |
| `id`           | UUID      | Aggregate root                           |
| `name`         | string    |                                          |
| `protocol`     | enum      | mqtt / http / ftp                        |
| `credentials`  | encrypted |                                          |
| `status`       | enum      | active / inactive                        |
| `capabilities` | string[]  | e.g. ["gps", "accelerometer", "can_bus"] |

---

### Value Object: `TrackingPosition`

An immutable point-in-time position record emitted by a device. High-volume — stored in a time-series optimized table.

| Field        | Type     | Notes                      |
| ------------ | -------- | -------------------------- |
| `deviceId`   | UUID     |                            |
| `assetId`    | UUID     |                            |
| `tenantId`   | UUID     |                            |
| `latitude`   | decimal  |                            |
| `longitude`  | decimal  |                            |
| `altitude`   | decimal  | meters                     |
| `speed`      | decimal  | km/h                       |
| `heading`    | integer  | degrees                    |
| `accuracy`   | decimal  | meters                     |
| `timestamp`  | datetime | Device timestamp           |
| `receivedAt` | datetime | Server ingestion timestamp |
| `ignition`   | boolean  |                            |
| `odometer`   | decimal  | km                         |

---

### Aggregate: `TrackingEvent`

A detected event derived from telemetry stream processing (not a raw position).

| Field          | Type             | Notes                                                                                                            |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`           | UUID             | Aggregate root                                                                                                   |
| `type`         | enum             | speeding / idle / geofence_enter / geofence_exit / harsh_brake / harsh_acceleration / ignition_on / ignition_off |
| `deviceId`     | UUID             |                                                                                                                  |
| `assetId`      | UUID             |                                                                                                                  |
| `tenantId`     | UUID             |                                                                                                                  |
| `occurredAt`   | datetime         |                                                                                                                  |
| `position`     | TrackingPosition | Position at event time                                                                                           |
| `metadata`     | JSON             | Event-specific data                                                                                              |
| `acknowledged` | boolean          |                                                                                                                  |

**Events emitted:** `tracking.event_detected`, `tracking.event_acknowledged`

---

### Aggregate: `Geofence`

A defined geographic boundary used to detect asset entry/exit events.

| Field            | Type      | Notes              |
| ---------------- | --------- | ------------------ |
| `id`             | UUID      | Aggregate root     |
| `tenantId`       | UUID      |                    |
| `name`           | string    |                    |
| `type`           | enum      | circle / polygon   |
| `geometry`       | GeoJSON   |                    |
| `color`          | string    | UI display         |
| `alertOnEnter`   | boolean   |                    |
| `alertOnExit`    | boolean   |                    |
| `assignedAssets` | AssetId[] | Empty = all assets |
| `active`         | boolean   |                    |

**Events emitted:** `geofence.created`, `geofence.asset_entered`, `geofence.asset_exited`

---

### Value Object: `GeofenceEvent`

Records a specific asset crossing a geofence boundary. Linked to a `TrackingEvent` of type `geofence_enter` or `geofence_exit`.

| Field              | Type             | Notes                        |
| ------------------ | ---------------- | ---------------------------- |
| `geofenceId`       | UUID             |                              |
| `assetId`          | UUID             |                              |
| `eventType`        | enum             | enter / exit                 |
| `occurredAt`       | datetime         |                              |
| `position`         | TrackingPosition |                              |
| `dwellTimeSeconds` | integer          | For exit events: time inside |

---

### Value Object: `TelemetryReading`

A generic sensor reading from a device, beyond GPS position (e.g., temperature, fuel level, CAN bus signals).

| Field       | Type     | Notes                                          |
| ----------- | -------- | ---------------------------------------------- |
| `deviceId`  | UUID     |                                                |
| `assetId`   | UUID     |                                                |
| `metric`    | string   | e.g. "fuel_level", "temperature", "engine_rpm" |
| `value`     | decimal  |                                                |
| `unit`      | string   | e.g. "percent", "celsius", "rpm"               |
| `timestamp` | datetime |                                                |

---

## Commercial (Commission) Context

### Aggregate: `CommissionPlan`

Defines the overall commission structure for a sales team, agent, or product line.

| Field        | Type             | Notes                                |
| ------------ | ---------------- | ------------------------------------ |
| `id`         | UUID             | Aggregate root                       |
| `tenantId`   | UUID             |                                      |
| `name`       | string           |                                      |
| `type`       | enum             | percentage / fixed / tiered / hybrid |
| `rules`      | CommissionRule[] |                                      |
| `validFrom`  | date             |                                      |
| `validUntil` | date             | null = indefinite                    |
| `status`     | enum             | draft / active / archived            |

**Events emitted:** `commission.plan_created`, `commission.plan_activated`, `commission.plan_archived`

---

### Aggregate: `CommissionRule`

A single rule within a `CommissionPlan` defining how commission is calculated for a condition.

| Field       | Type           | Notes                              |
| ----------- | -------------- | ---------------------------------- |
| `id`        | UUID           | Aggregate root                     |
| `planId`    | UUID           |                                    |
| `condition` | RuleExpression | DSL condition                      |
| `rate`      | decimal        | Percentage or fixed amount         |
| `basis`     | enum           | gross_value / net_value / quantity |
| `capAmount` | decimal        | null = no cap                      |
| `priority`  | integer        | Rule evaluation order              |

---

### Aggregate: `CommissionCampaign`

A time-limited incentive campaign that modifies or overrides standard commission rules.

| Field            | Type             | Notes                  |
| ---------------- | ---------------- | ---------------------- |
| `id`             | UUID             | Aggregate root         |
| `tenantId`       | UUID             |                        |
| `name`           | string           |                        |
| `planId`         | UUID             | Associated plan        |
| `overrideRules`  | CommissionRule[] |                        |
| `bonus`          | decimal          | Flat bonus on top      |
| `startDate`      | date             |                        |
| `endDate`        | date             |                        |
| `eligibleAgents` | AgentId[]        | Empty = all agents     |
| `status`         | enum             | draft / active / ended |

**Events emitted:** `commission.campaign_started`, `commission.campaign_ended`

---

### Aggregate: `CommissionTransaction`

Records a single commission calculation event triggered by a qualifying business transaction (e.g., a sale, a renewal).

| Field              | Type     | Notes                                   |
| ------------------ | -------- | --------------------------------------- |
| `id`               | UUID     | Aggregate root                          |
| `tenantId`         | UUID     |                                         |
| `agentId`          | UUID     | Earning agent                           |
| `planId`           | UUID     | Applied plan                            |
| `ruleId`           | UUID     | Applied rule                            |
| `campaignId`       | UUID     | null if no active campaign              |
| `referenceId`      | UUID     | Source transaction (order, invoice)     |
| `referenceType`    | string   |                                         |
| `grossAmount`      | decimal  | Transaction gross value                 |
| `commissionAmount` | decimal  | Calculated commission                   |
| `currency`         | string   | ISO 4217                                |
| `status`           | enum     | pending / approved / rejected / settled |
| `calculatedAt`     | datetime |                                         |

**Events emitted:** `commission.transaction_calculated`, `commission.transaction_approved`, `commission.transaction_rejected`

---

### Aggregate: `CommissionSettlement`

A batch settlement grouping multiple `CommissionTransaction` records for payout.

| Field          | Type            | Notes                               |
| -------------- | --------------- | ----------------------------------- |
| `id`           | UUID            | Aggregate root                      |
| `tenantId`     | UUID            |                                     |
| `agentId`      | UUID            |                                     |
| `period`       | DateRange       | Settlement period                   |
| `transactions` | TransactionId[] |                                     |
| `totalAmount`  | decimal         |                                     |
| `currency`     | string          |                                     |
| `status`       | enum            | draft / submitted / approved / paid |
| `paidAt`       | datetime        |                                     |

**Events emitted:** `commission.settlement_created`, `commission.settlement_approved`, `commission.settlement_paid`

---

### Aggregate: `CommissionApproval`

Tracks the approval workflow for a commission transaction or settlement that requires human review.

| Field         | Type           | Notes                                     |
| ------------- | -------------- | ----------------------------------------- |
| `id`          | UUID           | Aggregate root                            |
| `entityType`  | enum           | transaction / settlement                  |
| `entityId`    | UUID           |                                           |
| `requestedBy` | UserId         |                                           |
| `approvers`   | ApprovalStep[] |                                           |
| `currentStep` | integer        |                                           |
| `status`      | enum           | pending / approved / rejected / escalated |
| `comments`    | Comment[]      |                                           |

**Events emitted:** `commission.approval_requested`, `commission.approval_approved`, `commission.approval_rejected`, `commission.approval_escalated`

---

## Integration & External Systems Context

Manages all connectivity between the Shinã platform and third-party systems. This bounded context owns credentials, protocol adapters, transformation rules, and the complete audit trail of external interactions.

For the full specification of each aggregate, runtime flows, and repository interfaces, see [`INTEGRATION_ENGINE.md`](INTEGRATION_ENGINE.md).

### Aggregate: `IntegrationProvider`

Named, versioned connector to an external system. Bundles auth config, base URL, capability declarations, and default field mappings.

| Field           | Type   | Notes                                                                          |
| --------------- | ------ | ------------------------------------------------------------------------------ |
| `id`            | UUID   | Aggregate root                                                                 |
| `tenantId`      | UUID   | null = platform-level provider                                                 |
| `name`          | string | Unique slug — e.g. `sap-erp`, `salesforce-crm`                                 |
| `category`      | enum   | erp / crm / telematics / finance / iam / custom                                |
| `authType`      | enum   | api_key / oauth2_client_credentials / oauth2_authorization_code / basic / none |
| `credentialId`  | UUID   | FK → ApiKey or OAuthClient                                                     |
| `status`        | enum   | active / inactive / degraded / maintenance                                     |
| `retryPolicyId` | UUID   | Default retry policy for this provider                                         |

**Events emitted:** `integration.provider_registered`, `integration.provider_updated`, `integration.provider_activated`, `integration.provider_deactivated`

---

### Aggregate: `RestEndpoint`

Single callable operation on an external REST API. References a field mapping for request/response transformation.

| Field            | Type    | Notes                                        |
| ---------------- | ------- | -------------------------------------------- |
| `id`             | UUID    | Aggregate root                               |
| `providerId`     | UUID    |                                              |
| `method`         | enum    | GET / POST / PUT / PATCH / DELETE            |
| `path`           | string  | Path template — e.g. `/vehicles/{vehicleId}` |
| `fieldMappingId` | UUID    | Bidirectional transformation                 |
| `retryPolicyId`  | UUID    | Endpoint-level override                      |
| `timeoutMs`      | integer | Default: 30 000                              |
| `status`         | enum    | active / deprecated / inactive               |

**Events emitted:** `integration.endpoint_called`, `integration.endpoint_succeeded`, `integration.endpoint_failed`

---

### Aggregate: `Webhook`

Outbound (Shinã → external) or inbound (external → Shinã) webhook. HMAC-SHA256 signature validation on both directions.

| Field           | Type               | Notes                                                    |
| --------------- | ------------------ | -------------------------------------------------------- |
| `id`            | UUID               | Aggregate root                                           |
| `direction`     | enum               | outbound / inbound                                       |
| `targetUrl`     | string             | External URL (outbound) or Shinã endpoint path (inbound) |
| `eventFilters`  | string[]           | Domain event types that trigger/match this webhook       |
| `signingSecret` | string (encrypted) | HMAC-SHA256 shared secret                                |
| `retryPolicyId` | UUID               |                                                          |
| `status`        | enum               | active / inactive / suspended                            |
| `failureCount`  | integer            | Resets on success                                        |

**Events emitted:** `integration.webhook_delivered`, `integration.webhook_failed`, `integration.webhook_received`, `integration.webhook_signature_invalid`, `integration.webhook_suspended`

---

### Aggregate: `ApiKey`

Manages API keys issued by Shinã (inbound) or stored for external API access (outbound). Key value is shown once and stored as a PBKDF2 hash.

| Field           | Type             | Notes                                |
| --------------- | ---------------- | ------------------------------------ |
| `id`            | UUID             | Aggregate root                       |
| `direction`     | enum             | inbound / outbound                   |
| `keyHash`       | string           | PBKDF2 hash — plaintext never stored |
| `keyPrefix`     | string           | First 8 chars — used in logs         |
| `scopes`        | string[]         |                                      |
| `expiresAt`     | datetime \| null |                                      |
| `status`        | enum             | active / revoked / expired           |
| `rotationDueAt` | datetime \| null |                                      |

**Events emitted:** `integration.api_key_issued`, `integration.api_key_used`, `integration.api_key_revoked`, `integration.api_key_expired`, `integration.api_key_rotation_due`

---

### Aggregate: `OAuthClient`

OAuth 2.0 credentials for external authorization. Handles token acquisition, automatic refresh, and encrypted storage of access/refresh tokens.

| Field              | Type                       | Notes                                   |
| ------------------ | -------------------------- | --------------------------------------- |
| `id`               | UUID                       | Aggregate root                          |
| `providerId`       | UUID                       |                                         |
| `grantType`        | enum                       | client_credentials / authorization_code |
| `clientId`         | string                     |                                         |
| `clientSecretHash` | string                     | AES-256 encrypted                       |
| `tokenUrl`         | string                     |                                         |
| `scopes`           | string[]                   |                                         |
| `accessToken`      | string (encrypted) \| null | AES-256 encrypted                       |
| `tokenExpiresAt`   | datetime \| null           |                                         |
| `status`           | enum                       | active / unauthorized / revoked         |

**Events emitted:** `integration.oauth_token_obtained`, `integration.oauth_token_refreshed`, `integration.oauth_token_expired`, `integration.oauth_authorization_failed`

---

### Aggregate: `ExternalIam`

External identity provider (IdP) configuration per tenant. Supports SAML 2.0, OIDC, and LDAP. Delegates authentication while Shinã retains authorization.

| Field              | Type             | Notes                                    |
| ------------------ | ---------------- | ---------------------------------------- |
| `id`               | UUID             | Aggregate root                           |
| `protocol`         | enum             | saml2 / oidc / ldap                      |
| `issuer`           | string           | SAML EntityID or OIDC issuer URL         |
| `attributeMapping` | JSON             | Maps IdP attributes to Shinã user fields |
| `roleMapping`      | JSON             | Maps IdP groups to Shinã roles           |
| `status`           | enum             | active / inactive / misconfigured        |
| `lastSyncAt`       | datetime \| null |                                          |

**Events emitted:** `integration.iam_configured`, `integration.iam_login_succeeded`, `integration.iam_login_failed`, `integration.iam_user_provisioned`, `integration.iam_user_deprovisioned`, `integration.iam_sync_completed`

---

### Aggregate: `SyncJob`

Scheduled, event-triggered, or on-demand data synchronisation between an external system and Shinã. Supports inbound, outbound, and bidirectional directions.

| Field                | Type           | Notes                                                        |
| -------------------- | -------------- | ------------------------------------------------------------ |
| `id`                 | UUID           | Aggregate root                                               |
| `providerId`         | UUID           |                                                              |
| `direction`          | enum           | inbound / outbound / bidirectional                           |
| `entity`             | string         | Shinã canonical entity — e.g. `vehicle`, `driver`, `invoice` |
| `trigger`            | enum           | scheduled / event / manual                                   |
| `cronExpression`     | string \| null |                                                              |
| `conflictResolution` | enum           | source_wins / destination_wins / newer_wins / manual         |
| `retryPolicyId`      | UUID           |                                                              |
| `status`             | enum           | active / paused / disabled                                   |

**Events emitted:** `integration.sync_job_started`, `integration.sync_job_completed`, `integration.sync_job_partial`, `integration.sync_job_failed`, `integration.sync_job_paused`

---

### Aggregate: `FieldMapping`

Bidirectional transformation rules between an external schema and Shinã's canonical model. Each rule composes a source path, target path, transform type, and optional condition.

| Field        | Type               | Notes                              |
| ------------ | ------------------ | ---------------------------------- |
| `id`         | UUID               | Aggregate root                     |
| `providerId` | UUID               |                                    |
| `direction`  | enum               | inbound / outbound / bidirectional |
| `entity`     | string             | Canonical entity — e.g. `vehicle`  |
| `rules`      | FieldMappingRule[] | Ordered — applied sequentially     |
| `version`    | integer            | Allows rollback                    |
| `status`     | enum               | active / draft / deprecated        |

Transforms supported: `none`, `uppercase`, `lowercase`, `trim`, `to_number`, `to_boolean`, `to_date`, `custom` (expression-based).

---

### Aggregate: `RetryPolicy`

Reusable retry configuration for REST calls, webhooks, and sync jobs. Supports fixed, linear, exponential, and exponential-with-jitter backoff.

| Field                    | Type      | Notes                                             |
| ------------------------ | --------- | ------------------------------------------------- |
| `id`                     | UUID      | Aggregate root                                    |
| `tenantId`               | UUID      | null = platform default                           |
| `backoffStrategy`        | enum      | fixed / linear / exponential / exponential_jitter |
| `maxAttempts`            | integer   |                                                   |
| `initialDelayMs`         | integer   |                                                   |
| `maxDelayMs`             | integer   |                                                   |
| `retryOn`                | integer[] | HTTP status codes — e.g. `[429, 502, 503, 504]`   |
| `deadLetterQueueEnabled` | boolean   |                                                   |

---

### Aggregate: `IntegrationAuditLog`

Immutable record of every integration activity. Write-only — no update or delete operations. Retained minimum 90 days.

| Field            | Type            | Notes                                             |
| ---------------- | --------------- | ------------------------------------------------- |
| `id`             | UUID            | Aggregate root                                    |
| `actorType`      | enum            | user / api_key / oauth_client / system / sync_job |
| `action`         | string          | e.g. `endpoint.called`, `webhook.delivered`       |
| `resourceType`   | string          | e.g. `RestEndpoint`, `Webhook`                    |
| `outcome`        | enum            | success / failure / partial                       |
| `httpStatusCode` | integer \| null |                                                   |
| `durationMs`     | integer \| null |                                                   |
| `attempt`        | integer         | 1 = first try                                     |
| `errorCode`      | string \| null  |                                                   |
| `occurredAt`     | datetime        |                                                   |

> Credential material is redacted from all audit log fields before persistence.
