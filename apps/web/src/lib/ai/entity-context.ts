import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDomain } from "./tool-taxonomy";

// Agent Runtime v3, Wave 1 (spec sections 7-10) -- the real fix for the
// reported bug: "esse cliente que acabamos de cadastrar" has no way to
// resolve today because the web chat is 100% stateless (confirmed by
// reading route.ts/shina-drawer.tsx: no conversationId, no message
// history, ever sent or stored). This module is the minimum real
// persistence + resolution layer needed to fix that specific gap --
// full Goal/Workflow orchestration is Wave 2's job, built on top of this.

export type EntityRelation =
  | "CURRENT_CUSTOMER"
  | "CURRENT_ASSET"
  | "CURRENT_CONTRACT"
  | "CURRENT_TRIP"
  | "CURRENT_SERVICE_REQUEST";

export type EntitySource =
  | "CREATED_IN_CONVERSATION"
  | "SELECTED_BY_USER"
  | "MENTIONED_BY_USER"
  | "RESOLVED_BY_SEARCH"
  | "WORKFLOW_RESULT";

export interface ConversationEntityReference {
  entityType: ToolDomain;
  entityId: string;
  displayName: string;
  relation: EntityRelation;
  source: EntitySource;
  referencedAt: string;
}

/** Domain -> the relation a newly-created/selected entity of that domain
 * represents "right now" in the conversation. Only domains a tool can
 * actually produce a rememberable entity for need an entry here --
 * additive as more domains get resultEntity() support (Wave 2+). */
const DOMAIN_TO_RELATION: Partial<Record<ToolDomain, EntityRelation>> = {
  ORGANIZATION: "CURRENT_CUSTOMER",
  ASSET: "CURRENT_ASSET",
  CONTRACT: "CURRENT_CONTRACT",
  PASSENGER_TRANSPORT: "CURRENT_TRIP",
  TOWING: "CURRENT_SERVICE_REQUEST",
};

export function relationForDomain(domain: ToolDomain): EntityRelation | null {
  return DOMAIN_TO_RELATION[domain] ?? null;
}

/** Finds (or creates) the conversation row for this id -- a conversation
 * is tenant+user scoped, never shared, and any id from a DIFFERENT
 * tenant/user simply doesn't match, same posture as every other
 * tenant-scoped lookup in this app (never trust a client-supplied id
 * without a .eq("tenant_id", ...) filter). Bumps last_active_at on
 * every touch so a cleanup job (not built yet, Wave 2+ concern) can find
 * abandoned conversations later. */
export async function ensureConversation(
  db: SupabaseClient,
  tenantId: string,
  userId: string,
  conversationId: string,
): Promise<string> {
  const { data: existing } = await db
    .from("agent_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await db
      .from("agent_conversations")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", conversationId);
    return existing.id as string;
  }

  // The client generates the id (crypto.randomUUID()) -- inserting WITH
  // that id (not letting the default fill a new one) keeps the client's
  // and server's idea of "this conversation" the same value, so a
  // resumed drawer session with the same id keeps working.
  const { data: created, error } = await db
    .from("agent_conversations")
    .insert({ id: conversationId, tenant_id: tenantId, user_id: userId })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`ensureConversation: failed to create conversation: ${error?.message}`);
  }
  return created.id as string;
}

/** Records that an entity now exists/was selected in this conversation.
 * Never a substitute for authorization (spec section 42) -- this is
 * pure memory, re-validated against the real domain before any WRITE
 * (spec section 43, stale entity protection) by whatever reads it back. */
export async function recordEntityReference(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  ref: Omit<ConversationEntityReference, "referencedAt">,
): Promise<void> {
  await db.from("agent_conversation_entities").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    entity_type: ref.entityType,
    entity_id: ref.entityId,
    display_name: ref.displayName,
    relation: ref.relation,
    source: ref.source,
  });
}

interface EntityRow {
  entity_type: string;
  entity_id: string;
  display_name: string;
  relation: string;
  source: string;
  referenced_at: string;
}

/** Returns the MOST RECENT reference per relation (spec section 9's real
 * access pattern: "what's the current customer right now", never a full
 * history) -- tenant-scoped, never trusts conversationId alone (spec
 * section 44: cross-tenant protection). */
export async function getRecentEntities(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
): Promise<ConversationEntityReference[]> {
  const { data } = await db
    .from("agent_conversation_entities")
    .select("entity_type, entity_id, display_name, relation, source, referenced_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .order("referenced_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as EntityRow[];
  const seenRelations = new Set<string>();
  const recent: ConversationEntityReference[] = [];
  for (const row of rows) {
    if (seenRelations.has(row.relation)) continue; // already have the newer one for this relation
    seenRelations.add(row.relation);
    recent.push({
      entityType: row.entity_type as ToolDomain,
      entityId: row.entity_id,
      displayName: row.display_name,
      relation: row.relation as EntityRelation,
      source: row.source as EntitySource,
      referencedAt: row.referenced_at,
    });
  }
  return recent;
}

export interface EntityResolution {
  status: "RESOLVED" | "AMBIGUOUS" | "NONE";
  entity?: ConversationEntityReference;
  /** Set only when status is AMBIGUOUS (spec section 10: never choose
   * silently -- surface the candidates so the caller can ask). */
  candidates?: ConversationEntityReference[];
}

// Referential expressions this wave resolves (spec sections 8, 10) --
// started scoped to the ORGANIZATION/CURRENT_CUSTOMER case the reported
// bug and Wave 1's own gate are about. Agent Runtime v3, Wave 4 adds the
// ASSET/CURRENT_ASSET case -- the master prompt's own Maintenance
// example ("esse ônibus está fazendo um barulho estranho") is exactly
// this pattern, live-tested and found missing: create_asset only grew
// resultEntity() in Wave 4 (see create-asset.ts), but resolution never
// matched "esse ativo"/"esse veículo" at all since only the customer
// pattern existed. CURRENT_TRIP/CURRENT_SERVICE_REQUEST still reuse the
// same mechanism once a real "esse guincho"/"essa viagem" use case shows
// up -- nothing here is domain-specific in a way that needs rework.
const CUSTOMER_REFERENCE_PATTERN =
  /\b(esse|essa|esta|este|o|a)\s+(cliente|organiza[cç][aã]o|empresa)\b|cliente\s+que\s+acabamos?\s+de\s+cadastrar/i;
const ASSET_REFERENCE_PATTERN =
  /\b(esse|essa|esta|este)\s+(ativo|ve[ií]culo|carro|caminh[aã]o|[oô]nibus|equipamento)\b|(ativo|ve[ií]culo)\s+que\s+acabamos?\s+de\s+cadastrar/i;
const BARE_PRONOUN_PATTERN = /\b(ele|ela)\b/i;

/** Pure resolution logic (no db access) -- given the message text and
 * the recent entities already loaded for this conversation, decides
 * whether a referential expression ("esse cliente", "ele", or the
 * entity's own name echoed back) resolves to exactly one entity, more
 * than one (ambiguous, spec section 10 -- never guess), or none. */
export function resolveReferentialExpression(
  text: string,
  recentEntities: ConversationEntityReference[],
): EntityResolution {
  if (recentEntities.length === 0) return { status: "NONE" };

  // 1. Explicit name echo -- the exact case the reported bug's second
  // message hits ("...esse cliente que acabamos de cadastrar, o Eduardo
  // Gomid"): the entity's own display name appears verbatim in the
  // message. Safe even with multiple recent entities, since matching by
  // NAME is inherently unambiguous (two entities can't share a name in
  // this check without also matching a real duplicate scenario, which
  // AMBIGUOUS below still catches).
  const nameMatches = recentEntities.filter((e) =>
    text.toLowerCase().includes(e.displayName.toLowerCase()),
  );
  if (nameMatches.length === 1) return { status: "RESOLVED", entity: nameMatches[0] };
  if (nameMatches.length > 1) return { status: "AMBIGUOUS", candidates: nameMatches };

  // 2. "esse cliente" / "essa organização" / "o cliente que acabamos de
  // cadastrar" -- resolves to the most recent CURRENT_CUSTOMER.
  if (CUSTOMER_REFERENCE_PATTERN.test(text)) {
    const customer = recentEntities.find((e) => e.relation === "CURRENT_CUSTOMER");
    if (customer) return { status: "RESOLVED", entity: customer };
    return { status: "NONE" };
  }

  // 2b. "esse ativo" / "esse veículo" / "esse ônibus" -- resolves to the
  // most recent CURRENT_ASSET (Wave 4).
  if (ASSET_REFERENCE_PATTERN.test(text)) {
    const asset = recentEntities.find((e) => e.relation === "CURRENT_ASSET");
    if (asset) return { status: "RESOLVED", entity: asset };
    return { status: "NONE" };
  }

  // 3. Bare pronoun ("ele"/"ela") -- only safe to resolve when there is
  // EXACTLY ONE recent entity overall; with more than one, which
  // relation "ele" refers to is genuinely ambiguous across different
  // entity types, so this deliberately does not guess (spec section 10).
  if (BARE_PRONOUN_PATTERN.test(text)) {
    if (recentEntities.length === 1) return { status: "RESOLVED", entity: recentEntities[0] };
    return { status: "AMBIGUOUS", candidates: recentEntities };
  }

  return { status: "NONE" };
}

const ORGANIZATION_SELECT = "id, name, type, document, email, phone, address_city, address_state";
const ASSET_SELECT = "id, name, category, status, serial_number";

/** Re-reads the resolved entity fresh from its real domain table (spec
 * section 43 -- stale entity protection: a name/relation remembered a
 * few messages ago must never be trusted as current data, only as a
 * pointer to re-resolve) and formats it as a system-note the LLM can use
 * without asking the user again. Returns null when the domain has no
 * fresh-read support yet (ORGANIZATION and, since Wave 4, ASSET) or the
 * entity no longer exists/belongs to this tenant (never fabricate stale
 * data instead). ALWAYS tenant-scoped (spec section 44) — an entityId
 * that used to belong to this tenant but was moved/deleted resolves to
 * nothing, never another tenant's row. */
export async function buildEntityContextNote(
  db: SupabaseClient,
  tenantId: string,
  entity: ConversationEntityReference,
): Promise<string | null> {
  if (entity.entityType === "ORGANIZATION") {
    const { data } = await db
      .from("organizations")
      .select(ORGANIZATION_SELECT)
      .eq("id", entity.entityId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return null;

    const parts = [
      `nome: ${data.name}`,
      `documento: ${data.document}`,
      `tipo: ${data.type}`,
      `cidade: ${data.address_city}`,
      `estado: ${data.address_state}`,
    ];
    if (data.email) parts.push(`e-mail: ${data.email}`);
    if (data.phone) parts.push(`telefone: ${data.phone}`);

    return `[Contexto da conversa — cliente atual já identificado, NÃO peça esses dados de novo ao usuário: ${parts.join(", ")}. ID interno: ${data.id}.]`;
  }

  if (entity.entityType === "ASSET") {
    const { data } = await db
      .from("assets")
      .select(ASSET_SELECT)
      .eq("id", entity.entityId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;

    const parts = [`nome: ${data.name}`, `categoria: ${data.category}`, `status: ${data.status}`];
    if (data.serial_number) parts.push(`número de série: ${data.serial_number}`);

    return `[Contexto da conversa — ativo/veículo atual já identificado, NÃO peça esses dados de novo ao usuário: ${parts.join(", ")}. ID interno: ${data.id}.]`;
  }

  return null;
}
