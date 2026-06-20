# Billing & Commission — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

This document describes the two distinct financial engines within the Shinã Platform: the **Billing Engine** and the **Commission Engine**. These are separate bounded contexts with different data models, lifecycles, and purposes.

---

## Conceptual Separation

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│        BILLING ENGINE       │   │      COMMISSION ENGINE      │
│                             │   │                             │
│  Shinã Platform → Tenant    │   │  Tenant → Sales Agent       │
│                             │   │                             │
│  Subscription fees          │   │  Sales incentives           │
│  Usage-based charges        │   │  Commission calculations    │
│  Invoice generation         │   │  Campaign bonuses           │
│  Payment processing         │   │  Settlement payouts         │
│                             │   │                             │
│  Who pays: Tenant           │   │  Who pays: Tenant           │
│  Who receives: Shinã        │   │  Who receives: Agent        │
└─────────────────────────────┘   └─────────────────────────────┘
```

**Key rule:** The Billing Engine manages what tenants owe to the platform. The Commission Engine manages what tenants owe to their own agents and sales teams. They share no data models and are billed independently.

---

## Billing Engine

### Purpose

The Billing Engine manages the commercial relationship between the **Shinã Platform** and each **Tenant**. It handles subscription management, usage metering, invoice generation, and payment processing.

### Domain Concepts

#### `SubscriptionPlan`
The platform's product catalog. Each plan defines a set of features, limits, and pricing.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `name` | string | e.g. "Starter", "Professional", "Enterprise" |
| `priceMonthly` | Money | |
| `priceAnnual` | Money | null = no annual option |
| `features` | string[] | Included capabilities |
| `limits` | PlanLimits | e.g. max users, max assets, API calls/month |
| `status` | enum | active / deprecated |

#### `TenantSubscription`
A tenant's active subscription to a `SubscriptionPlan`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `planId` | UUID | |
| `billingCycle` | enum | monthly / annual |
| `currentPeriodStart` | date | |
| `currentPeriodEnd` | date | |
| `status` | enum | trialing / active / past_due / canceled / paused |
| `canceledAt` | datetime | null if active |
| `trialEndsAt` | datetime | null if not in trial |

#### `UsageRecord`
A metered usage event for billing purposes (e.g., API calls, tracked assets, active users above plan limit).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `metric` | string | e.g. "tracked_assets", "api_calls", "sms_notifications" |
| `quantity` | decimal | |
| `unitPrice` | Money | Price per unit above plan limit |
| `period` | DateRange | |

#### `Invoice`
A billing document issued to a tenant for a billing period.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `subscriptionId` | UUID | |
| `number` | string | Human-readable invoice number |
| `period` | DateRange | |
| `lineItems` | LineItem[] | Subscription + usage charges |
| `subtotal` | Money | |
| `tax` | Money | |
| `total` | Money | |
| `status` | enum | draft / open / paid / void / uncollectible |
| `dueDate` | date | |
| `paidAt` | datetime | |

#### `Payment`
A payment recorded against an invoice.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `invoiceId` | UUID | |
| `tenantId` | UUID | |
| `amount` | Money | |
| `method` | enum | card / bank_transfer / pix / boleto |
| `status` | enum | pending / succeeded / failed / refunded |
| `externalId` | string | Payment processor reference |
| `processedAt` | datetime | |

### Billing Events

| Event | Trigger |
|-------|---------|
| `billing.subscription_created` | Tenant subscribes |
| `billing.subscription_updated` | Plan change, cycle change |
| `billing.subscription_canceled` | Tenant cancels |
| `billing.trial_started` | Tenant begins trial period |
| `billing.trial_ending_soon` | 7 days before trial expiry |
| `billing.trial_ended` | Trial period expired |
| `billing.invoice_created` | Invoice generated for period |
| `billing.invoice_paid` | Payment confirmed |
| `billing.invoice_overdue` | Payment not received by due date |
| `billing.payment_succeeded` | Payment processing succeeded |
| `billing.payment_failed` | Payment processing failed |
| `billing.usage_threshold_reached` | Usage approaching plan limit |

### Plan Limits & Overage

When a tenant exceeds a plan limit:
1. A `billing.usage_threshold_reached` event fires at 80% and 100%.
2. Overage continues to be tracked as `UsageRecord` entries.
3. Overage is billed on the next invoice at the configured per-unit rate.
4. Tenants can upgrade plans at any time; upgrade is prorated.

---

## Commission Engine

### Purpose

The Commission Engine manages the commercial incentive program within a **Tenant** — calculating, tracking, approving, and settling commissions owed by the tenant to their own **agents, salespeople, or operators**.

The Shinã Platform provides the Commission Engine as a tool. What happens with the resulting numbers (payroll, ERP integration, etc.) is the tenant's responsibility.

### Domain Concepts

See [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) for full aggregate specs:
- `CommissionPlan`
- `CommissionRule`
- `CommissionCampaign`
- `CommissionTransaction`
- `CommissionSettlement`
- `CommissionApproval`

### Commission Calculation Flow

```
Qualifying Event occurs (e.g., sale completed, order delivered)
  │
  ▼
Commission Engine receives domain event
  │
  ▼
Find applicable CommissionPlan for agent + product line + date
  │
  ▼
Evaluate CommissionRules in priority order
  │
  ▼
Check for active CommissionCampaign → apply overrides/bonus
  │
  ▼
Calculate commissionAmount
  │
  ▼
Create CommissionTransaction (status: pending)
  │
  ▼
Route to approval if amount > threshold
  │
  ▼
On approval → mark as "approved" → eligible for settlement
```

### Settlement Flow

```
Settlement period ends (e.g., end of week)
  │
  ▼
Settlement batch created for each agent with approved transactions
  │
  ▼
Settlement submitted for approval
  │
  ▼
Approval workflow (multi-step if configured)
  │
  ▼
On final approval → mark as "approved"
  │
  ▼
Finance processes payout (outside platform)
  │
  ▼
Record payment in platform → mark as "paid"
```

### Commission vs. Billing: Key Differences

| Dimension | Billing Engine | Commission Engine |
|-----------|---------------|-----------------|
| Payer | Tenant | Tenant |
| Recipient | Shinã Platform | Tenant's agent/employee |
| Trigger | Subscription cycle / usage | Business transaction (sale, delivery, etc.) |
| Regulated | Yes (NF-e, tax) | Depends on jurisdiction |
| Settlement | Automated (payment processor) | Manual (payroll/ERP) |
| Dispute resolution | Platform support | Tenant-internal |
| Data ownership | Platform | Tenant |
| Audit retention | 7 years | 7 years |

---

## Integration Points

### Billing → Commission (one-way)

The Billing Engine can inform the Commission Engine which plans are active (to gate access to commission features), but Commission data never flows back to Billing.

### Commission → External Systems

The Commission Engine is designed to export settlement data to external payroll or ERP systems via:
- Scheduled CSV/XLSX export (M3)
- Webhook on settlement approval (M5)
- REST API for pull-based integration (M5)

---

## Regulatory Notes

- **Billing invoices** may require NF-e (Nota Fiscal Eletrônica) emission in Brazil — integration to be specified in M3.
- **Commission transactions** are not invoices — they represent internal accounting records. Tax treatment depends on whether agents are employees or contractors.
- Both engines must retain records for a minimum of **7 years** for Brazilian regulatory compliance.
