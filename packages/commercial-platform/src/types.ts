// Unified commercial flow shared by Shinã Platform and Shinã MKT — see
// supabase/migrations/20260072000000_commercial_flow.sql for the schema this
// layer orchestrates. Sits ABOVE @shina/billing-platform (which stays the
// thin Stripe adapter + platform_subscriptions sync, untouched) — this
// package owns the business sequence: accept -> snapshot -> checkout ->
// webhook -> activate -> entitlements, for both products identically.

export type Product = "platform" | "mkt";

export interface PlanVersion {
  id: string;
  plan_id: string;
  version: number;
  name: string;
  price_cents: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  trial_days: number;
  commitment_period_months: number | null;
  included_features: string[];
  usage_limits: Record<string, unknown>;
  overage_rules: Record<string, unknown>;
  discount_rules: Record<string, unknown>;
  revenue_share: Record<string, unknown>;
  metadata: Record<string, unknown>;
  stripe_price_id: string | null;
  status: "draft" | "published" | "superseded";
}

export interface ContractVersion {
  id: string;
  contract_template_id: string;
  version: number;
  title: string;
  content: string;
  content_hash: string;
  material_change: boolean;
  status: "draft" | "published" | "superseded";
}

export interface RepresentativeInfo {
  name: string;
  role: string;
  document?: string;
  declaredAuthority: boolean;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  sessionId?: string | null;
}

export interface AcceptContractInput {
  // Nullable: an MKT-only buyer never becomes a Shinã Platform tenant (see
  // platform_customers' own header comment) — their acceptance is keyed by
  // userId instead. Always non-null for the Platform product.
  tenantId: string | null;
  userId: string;
  product: Product;
  planVersionId: string;
  representative: RepresentativeInfo;
  request: RequestContext;
}

export interface CreateCommercialCheckoutInput {
  tenantId: string | null;
  userId: string;
  email: string;
  product: Product;
  planVersionId: string;
  contractAcceptanceId: string;
  commercialTermsSnapshotId: string;
  successUrl: string;
  cancelUrl: string;
  /** Extra provider metadata a caller needs (e.g. MKT's refund-guarantee deadline). */
  extraMetadata?: Record<string, string>;
  /**
   * Passed straight through to the gateway for providers that need them
   * (Asaas's checkout `customerData`, no separate createCustomer() call in
   * that flow) — sourced from the same RepresentativeInfo already
   * collected at contract acceptance. Ignored by the Stripe provider.
   */
  customerName?: string;
  customerDocument?: string;
  /**
   * Billing address — live-verified against the Asaas sandbox (Fase A of
   * the Stripe -> Asaas migration) to be required for checkout creation.
   * Optional here (Stripe never reads these); the caller collects them
   * once at signup and threads them through regardless of which gateway
   * ends up active.
   */
  phone?: string;
  address?: string;
  addressNumber?: string;
  postalCode?: string;
  province?: string;
}
