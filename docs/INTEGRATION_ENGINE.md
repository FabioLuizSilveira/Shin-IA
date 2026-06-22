# Integration Engine — Shinã Platform

> Last updated: 2026-06-22 (Gate 2 — Documentation)

---

## Overview

The Integration Engine is the bounded context responsible for connecting the Shinã platform to external systems. It provides a uniform abstraction over inbound and outbound integrations: REST API consumption, webhook delivery and reception, credential management, data synchronization, and a complete audit trail of all external interactions.

The engine follows the same design principles as all other engines: pure repository interfaces (no concrete DB calls), no external SDK dependencies in the package itself, and domain events for cross-engine communication.

---

## Bounded Context

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Engine                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │  Integration │   │    Webhook   │   │    Sync      │        │
│  │   Provider   │   │   Registry   │   │    Jobs      │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                 │                  │                 │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌──────▼───────┐        │
│  │  API Keys &  │   │   External   │   │    Field     │        │
│  │OAuth Clients │   │    IAM       │   │   Mapping    │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                 │
│  ┌─────────────────────────────────────────┐                    │
│  │        Retry Policy + Audit Log         │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Aggregates

### `IntegrationProvider`

Represents a named, versioned connector to an external system. A provider bundles authentication configuration, base URL, capability declarations, and the field mappings used to translate between the external schema and Shinã's canonical model.

| Field           | Type     | Description                                                                                  |
| --------------- | -------- | -------------------------------------------------------------------------------------------- |
| `id`            | UUID     | Aggregate root                                                                               |
| `tenantId`      | UUID     | Owning tenant (`null` = platform-level provider)                                             |
| `name`          | string   | Unique slug — e.g. `sap-erp`, `salesforce-crm`, `custom-http`                                |
| `displayName`   | string   | Human-readable label                                                                         |
| `category`      | enum     | `erp` \| `crm` \| `telematics` \| `finance` \| `iam` \| `custom`                             |
| `baseUrl`       | string   | Root URL of the external system                                                              |
| `authType`      | enum     | `api_key` \| `oauth2_client_credentials` \| `oauth2_authorization_code` \| `basic` \| `none` |
| `credentialId`  | UUID     | FK → `ApiKey` or `OAuthClient`                                                               |
| `capabilities`  | string[] | e.g. `["read_orders", "push_tracking", "sync_customers"]`                                    |
| `version`       | string   | Provider schema version                                                                      |
| `status`        | enum     | `active` \| `inactive` \| `degraded` \| `maintenance`                                        |
| `retryPolicyId` | UUID     | FK → `RetryPolicy` (optional override)                                                       |
| `metadata`      | JSON     | Provider-specific config (timeouts, TLS options, custom headers)                             |
| `createdAt`     | datetime |                                                                                              |
| `updatedAt`     | datetime |                                                                                              |

**Events emitted:**
`integration.provider_registered`, `integration.provider_updated`, `integration.provider_activated`, `integration.provider_deactivated`

---

### `RestEndpoint`

Defines a single callable operation on an external REST API. Endpoints are referenced by Sync Jobs and triggered manually or programmatically.

| Field            | Type    | Description                                             |
| ---------------- | ------- | ------------------------------------------------------- |
| `id`             | UUID    | Aggregate root                                          |
| `tenantId`       | UUID    |                                                         |
| `providerId`     | UUID    | FK → `IntegrationProvider`                              |
| `name`           | string  | Unique per provider — e.g. `get_vehicle`, `post_order`  |
| `method`         | enum    | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE`         |
| `path`           | string  | Path template — e.g. `/vehicles/{vehicleId}`            |
| `headers`        | JSON    | Static headers merged with provider-level headers       |
| `queryParams`    | JSON    | Static query parameters                                 |
| `requestSchema`  | JSON    | JSON Schema of the expected request body                |
| `responseSchema` | JSON    | JSON Schema of the expected response body               |
| `fieldMappingId` | UUID    | FK → `FieldMapping` (request + response transformation) |
| `retryPolicyId`  | UUID    | FK → `RetryPolicy` (endpoint-level override)            |
| `timeoutMs`      | integer | Request timeout in milliseconds (default: 30 000)       |
| `status`         | enum    | `active` \| `deprecated` \| `inactive`                  |

**Events emitted:**
`integration.endpoint_called`, `integration.endpoint_succeeded`, `integration.endpoint_failed`

---

### `Webhook`

Models both outbound webhooks (Shinã pushes events to an external URL) and inbound webhooks (an external system pushes events to a Shinã-hosted endpoint).

| Field             | Type               | Description                                                                          |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `id`              | UUID               | Aggregate root                                                                       |
| `tenantId`        | UUID               |                                                                                      |
| `providerId`      | UUID               | FK → `IntegrationProvider` (optional — may be standalone)                            |
| `direction`       | enum               | `outbound` \| `inbound`                                                              |
| `name`            | string             |                                                                                      |
| `targetUrl`       | string             | For outbound: external URL. For inbound: Shinã-generated endpoint path               |
| `eventFilters`    | string[]           | Domain event types that trigger this webhook — e.g. `["tracking.position_received"]` |
| `signingSecret`   | string (encrypted) | HMAC-SHA256 shared secret for signature validation                                   |
| `signingHeader`   | string             | Header name used to carry the signature — e.g. `X-Shina-Signature`                   |
| `payloadTemplate` | string \| null     | Handlebar-style template for outbound payload shaping                                |
| `retryPolicyId`   | UUID               | FK → `RetryPolicy`                                                                   |
| `status`          | enum               | `active` \| `inactive` \| `suspended`                                                |
| `lastDeliveryAt`  | datetime \| null   |                                                                                      |
| `failureCount`    | integer            | Consecutive delivery failures (resets on success)                                    |

**Events emitted:**
`integration.webhook_delivered`, `integration.webhook_failed`, `integration.webhook_received`, `integration.webhook_signature_invalid`

---

### `ApiKey`

Manages credentials for external API authentication. Covers both keys issued **by** Shinã (for consumers of the Shinã API) and keys stored **for** consumption of external APIs.

| Field           | Type             | Description                                                             |
| --------------- | ---------------- | ----------------------------------------------------------------------- |
| `id`            | UUID             | Aggregate root                                                          |
| `tenantId`      | UUID             |                                                                         |
| `direction`     | enum             | `inbound` (issued to callers) \| `outbound` (stored for external APIs)  |
| `name`          | string           | Descriptive label                                                       |
| `keyHash`       | string           | PBKDF2/bcrypt hash (never stored in plaintext)                          |
| `keyPrefix`     | string           | First 8 chars of the key — used for identification in logs              |
| `scopes`        | string[]         | For inbound: Shinã permission scopes. For outbound: external API scopes |
| `expiresAt`     | datetime \| null |                                                                         |
| `lastUsedAt`    | datetime \| null |                                                                         |
| `status`        | enum             | `active` \| `revoked` \| `expired`                                      |
| `rotationDueAt` | datetime \| null | Reminder date for key rotation                                          |
| `metadata`      | JSON             | e.g. `{"ipAllowlist": ["192.168.1.0/24"]}`                              |
| `createdAt`     | datetime         |                                                                         |
| `revokedAt`     | datetime \| null |                                                                         |

**Events emitted:**
`integration.api_key_issued`, `integration.api_key_used`, `integration.api_key_revoked`, `integration.api_key_expired`, `integration.api_key_rotation_due`

---

### `OAuthClient`

Stores OAuth 2.0 client credentials for external service authorization. Supports both `client_credentials` and `authorization_code` grant types. Tokens are managed internally and refreshed automatically.

| Field              | Type                       | Description                                           |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| `id`               | UUID                       | Aggregate root                                        |
| `tenantId`         | UUID                       |                                                       |
| `providerId`       | UUID                       | FK → `IntegrationProvider`                            |
| `grantType`        | enum                       | `client_credentials` \| `authorization_code`          |
| `clientId`         | string                     | Client ID issued by the external authorization server |
| `clientSecretHash` | string                     | Encrypted client secret                               |
| `tokenUrl`         | string                     | Token endpoint of the external AS                     |
| `authorizationUrl` | string \| null             | Authorization endpoint (authorization_code only)      |
| `scopes`           | string[]                   | Requested OAuth scopes                                |
| `redirectUri`      | string \| null             | Redirect URI (authorization_code only)                |
| `accessToken`      | string (encrypted) \| null | Current access token                                  |
| `refreshToken`     | string (encrypted) \| null | Refresh token                                         |
| `tokenExpiresAt`   | datetime \| null           |                                                       |
| `status`           | enum                       | `active` \| `unauthorized` \| `revoked`               |
| `lastRefreshedAt`  | datetime \| null           |                                                       |

**Events emitted:**
`integration.oauth_token_obtained`, `integration.oauth_token_refreshed`, `integration.oauth_token_expired`, `integration.oauth_authorization_failed`

---

### `ExternalIam`

Represents an external identity provider (IdP) configured for a tenant. Supports SAML 2.0, OIDC, and LDAP. When active, Shinã delegates authentication to the configured IdP while still enforcing its own authorization model.

| Field              | Type             | Description                                                                                |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| `id`               | UUID             | Aggregate root                                                                             |
| `tenantId`         | UUID             |                                                                                            |
| `protocol`         | enum             | `saml2` \| `oidc` \| `ldap`                                                                |
| `displayName`      | string           | e.g. `Company Active Directory`                                                            |
| `issuer`           | string           | SAML EntityID or OIDC issuer URL                                                           |
| `metadataUrl`      | string \| null   | SAML metadata URL (auto-discovery)                                                         |
| `metadataXml`      | string \| null   | SAML metadata XML (manual upload)                                                          |
| `clientId`         | string \| null   | OIDC client ID                                                                             |
| `clientSecretHash` | string \| null   | OIDC client secret                                                                         |
| `discoveryUrl`     | string \| null   | OIDC discovery endpoint                                                                    |
| `ldapUrl`          | string \| null   | LDAP connection string                                                                     |
| `ldapBindDn`       | string \| null   | LDAP bind DN                                                                               |
| `ldapBaseDn`       | string \| null   | LDAP search base                                                                           |
| `attributeMapping` | JSON             | Maps IdP attributes to Shinã user fields — e.g. `{"email": "mail", "name": "displayName"}` |
| `roleMapping`      | JSON             | Maps IdP groups to Shinã roles — e.g. `{"CN=Fleet Managers": "fleet_manager"}`             |
| `ssoUrl`           | string           | IdP SSO endpoint                                                                           |
| `sloUrl`           | string \| null   | IdP Single Logout endpoint                                                                 |
| `status`           | enum             | `active` \| `inactive` \| `misconfigured`                                                  |
| `lastSyncAt`       | datetime \| null | Last successful attribute sync                                                             |

**Events emitted:**
`integration.iam_configured`, `integration.iam_login_succeeded`, `integration.iam_login_failed`, `integration.iam_user_provisioned`, `integration.iam_user_deprovisioned`, `integration.iam_sync_completed`

---

### `SyncJob`

Defines a data synchronization job that moves records between an external system and Shinã in one or both directions. Jobs may be scheduled (cron), event-triggered, or on-demand.

| Field                | Type             | Description                                                           |
| -------------------- | ---------------- | --------------------------------------------------------------------- |
| `id`                 | UUID             | Aggregate root                                                        |
| `tenantId`           | UUID             |                                                                       |
| `providerId`         | UUID             | FK → `IntegrationProvider`                                            |
| `name`               | string           |                                                                       |
| `description`        | string           |                                                                       |
| `direction`          | enum             | `inbound` \| `outbound` \| `bidirectional`                            |
| `entity`             | string           | Shinã canonical entity — e.g. `vehicle`, `driver`, `order`, `invoice` |
| `endpointId`         | UUID \| null     | FK → `RestEndpoint` (used to fetch/push data)                         |
| `fieldMappingId`     | UUID             | FK → `FieldMapping`                                                   |
| `trigger`            | enum             | `scheduled` \| `event` \| `manual`                                    |
| `cronExpression`     | string \| null   | Cron schedule (e.g. `0 */6 * * *`)                                    |
| `eventFilter`        | string \| null   | Domain event that triggers the job                                    |
| `batchSize`          | integer          | Records per batch (default: 100)                                      |
| `conflictResolution` | enum             | `source_wins` \| `destination_wins` \| `newer_wins` \| `manual`       |
| `retryPolicyId`      | UUID             | FK → `RetryPolicy`                                                    |
| `status`             | enum             | `active` \| `paused` \| `disabled`                                    |
| `lastRunAt`          | datetime \| null |                                                                       |
| `lastRunStatus`      | enum \| null     | `success` \| `partial` \| `failed`                                    |
| `nextRunAt`          | datetime \| null |                                                                       |

**Events emitted:**
`integration.sync_job_started`, `integration.sync_job_completed`, `integration.sync_job_failed`, `integration.sync_job_paused`

---

### `SyncJobRun`

Records a single execution of a `SyncJob`. Immutable after completion.

| Field              | Type             | Description                                     |
| ------------------ | ---------------- | ----------------------------------------------- |
| `id`               | UUID             | Aggregate root                                  |
| `tenantId`         | UUID             |                                                 |
| `jobId`            | UUID             | FK → `SyncJob`                                  |
| `trigger`          | enum             | `scheduled` \| `event` \| `manual`              |
| `status`           | enum             | `running` \| `success` \| `partial` \| `failed` |
| `totalRecords`     | integer \| null  |                                                 |
| `processedRecords` | integer          |                                                 |
| `failedRecords`    | integer          |                                                 |
| `errors`           | JSON             | Array of per-record error summaries             |
| `startedAt`        | datetime         |                                                 |
| `completedAt`      | datetime \| null |                                                 |
| `durationMs`       | integer \| null  |                                                 |

---

### `FieldMapping`

Defines bidirectional transformation rules between an external system's schema and Shinã's canonical model. Mappings compose simple path expressions, type coercions, and value transformations.

| Field        | Type               | Description                                 |
| ------------ | ------------------ | ------------------------------------------- |
| `id`         | UUID               | Aggregate root                              |
| `tenantId`   | UUID               |                                             |
| `providerId` | UUID               | FK → `IntegrationProvider`                  |
| `name`       | string             | e.g. `sap-vehicle-inbound`                  |
| `direction`  | enum               | `inbound` \| `outbound` \| `bidirectional`  |
| `entity`     | string             | Shinã canonical entity this mapping targets |
| `rules`      | FieldMappingRule[] | Ordered list of field rules                 |
| `version`    | integer            |                                             |
| `status`     | enum               | `active` \| `draft` \| `deprecated`         |
| `createdAt`  | datetime           |                                             |
| `updatedAt`  | datetime           |                                             |

#### `FieldMappingRule`

| Field                 | Type            | Description                                                                                            |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `sourcePath`          | string          | JSONPath in the external payload — e.g. `$.Fahrzeug.Kennzeichen`                                       |
| `targetPath`          | string          | Dot-notation path in Shinã model — e.g. `vehicle.licensePlate`                                         |
| `transform`           | enum            | `none` \| `uppercase` \| `lowercase` \| `trim` \| `to_number` \| `to_boolean` \| `to_date` \| `custom` |
| `transformExpression` | string \| null  | JavaScript-compatible expression for `custom` transform                                                |
| `defaultValue`        | unknown \| null | Value used when source path is absent                                                                  |
| `required`            | boolean         | If `true`, mapping fails when source path is absent and no default is set                              |
| `condition`           | string \| null  | JSONPath predicate — rule is skipped when false                                                        |

---

### `RetryPolicy`

Defines how failed integration calls (REST, webhooks, sync jobs) are retried. Policies are shared across providers and endpoints and can be overridden at any level.

| Field                    | Type      | Description                                                          |
| ------------------------ | --------- | -------------------------------------------------------------------- |
| `id`                     | UUID      | Aggregate root                                                       |
| `tenantId`               | UUID      | (`null` = platform default)                                          |
| `name`                   | string    | e.g. `aggressive`, `conservative`, `webhook-default`                 |
| `maxAttempts`            | integer   | Maximum number of total attempts (including first try)               |
| `backoffStrategy`        | enum      | `fixed` \| `linear` \| `exponential` \| `exponential_jitter`         |
| `initialDelayMs`         | integer   | Delay before the first retry                                         |
| `maxDelayMs`             | integer   | Cap on computed delay                                                |
| `multiplier`             | number    | Backoff multiplier for `linear` and `exponential` strategies         |
| `jitterMs`               | integer   | Maximum random jitter added to each delay                            |
| `retryOn`                | integer[] | HTTP status codes that trigger a retry (e.g. `[429, 502, 503, 504]`) |
| `timeoutMs`              | integer   | Per-attempt timeout                                                  |
| `deadLetterQueueEnabled` | boolean   | Route to DLQ after max attempts                                      |
| `alertOnExhaustion`      | boolean   | Emit alert when all retries are exhausted                            |

**Preset policies:**

| Preset            | maxAttempts | Strategy           | initialDelayMs | maxDelayMs |
| ----------------- | ----------- | ------------------ | -------------- | ---------- |
| `instant`         | 1           | —                  | —              | —          |
| `fast`            | 3           | exponential_jitter | 500            | 10 000     |
| `standard`        | 5           | exponential_jitter | 1 000          | 60 000     |
| `conservative`    | 10          | exponential_jitter | 5 000          | 900 000    |
| `webhook-default` | 5           | exponential_jitter | 2 000          | 300 000    |

---

### `IntegrationAuditLog`

Immutable record of every integration activity: API calls, webhook deliveries, sync job runs, credential usage, and configuration changes. Cannot be deleted or modified by any principal.

| Field               | Type            | Description                                                           |
| ------------------- | --------------- | --------------------------------------------------------------------- |
| `id`                | UUID            | Aggregate root                                                        |
| `tenantId`          | UUID            |                                                                       |
| `actorId`           | UUID \| null    | User or system that initiated the action                              |
| `actorType`         | enum            | `user` \| `api_key` \| `oauth_client` \| `system` \| `sync_job`       |
| `action`            | string          | Verb — e.g. `endpoint.called`, `webhook.delivered`, `api_key.revoked` |
| `resourceType`      | string          | Entity type — e.g. `RestEndpoint`, `Webhook`, `SyncJob`               |
| `resourceId`        | UUID            |                                                                       |
| `providerId`        | UUID \| null    |                                                                       |
| `outcome`           | enum            | `success` \| `failure` \| `partial`                                   |
| `httpMethod`        | string \| null  |                                                                       |
| `httpUrl`           | string \| null  | Redacted of secrets                                                   |
| `httpStatusCode`    | integer \| null |                                                                       |
| `requestSizeBytes`  | integer \| null |                                                                       |
| `responseSizeBytes` | integer \| null |                                                                       |
| `durationMs`        | integer \| null |                                                                       |
| `attempt`           | integer         | 1 = first try, 2+ = retries                                           |
| `errorCode`         | string \| null  |                                                                       |
| `errorMessage`      | string \| null  | Redacted of credentials                                               |
| `correlationId`     | string \| null  | Request tracing ID                                                    |
| `occurredAt`        | datetime        |                                                                       |

> **Retention:** Audit logs are retained for a minimum of 90 days (configurable per tenant, up to 7 years for compliance tenants). They are write-only; no update or delete operations are exposed.

---

## Runtime Architecture

### Outbound REST Call Flow

```
Caller (SyncJob / Manual / Event)
  │
  ▼
IntegrationRuntime.call(endpointId, payload)
  │
  ├─ Resolve: IntegrationProvider + RestEndpoint
  ├─ Resolve: Credentials (ApiKey or OAuthToken — refresh if expired)
  ├─ Apply: FieldMapping (outbound)
  ├─ Execute: HTTP request (with timeout)
  │    │
  │    ├─ Success ──► Apply FieldMapping (inbound) → return canonical payload
  │    └─ Failure ──► Check RetryPolicy
  │                    ├─ Retry if attempts < maxAttempts
  │                    └─ DLQ / Alert if exhausted
  │
  └─ Write: IntegrationAuditLog (always, success or failure)
```

### Inbound Webhook Flow

```
External System → POST /webhooks/inbound/{webhookId}
  │
  ├─ Verify: HMAC-SHA256 signature against signingSecret
  │    └─ Invalid ──► 401 + audit log `webhook.signature_invalid`
  │
  ├─ Match: eventFilters to resolve target domain handler
  ├─ Apply: FieldMapping (inbound)
  ├─ Emit: Domain event to internal event bus
  └─ Write: IntegrationAuditLog
```

### Outbound Webhook Delivery Flow

```
Domain event emitted (e.g. `tracking.position_received`)
  │
  ├─ Query: active Webhooks with matching eventFilter
  │
  └─ For each matching Webhook:
       ├─ Shape payload (payloadTemplate or default envelope)
       ├─ Sign payload with signingSecret (HMAC-SHA256)
       ├─ POST to targetUrl
       │    ├─ 2xx ──► mark delivered, reset failureCount
       │    └─ Non-2xx ──► apply RetryPolicy
       │                    └─ failureCount++; suspend if threshold reached
       └─ Write: IntegrationAuditLog
```

### Sync Job Execution Flow

```
Trigger (cron / event / manual)
  │
  ▼
SyncJobRuntime.execute(jobId)
  │
  ├─ Create: SyncJobRun (status: running)
  ├─ Fetch: records from source via RestEndpoint (paginated, batchSize)
  ├─ For each batch:
  │    ├─ Apply: FieldMapping
  │    ├─ Resolve conflicts (conflictResolution strategy)
  │    └─ Upsert records into destination
  │
  ├─ Update: SyncJobRun (status, counts, errors)
  ├─ Update: SyncJob.lastRunAt / lastRunStatus / nextRunAt
  └─ Emit: `integration.sync_job_completed` or `integration.sync_job_failed`
```

---

## Field Mapping — Transform Reference

| Transform    | Input                       | Output          | Example                                              |
| ------------ | --------------------------- | --------------- | ---------------------------------------------------- |
| `none`       | any                         | unchanged       | `"ABC"` → `"ABC"`                                    |
| `uppercase`  | string                      | string          | `"abc"` → `"ABC"`                                    |
| `lowercase`  | string                      | string          | `"ABC"` → `"abc"`                                    |
| `trim`       | string                      | string          | `" abc "` → `"abc"`                                  |
| `to_number`  | string \| number            | number          | `"42.5"` → `42.5`                                    |
| `to_boolean` | string \| number \| boolean | boolean         | `"true"`, `1`, `"yes"` → `true`                      |
| `to_date`    | string                      | ISO 8601 string | `"01/06/2026"` → `"2026-06-01T00:00:00.000Z"`        |
| `custom`     | any                         | any             | Evaluated expression — e.g. `value.replace('-', '')` |

Transforms are applied in rule order. A `condition` expression gates whether the rule runs at all, enabling conditional mapping (e.g. apply a transform only for certain provider versions).

---

## Credential Security Model

- **ApiKey values** are shown to the user exactly once at creation. Only the PBKDF2 hash is persisted.
- **OAuthClient secrets** and **access/refresh tokens** are stored AES-256 encrypted at rest using a per-tenant derived key.
- **ExternalIam LDAP bind passwords** and **OIDC client secrets** follow the same AES-256 scheme.
- **Webhook signing secrets** are stored encrypted and never returned via API after creation (only a masked preview: `sk_••••••••abcd`).
- All credential material is excluded from `IntegrationAuditLog` payloads — HTTP URLs are scrubbed of query-string secrets before logging.

---

## Repository Interfaces

```typescript
interface IntegrationProviderRepository {
  findById(id: string): Promise<IntegrationProvider | null>;
  findByTenantId(tenantId: string): Promise<IntegrationProvider[]>;
  findByName(tenantId: string, name: string): Promise<IntegrationProvider | null>;
  save(provider: IntegrationProvider): Promise<IntegrationProvider>;
  update(provider: IntegrationProvider): Promise<IntegrationProvider>;
}

interface RestEndpointRepository {
  findById(id: string): Promise<RestEndpoint | null>;
  findByProvider(providerId: string): Promise<RestEndpoint[]>;
  findByName(providerId: string, name: string): Promise<RestEndpoint | null>;
  save(endpoint: RestEndpoint): Promise<RestEndpoint>;
  update(endpoint: RestEndpoint): Promise<RestEndpoint>;
}

interface WebhookRepository {
  findById(id: string): Promise<Webhook | null>;
  findByTenantId(tenantId: string): Promise<Webhook[]>;
  findActiveByEventFilter(eventType: string): Promise<Webhook[]>;
  save(webhook: Webhook): Promise<Webhook>;
  update(webhook: Webhook): Promise<Webhook>;
}

interface ApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByPrefix(prefix: string): Promise<ApiKey | null>;
  findByTenantId(tenantId: string): Promise<ApiKey[]>;
  save(key: ApiKey): Promise<ApiKey>;
  update(key: ApiKey): Promise<ApiKey>;
}

interface OAuthClientRepository {
  findById(id: string): Promise<OAuthClient | null>;
  findByProvider(providerId: string): Promise<OAuthClient[]>;
  save(client: OAuthClient): Promise<OAuthClient>;
  update(client: OAuthClient): Promise<OAuthClient>;
}

interface ExternalIamRepository {
  findById(id: string): Promise<ExternalIam | null>;
  findByTenantId(tenantId: string): Promise<ExternalIam[]>;
  findActive(tenantId: string): Promise<ExternalIam | null>;
  save(iam: ExternalIam): Promise<ExternalIam>;
  update(iam: ExternalIam): Promise<ExternalIam>;
}

interface SyncJobRepository {
  findById(id: string): Promise<SyncJob | null>;
  findByTenantId(tenantId: string): Promise<SyncJob[]>;
  findDue(now: string): Promise<SyncJob[]>;
  save(job: SyncJob): Promise<SyncJob>;
  update(job: SyncJob): Promise<SyncJob>;
}

interface SyncJobRunRepository {
  findById(id: string): Promise<SyncJobRun | null>;
  findByJobId(jobId: string): Promise<SyncJobRun[]>;
  save(run: SyncJobRun): Promise<SyncJobRun>;
  update(run: SyncJobRun): Promise<SyncJobRun>;
}

interface FieldMappingRepository {
  findById(id: string): Promise<FieldMapping | null>;
  findByProvider(providerId: string): Promise<FieldMapping[]>;
  findByName(providerId: string, name: string): Promise<FieldMapping | null>;
  save(mapping: FieldMapping): Promise<FieldMapping>;
  update(mapping: FieldMapping): Promise<FieldMapping>;
}

interface RetryPolicyRepository {
  findById(id: string): Promise<RetryPolicy | null>;
  findByTenantId(tenantId: string): Promise<RetryPolicy[]>;
  findPlatformDefaults(): Promise<RetryPolicy[]>;
  save(policy: RetryPolicy): Promise<RetryPolicy>;
  update(policy: RetryPolicy): Promise<RetryPolicy>;
}

interface IntegrationAuditLogRepository {
  findByResource(resourceType: string, resourceId: string): Promise<IntegrationAuditLog[]>;
  findByTenantId(tenantId: string, from: string, to: string): Promise<IntegrationAuditLog[]>;
  findByActor(actorId: string): Promise<IntegrationAuditLog[]>;
  save(log: IntegrationAuditLog): Promise<IntegrationAuditLog>;
  // No update() — audit logs are immutable
}
```

---

## Domain Events

All integration events follow the platform envelope (`DomainEvent<T>`) defined in [`EVENT_CATALOG.md`](EVENT_CATALOG.md).

### Provider Events

| Event                              | Trigger                 | Key Payload                      |
| ---------------------------------- | ----------------------- | -------------------------------- |
| `integration.provider_registered`  | New provider created    | `providerId`, `name`, `category` |
| `integration.provider_updated`     | Provider config changed | `providerId`, `changes`          |
| `integration.provider_activated`   | Status → active         | `providerId`                     |
| `integration.provider_deactivated` | Status → inactive       | `providerId`, `reason`           |

### REST Endpoint Events

| Event                            | Trigger                 | Key Payload                                                     |
| -------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `integration.endpoint_called`    | HTTP request dispatched | `endpointId`, `providerId`, `attempt`                           |
| `integration.endpoint_succeeded` | 2xx response received   | `endpointId`, `statusCode`, `durationMs`                        |
| `integration.endpoint_failed`    | Non-2xx or timeout      | `endpointId`, `statusCode`, `errorCode`, `attempt`, `willRetry` |

### Webhook Events

| Event                                   | Trigger                   | Key Payload                                          |
| --------------------------------------- | ------------------------- | ---------------------------------------------------- |
| `integration.webhook_delivered`         | Outbound POST succeeded   | `webhookId`, `targetUrl`, `statusCode`, `durationMs` |
| `integration.webhook_failed`            | Outbound POST failed      | `webhookId`, `statusCode`, `attempt`, `willRetry`    |
| `integration.webhook_received`          | Valid inbound webhook     | `webhookId`, `eventType`, `payloadSizeBytes`         |
| `integration.webhook_signature_invalid` | HMAC mismatch             | `webhookId`, `sourceIp`                              |
| `integration.webhook_suspended`         | Failure threshold reached | `webhookId`, `failureCount`                          |

### API Key Events

| Event                              | Trigger                     | Key Payload                                 |
| ---------------------------------- | --------------------------- | ------------------------------------------- |
| `integration.api_key_issued`       | New key created             | `keyId`, `direction`, `keyPrefix`, `scopes` |
| `integration.api_key_used`         | Key authenticated a request | `keyId`, `keyPrefix`, `endpoint`            |
| `integration.api_key_revoked`      | Key manually revoked        | `keyId`, `revokedBy`                        |
| `integration.api_key_expired`      | Key passed `expiresAt`      | `keyId`, `keyPrefix`                        |
| `integration.api_key_rotation_due` | `rotationDueAt` reached     | `keyId`, `keyPrefix`                        |

### OAuth Events

| Event                                    | Trigger                       | Key Payload                           |
| ---------------------------------------- | ----------------------------- | ------------------------------------- |
| `integration.oauth_token_obtained`       | First token acquired          | `clientId`, `providerId`, `scopes`    |
| `integration.oauth_token_refreshed`      | Token refreshed before expiry | `clientId`, `providerId`              |
| `integration.oauth_token_expired`        | Token expired without refresh | `clientId`, `providerId`              |
| `integration.oauth_authorization_failed` | Auth server rejected request  | `clientId`, `providerId`, `errorCode` |

### External IAM Events

| Event                                | Trigger                    | Key Payload                         |
| ------------------------------------ | -------------------------- | ----------------------------------- |
| `integration.iam_configured`         | External IAM saved         | `iamId`, `protocol`, `issuer`       |
| `integration.iam_login_succeeded`    | SSO login successful       | `iamId`, `userId`, `protocol`       |
| `integration.iam_login_failed`       | SSO login failed           | `iamId`, `protocol`, `errorCode`    |
| `integration.iam_user_provisioned`   | JIT user created from IdP  | `iamId`, `userId`, `email`          |
| `integration.iam_user_deprovisioned` | User removed via SCIM/sync | `iamId`, `userId`                   |
| `integration.iam_sync_completed`     | Attribute sync finished    | `iamId`, `usersProcessed`, `errors` |

### Sync Job Events

| Event                            | Trigger                          | Key Payload                                           |
| -------------------------------- | -------------------------------- | ----------------------------------------------------- |
| `integration.sync_job_started`   | Run begins                       | `jobId`, `runId`, `trigger`                           |
| `integration.sync_job_completed` | Run ends successfully            | `jobId`, `runId`, `processedRecords`, `durationMs`    |
| `integration.sync_job_partial`   | Run completed with some failures | `jobId`, `runId`, `failedRecords`, `processedRecords` |
| `integration.sync_job_failed`    | Run failed entirely              | `jobId`, `runId`, `errorCode`                         |
| `integration.sync_job_paused`    | Job paused by user or system     | `jobId`, `reason`                                     |

---

## Integration with Other Engines

| Engine                  | Integration pattern                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **Notification Engine** | Integration events trigger notifications — e.g. `integration.sync_job_failed` → alert email           |
| **Reporting Engine**    | Sync job run history feeds the Reporting Engine's data sources for integration dashboards             |
| **AI Platform**         | AI agents may invoke `RestEndpoint`s as tools via the `ToolRegistry`                                  |
| **Tracking Engine**     | Inbound webhooks from tracking providers map to `tracking.position_received` events via field mapping |
| **Billing Engine**      | Outbound sync jobs push invoice data to ERP systems (SAP, Totvs)                                      |
| **Commission Engine**   | Inbound sync brings CRM data (deals, accounts) to enrich commission calculations                      |

---

## Decision Log

| Date       | Decision                                                              | Rationale                                                                                                   |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-06-22 | Separated `ApiKey` from `OAuthClient` into distinct aggregates        | Different lifecycle, rotation mechanics, and security requirements                                          |
| 2026-06-22 | `IntegrationAuditLog` is write-only with no delete operation          | Compliance requirement; immutability enforced at repository interface level                                 |
| 2026-06-22 | Field mappings are versioned and attached to providers, not endpoints | Providers and endpoints share mapping logic; versioning allows rollback without disrupting active endpoints |
| 2026-06-22 | RetryPolicy is a first-class aggregate, not embedded in each entity   | Reuse across REST, webhooks, and sync jobs; centralised management                                          |
| 2026-06-22 | `ExternalIam` uses JIT provisioning by default                        | Avoids pre-sync complexity; users are created on first login with attributes mapped from IdP                |
| 2026-06-22 | Webhook signing uses HMAC-SHA256 with configurable header name        | Compatible with GitHub, Stripe, and custom webhook conventions                                              |
