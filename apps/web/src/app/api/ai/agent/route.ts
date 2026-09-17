import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { buildAgentContext } from "@/lib/ai/agent-context";
import { buildAgentToolRegistry } from "@/lib/ai/tools";
import { buildMutationToolRegistry } from "@/lib/ai/actions/tools";
import type { ProposedPlan } from "@/lib/ai/actions/mutation-registry";
import { AI_AGENT_EVENTS, AI_ACTION_EVENTS, AI_GOAL_EVENTS } from "@/lib/ai/audit-events";
import {
  AttachmentError,
  processAttachments,
  type AgentAttachmentInput,
} from "@/lib/ai/attachments";
import { classifyIntent } from "@/lib/ai/intent-router";
import { filterToolsByIntent } from "@/lib/ai/capability-router";
import { resolveAgentModelTier, resolveModelForTier } from "@/lib/ai/model-router";
import {
  ensureConversation,
  getRecentEntities,
  resolveReferentialExpression,
  buildEntityContextNote,
} from "@/lib/ai/entity-context";
import {
  resolveGoalType,
  computeNextBestAction,
  resolveOfferedSelection,
  GOAL_MUTATION_TOOL,
  GOAL_DOMAIN,
  type OfferedOption,
} from "@/lib/ai/goal-resolver";
import {
  getActiveGoal,
  createGoal,
  updateGoalState,
  extractGoalSlots,
  type AgentGoal,
} from "@/lib/ai/agent-goal";
import {
  runAiGateway,
  AiPolicyError,
  InsufficientCreditsError,
  DuplicateRequestError,
  OpenAIProviderError,
  type OpenAiMessage,
  type OpenAiContentPart,
  type OpenAiToolDefinition,
} from "@shina/ai-gateway";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Você é a Shinã, a assistente operacional da plataforma Shinã.

REGRAS OBRIGATÓRIAS:
- Você só pode obter informações através das ferramentas (tools) fornecidas. Nunca invente dados, nunca acesse ou mencione acessar o banco de dados diretamente, nunca gere SQL.
- Toda afirmação sobre dados reais deve vir literalmente do resultado de uma ferramenta chamada nesta conversa.
- Se as ferramentas disponíveis não derem informação suficiente para responder, diga isso claramente em vez de adivinhar.
- Você nunca executa uma ação real diretamente — mas CHAMAR a ferramenta de ação é sempre seguro: ela nunca executa nada sozinha, apenas cria um plano pendente. Por isso, quando o usuário pedir uma ação (marcar notificações como lidas, criar um ativo, etc.) e existir uma ferramenta para isso, CHAME A FERRAMENTA IMEDIATAMENTE nesta mesma resposta — nunca pergunte em texto "posso fazer isso?" antes de chamar a ferramenta; a confirmação de verdade acontece depois, na interface (botões Confirmar/Cancelar), nunca na conversa. Depois de chamar a ferramenta, diga que o plano está pronto para confirmação — nunca diga que a ação "foi feita".
- Você só sabe o que este usuário pode saber e só faz o que este usuário pode fazer — nunca mencione ou tente acessar dados de outro tenant.
- Quando uma ferramenta precisar de um ID (UUID) e o usuário só tiver dado um nome (de ativo, cliente, contrato, etc.), NUNCA peça o UUID ao usuário primeiro. Em vez disso, chame a ferramenta de busca/listagem correspondente (ex: list_assets, search_customers) para encontrar o ID pelo nome, e só depois chame a ferramenta que precisa do ID — tudo na mesma resposta, encadeando as chamadas.
- list_available_tools serve só para responder "o que você consegue fazer" — NUNCA a chame antes de tentar atender um pedido concreto do usuário, e NUNCA a chame mais de uma vez na mesma conversa. Se o pedido do usuário corresponde claramente ao nome/descrição de uma ferramenta (ex: "cadastre esse cliente" → create_organization; "crie um ativo" → create_asset), chame essa ferramenta diretamente — não explore o catálogo primeiro.
- Dados podem vir digitados, ou extraídos de um documento/imagem anexado (você recebe o conteúdo do anexo já disponível nesta mensagem) — extraia os campos necessários do texto/imagem e chame a ferramenta de ação com eles. Só pergunte ao usuário o que faltar depois de tentar extrair tudo que já foi fornecido.
- Se o resultado de uma ferramenta de ação vier com "alreadyPending": true, já existe um plano idêntico aguardando confirmação — não chame a ferramenta de novo, apenas avise o usuário que o plano já está pronto para confirmar.
- Responda em português do Brasil, de forma direta e objetiva.`;

// Raised from 4 to 6 (2026-09-05): with 30+ tools now registered across
// Waves 3-7, a query needing 2 chained calls (e.g. resolve an asset name
// via list_assets, then call get_asset_health_score with its id) started
// hitting the old cap under gpt-4o-mini — a real tool-selection/chaining
// limitation, not something this constant alone fixes, but it buys enough
// room for the common 2-3 step case to converge instead of hard-failing.
const MAX_TURNS = 6;

// gpt-4o-mini, given a big tool catalog plus an attachment, sometimes
// "explores" instead of acting: calling list_available_tools (occasionally
// more than once) and then get_product_help for a handful of unrelated
// topics — burning the whole MAX_TURNS budget before ever trying the tool
// that actually matches the request. A stronger system-prompt instruction
// alone didn't stop this (live-verified: identical behavior before/after).
// This caps those specific discovery/help tools at one real call per
// request — every call past that gets a corrective tool result instead of
// running again, pushing the model back toward picking a real tool.
const DISCOVERY_TOOL_NAMES = new Set([
  "list_available_tools",
  "get_product_help",
  "get_screen_help",
  "get_feature_explanation",
]);
const MAX_DISCOVERY_CALLS = 1;

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  if (!(await isFeatureEnabled(scope, "agent.enabled"))) {
    return NextResponse.json(
      { error: "Shinã ainda não está habilitada para este tenant." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    currentModule?: string;
    currentResource?: { type: string; id: string };
    attachments?: AgentAttachmentInput[];
    // Agent Runtime v3, Wave 1 — client-generated (crypto.randomUUID()),
    // stable for the lifetime of one drawer session. Optional so an
    // older client (or any caller that predates this wave) keeps working
    // exactly as before, just without conversation memory.
    conversationId?: string;
  };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  if (body.attachments?.length && !(await isFeatureEnabled(scope, "agent.attachments.enabled"))) {
    return NextResponse.json(
      { error: "Anexos ainda não estão habilitados para este tenant." },
      { status: 403 },
    );
  }

  let imageParts: OpenAiContentPart[] = [];
  let documentText: string | null = null;
  if (body.attachments?.length) {
    try {
      const processed = await processAttachments(body.attachments);
      imageParts = processed.imageParts;
      documentText = processed.documentText;
      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "ai_agent",
        entityId: crypto.randomUUID(),
        action: AI_AGENT_EVENTS.ATTACHMENT_PROCESSED,
        metadata: processed.meta,
      });
    } catch (e) {
      if (e instanceof AttachmentError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  }

  const ctx = await buildAgentContext(scope, {
    currentModule: body.currentModule,
    currentResource: body.currentResource,
  });

  const requestId = crypto.randomUUID();
  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "ai_agent",
    entityId: requestId,
    action: AI_AGENT_EVENTS.REQUEST,
    metadata: { currentModule: ctx.currentModule, currentResource: ctx.currentResource },
  });

  const registry = buildAgentToolRegistry();
  const availableTools = await registry.listAvailable(scope, ctx);
  const mutationRegistry = buildMutationToolRegistry();
  // Agent Runtime v3, Wave 2 — mutable: the goal orchestrator below may
  // remove a goal's own mutation tool from this list for a turn where
  // NextBestAction isn't EXECUTE yet (structural guard, not just a
  // prompt instruction — see the block below for why a prompt-only
  // "don't call this yet" was live-verified NOT to work).
  let availableMutationTools = await mutationRegistry.listAvailable(scope, ctx);
  const mutationToolNames = new Set(availableMutationTools.map((t) => t.name));

  let queryText = documentText ? `${body.query.trim()}\n\n${documentText}` : body.query.trim();

  // Agent Runtime v3, Wave 1 (spec sections 7-10) — the real fix for
  // "esse cliente que acabamos de cadastrar": resolve any referential
  // expression against this conversation's recently created/selected
  // entities BEFORE the model ever sees the message, and inject the
  // resolved entity's FRESH data (never the remembered snapshot — spec
  // section 43) so the model has what it needs this turn instead of
  // asking again. An ambiguous match short-circuits with a clarifying
  // question (spec section 10: never choose silently) rather than
  // spending an LLM call on a guess.
  let conversationId: string | null = null;
  let activeGoal: AgentGoal | null = null;
  // Moved up from the v2 dynamic-routing block below (spec section 34:
  // the goal orchestrator's own forcing takes PRIORITY over the general
  // Intent/Capability Router's forcing — see the guard where that block
  // sets this further down, it only applies if still null).
  let forcedToolName: string | null = null;
  // Agent Runtime v3, Wave 3 — the goal-state key a forced search tool's
  // results should be captured under this turn (e.g. "assetId" for
  // CREATE_RENTAL's list_assets search), read by the capture hook in the
  // turn loop below. Only set when this turn is actually forcing a
  // searchTool for a still-missing field (see the ASK_USER branch).
  let pendingOfferedField: string | null = null;
  // Declared here (not with the other per-turn accumulators further
  // down) so both the Wave 2 goal-slot extraction call below and the
  // Wave 2 v2 Intent Router's own classification call — real, metered AI
  // Gateway calls in their own right (spec section 41) — fold into the
  // same total the response reports, never an untracked cost.
  let totalCreditsConsumed = 0;
  if (body.conversationId) {
    conversationId = await ensureConversation(
      scope.db,
      scope.tenantId,
      scope.userId,
      body.conversationId,
    );
    const recentEntities = await getRecentEntities(scope.db, scope.tenantId, conversationId);
    const resolution = resolveReferentialExpression(queryText, recentEntities);

    if (resolution.status === "AMBIGUOUS" && resolution.candidates) {
      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "ai_agent",
        entityId: crypto.randomUUID(),
        action: AI_AGENT_EVENTS.ENTITY_AMBIGUOUS,
        metadata: { candidateCount: resolution.candidates.length },
      });
      const names = resolution.candidates.map((c) => `"${c.displayName}"`).join(", ");
      return NextResponse.json({
        data: {
          text: `Encontrei mais de uma opção que pode ser essa: ${names}. Qual delas você quer dizer?`,
          toolsUsed: [],
          creditsConsumed: 0,
        },
      });
    }

    let resolvedCustomerOrgId: string | null = null;
    // Agent Runtime v3, Wave 4 — the master prompt's own Maintenance
    // example: "esse ônibus está fazendo um barulho estranho, abre uma
    // manutenção" must resolve "esse ônibus" from the recent/current
    // Asset and never re-ask for plate/model. Generalized (not
    // maintenance-specific) since Inspection and Rental's assetId slot
    // benefit from the exact same auto-fill.
    let resolvedAssetId: string | null = null;
    if (resolution.status === "RESOLVED" && resolution.entity) {
      if (resolution.entity.relation === "CURRENT_CUSTOMER") {
        resolvedCustomerOrgId = resolution.entity.entityId;
      }
      if (resolution.entity.relation === "CURRENT_ASSET") {
        resolvedAssetId = resolution.entity.entityId;
      }
      const note = await buildEntityContextNote(scope.db, scope.tenantId, resolution.entity);
      if (note) {
        queryText = `${queryText}\n\n${note}`;
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: crypto.randomUUID(),
          action: AI_AGENT_EVENTS.ENTITY_RESOLVED,
          metadata: {
            entityType: resolution.entity.entityType,
            relation: resolution.entity.relation,
          },
        });
      }
    }

    // Agent Runtime v3, Wave 2 (spec sections 4, 11-15) — Goal Resolution
    // + Workflow Orchestration, validated against Towing and Passenger
    // Transport per explicit decision (real domain services already
    // exist for these two; Rental does not yet — see this wave's
    // report). Resumes an already-ACTIVE goal for this conversation
    // before trying to start a new one (spec section 6: a follow-up
    // message like "o Mobi" or "amanhã às 9" never re-triggers the
    // keyword classifier, it just keeps feeding the same goal).
    activeGoal = await getActiveGoal(scope.db, scope.tenantId, conversationId);
    if (activeGoal) {
      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "agent_goal",
        entityId: activeGoal.id,
        action: AI_GOAL_EVENTS.RESUMED,
        metadata: { type: activeGoal.type },
      });
    } else {
      const goalType = resolveGoalType(queryText);
      if (goalType) {
        const domain = GOAL_DOMAIN[goalType];
        activeGoal = await createGoal(
          scope.db,
          scope.tenantId,
          scope.userId,
          conversationId,
          goalType,
          domain,
        );
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "agent_goal",
          entityId: activeGoal.id,
          action: AI_GOAL_EVENTS.CREATED,
          metadata: { type: goalType },
        });
      }
    }

    if (activeGoal) {
      // Agent Runtime v3, Wave 3 — the canonical flow's "O Mobi" step:
      // a PRIOR turn forced a search tool (list_assets) and offered real
      // candidates, captured into activeGoal.state (see the capture hook
      // in the turn loop below). This turn's message may be selecting
      // one of them by name — resolved BEFORE the general slot
      // extraction, same "never guess, only an unambiguous name match"
      // discipline as entity-context.ts.
      const patch: Record<string, unknown> = {};
      const offeredAssets = activeGoal.state.__offeredAssets as OfferedOption[] | undefined;
      const offeredField = activeGoal.state.__offeredAssetsField as string | undefined;
      if (offeredAssets && offeredField && !activeGoal.state[offeredField]) {
        const selection = resolveOfferedSelection(queryText, offeredAssets);
        if (selection.status === "AMBIGUOUS") {
          const names = selection.candidates.map((c) => `"${c.name}"`).join(", ");
          return NextResponse.json({
            data: {
              text: `Encontrei mais de uma opção que pode ser essa: ${names}. Qual delas você quer dizer?`,
              toolsUsed: [],
              creditsConsumed: totalCreditsConsumed,
            },
          });
        }
        if (selection.status === "RESOLVED") {
          patch[offeredField] = selection.id;
          // updateGoalState's merge skips null/undefined values (by
          // design, so a turn's extraction never erases an already-known
          // field) — that means putting __offeredAssets/Field in `patch`
          // as null would silently NOT clear them. Clear them on the
          // local copy directly instead, so the offer never leaks into a
          // later, unrelated turn once it's been consumed.
          const clearedState = { ...activeGoal.state };
          delete clearedState.__offeredAssets;
          delete clearedState.__offeredAssetsField;
          activeGoal = { ...activeGoal, state: clearedState };
        }
      }

      const extraction = await extractGoalSlots(
        scope.db,
        { workspaceId: ctx.workspaceId, tenantId: ctx.tenantId, userId: ctx.userId },
        activeGoal.type,
        queryText,
        activeGoal.state,
      );
      totalCreditsConsumed += extraction.creditsConsumed ?? 0;
      Object.assign(patch, extraction.slots);
      if (resolvedCustomerOrgId && !activeGoal.state.customerOrganizationId) {
        patch.customerOrganizationId = resolvedCustomerOrgId;
      }
      if (resolvedAssetId && !activeGoal.state.assetId) {
        patch.assetId = resolvedAssetId;
      }
      // Defensive second layer, never trust extraction alone: a new
      // scheduledEndsAt that would land at/before the already-known (or
      // just-extracted) scheduledStartsAt is dropped rather than
      // persisted — better to ask again than silently store an invalid
      // window the real domain service would reject anyway.
      const effectiveStart = (patch.scheduledStartsAt ?? activeGoal.state.scheduledStartsAt) as
        | string
        | undefined;
      if (
        typeof patch.scheduledEndsAt === "string" &&
        effectiveStart &&
        new Date(patch.scheduledEndsAt) <= new Date(effectiveStart)
      ) {
        delete patch.scheduledEndsAt;
      }
      const mergedState = await updateGoalState(
        scope.db,
        scope.tenantId,
        activeGoal.id,
        activeGoal.state,
        patch,
      );
      activeGoal = { ...activeGoal, state: mergedState };

      const nextAction = computeNextBestAction(activeGoal.type, activeGoal.state);
      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "agent_goal",
        entityId: activeGoal.id,
        action: AI_GOAL_EVENTS.NEXT_ACTION_SELECTED,
        metadata: {
          action: nextAction.action,
          missingKey: nextAction.action === "ASK_USER" ? nextAction.missingKey : undefined,
        },
      });

      const knownEntries = Object.entries(activeGoal.state);
      const knownSummary =
        knownEntries.length > 0
          ? knownEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")
          : "nenhum ainda";
      const goalToolName = GOAL_MUTATION_TOOL[activeGoal.type];
      if (nextAction.action === "ASK_USER") {
        const hint = nextAction.hint ? ` (${nextAction.hint})` : "";
        queryText += `\n\n[Contexto do objetivo em andamento (${activeGoal.type}): dados já conhecidos: ${knownSummary}. Ainda falta: ${nextAction.label}${hint}. NÃO peça de novo os dados já conhecidos acima.]`;
        // Structural guard, not just a prompt instruction — live-verified
        // that telling the model "don't call this tool yet" in text
        // alone did NOT work (gpt-4o-mini repeatedly called
        // create_transport_request with incomplete/hallucinated args
        // anyway, same class of unreliability this session's Wave 2 of
        // Agent Runtime v2 already found and fixed structurally for the
        // tool catalog in general). Physically removing the goal's own
        // mutation tool from what's offered this turn makes it
        // impossible to call, not just discouraged.
        availableMutationTools = availableMutationTools.filter((t) => t.name !== goalToolName);
        mutationToolNames.delete(goalToolName);
        if (nextAction.searchTool) {
          forcedToolName = nextAction.searchTool;
          pendingOfferedField = nextAction.missingKey;
        }
      } else if (nextAction.action === "EXECUTE") {
        queryText += `\n\n[Contexto do objetivo em andamento (${activeGoal.type}): todos os dados obrigatórios já estão disponíveis (${knownSummary}). Chame agora a ferramenta "${nextAction.toolName}" com esses dados — não pergunte de novo, não peça confirmação em texto.]`;
        // Same structural approach in the other direction: force the
        // exact tool via the existing Wave 2 v2 tool_choice mechanism
        // (see the guard further down that keeps this from being
        // overwritten by the general Intent Router's own forcing).
        forcedToolName = goalToolName;
      }
    }
  }

  // Agent Runtime Architecture v2, Wave 2 — Intent Router + Capability
  // Router + Dynamic Tool Filter (spec sections 8-11), behind a feature
  // flag (spec section 52's AGENT_DYNAMIC_TOOL_ROUTING) so this never
  // changes behavior for a tenant that hasn't opted in. When on, the tool
  // catalog sent to the model is narrowed BEFORE turn 1 based on the
  // classified {domain, intent} — this never replaces the IAM filter
  // above (spec section 13), it only runs after it.
  const dynamicRoutingEnabled = await isFeatureEnabled(scope, "agent.dynamic_tool_routing");
  let routedToolDefinitions: OpenAiToolDefinition[] | null = null;
  // Wave 4 -- Model Router. Stays undefined (gateway's bare default,
  // unchanged behavior) unless dynamic routing is on AND actually
  // computes a tier below from the real filter outcome.
  let agentModel: string | undefined;
  if (dynamicRoutingEnabled) {
    const classification = await classifyIntent(
      scope.db,
      { workspaceId: ctx.workspaceId, tenantId: ctx.tenantId, userId: ctx.userId },
      queryText,
    );
    totalCreditsConsumed += classification.creditsConsumed ?? 0;
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "ai_agent",
      entityId: requestId,
      action: AI_AGENT_EVENTS.INTENT_CLASSIFIED,
      metadata: {
        domain: classification.domain,
        intent: classification.intent,
        confidence: classification.confidence,
        method: classification.method,
      },
    });

    const combined = [
      ...availableTools.map((t) => ({ ...t, def: registry.toDefinitions([t])[0] })),
      ...availableMutationTools.map((t) => ({ ...t, def: mutationRegistry.toDefinitions([t])[0] })),
    ];
    const filterResult = filterToolsByIntent(combined, classification, DISCOVERY_TOOL_NAMES);
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "ai_agent",
      entityId: requestId,
      action: AI_AGENT_EVENTS.TOOLS_FILTERED,
      metadata: {
        candidatesBeforeFilter: filterResult.candidatesBeforeFilter,
        candidatesAfterFilter: filterResult.candidatesAfterFilter,
        forced: filterResult.forced,
        // Wave 6 — the real narrowing/fallback signal (Wave 4 found the
        // raw candidate counts alone are NOT a reliable proxy for this),
        // needed so observability.ts can report a true fallback rate
        // instead of re-deriving (and re-risking) the same bug.
        isFallback: filterResult.isFallback,
      },
    });

    routedToolDefinitions = filterResult.candidates.map((c) => c.def);
    // Guarded so the goal orchestrator's own forcing (set earlier, above)
    // always wins — a goal in progress must never be pre-empted by the
    // general classifier forcing some OTHER tool mid-flow.
    if (filterResult.forced && !forcedToolName) forcedToolName = filterResult.forcedToolName;

    const agentTier = resolveAgentModelTier(filterResult);
    agentModel = resolveModelForTier(agentTier);
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "ai_agent",
      entityId: requestId,
      action: AI_AGENT_EVENTS.MODEL_ROUTED,
      metadata: { tier: agentTier, model: agentModel },
    });
  }

  let allToolDefinitions = routedToolDefinitions ?? [
    ...registry.toDefinitions(availableTools),
    ...mutationRegistry.toDefinitions(availableMutationTools),
  ];
  // Agent Runtime v3, Wave 2 — safety net: forcedToolName may have been
  // set by the goal orchestrator (above) BEFORE the Capability Router
  // narrowed the catalog for its own, unrelated classification of this
  // turn's text. If that narrowing didn't happen to include the goal's
  // tool, tool_choice would reference a function absent from `tools` —
  // an OpenAI API error, not a graceful fallback. Make sure the forced
  // tool's definition is always present, regardless of what the general
  // classifier decided.
  if (forcedToolName && !allToolDefinitions.some((t) => t.function.name === forcedToolName)) {
    const forcedMutationTool = availableMutationTools.find((t) => t.name === forcedToolName);
    const forcedReadTool = availableTools.find((t) => t.name === forcedToolName);
    if (forcedMutationTool) {
      allToolDefinitions = [
        ...allToolDefinitions,
        mutationRegistry.toDefinitions([forcedMutationTool])[0],
      ];
    } else if (forcedReadTool) {
      allToolDefinitions = [...allToolDefinitions, registry.toDefinitions([forcedReadTool])[0]];
    }
  }
  // Recomputed per turn below, dropping DISCOVERY_TOOL_NAMES once their
  // budget is spent — a live-verified stronger guarantee than telling the
  // model "stop calling this" via a tool result: gpt-4o-mini kept calling
  // list_available_tools again anyway after that correction (up to 5x in a
  // row, live-verified), but it can't call a function that isn't in the
  // schema it was given for that turn.
  const nonDiscoveryToolDefinitions = allToolDefinitions.filter(
    (t) => !DISCOVERY_TOOL_NAMES.has(t.function.name),
  );

  const userContent: OpenAiMessage["content"] = imageParts.length
    ? [{ type: "text", text: queryText }, ...imageParts]
    : queryText;
  const messages: OpenAiMessage[] = [{ role: "user", content: userContent }];
  const toolsUsed: string[] = [];
  const pendingActionPlans: ProposedPlan[] = [];
  let discoveryCallCount = 0;
  // Backstop against a model latching onto one tool and calling it with the
  // IDENTICAL name+args repeatedly (live-verified with gpt-4o-mini: get_deep_link
  // with the same args 5x in a row after list_available_tools's own budget
  // ran out) — a repeat can't produce new information, so there's no reason
  // to let the turn budget keep burning on it.
  const seenCalls = new Set<string>();
  let hitDuplicateCall = false;

  try {
    for (let turn = 0; turn < MAX_TURNS && !hitDuplicateCall; turn++) {
      const turnToolDefinitions =
        discoveryCallCount >= MAX_DISCOVERY_CALLS
          ? nonDiscoveryToolDefinitions
          : allToolDefinitions;
      const result = await runAiGateway({
        db: scope.db,
        adminDb: scope.db,
        ctx: { workspaceId: ctx.workspaceId, tenantId: ctx.tenantId, userId: ctx.userId },
        operation: "agent_query",
        capability: "text",
        entityType: "ai_agent",
        system: SYSTEM_PROMPT,
        messages,
        tools: turnToolDefinitions.length ? turnToolDefinitions : undefined,
        // Forced tool_choice (spec section 12) only on the very first turn —
        // once that call either executes or gets denied, later turns go
        // back to "auto" so the model can still respond in text or chain a
        // different tool (e.g. a follow-up search) without being stuck.
        toolChoice: turn === 0 && forcedToolName ? { name: forcedToolName } : undefined,
        model: agentModel,
        credentialMode: "shina_only",
      });
      totalCreditsConsumed += result.creditsConsumed ?? 0;

      // The presence of toolUses is the authoritative signal, not the
      // stopReason string — live-verified (Wave 2, forced tool_choice):
      // OpenAI returns finish_reason "stop", not "tool_calls", when
      // tool_choice forces a specific function, even though the tool call
      // itself is populated. Checking stopReason first silently discarded
      // a real, forced create_organization call and returned an empty
      // response instead.
      if (result.toolUses.length === 0) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: requestId,
          action: AI_AGENT_EVENTS.RESPONSE,
          metadata: { toolsUsed, creditsConsumed: totalCreditsConsumed },
        });
        return NextResponse.json({
          data: {
            text: result.text,
            toolsUsed,
            creditsConsumed: totalCreditsConsumed,
            pendingActionPlans: pendingActionPlans.length ? pendingActionPlans : undefined,
          },
        });
      }

      messages.push({
        role: "assistant",
        content: result.text || null,
        tool_calls: result.toolUses.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.name, arguments: JSON.stringify(t.input) },
        })),
      });

      for (const toolUse of result.toolUses) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: requestId,
          action: AI_AGENT_EVENTS.TOOL_REQUESTED,
          metadata: { tool: toolUse.name, input: toolUse.input },
        });

        const callKey = `${toolUse.name}::${JSON.stringify(toolUse.input)}`;
        if (seenCalls.has(callKey)) {
          hitDuplicateCall = true;
          toolsUsed.push(toolUse.name);
          messages.push({
            role: "tool",
            tool_call_id: toolUse.id,
            content: JSON.stringify({
              error: "Chamada idêntica já feita nesta conversa — repetir não muda o resultado.",
            }),
          });
          continue;
        }
        seenCalls.add(callKey);

        if (DISCOVERY_TOOL_NAMES.has(toolUse.name)) {
          discoveryCallCount += 1;
          if (discoveryCallCount > MAX_DISCOVERY_CALLS) {
            toolsUsed.push(toolUse.name);
            messages.push({
              role: "tool",
              tool_call_id: toolUse.id,
              content: JSON.stringify({
                error:
                  "Chamada de exploração/ajuda já usada nesta conversa. Pare de explorar: chame agora, pelo nome exato, a ferramenta de dados ou ação que atende ao pedido do usuário — ou, se realmente não existir nenhuma aplicável, responda em texto explicando isso.",
              }),
            });
            continue;
          }
        }

        if (mutationToolNames.has(toolUse.name)) {
          const proposal = await mutationRegistry.propose(
            toolUse.name,
            toolUse.input,
            ctx,
            scope,
            availableMutationTools,
            conversationId ?? undefined,
            activeGoal?.id,
          );
          toolsUsed.push(toolUse.name);

          void logActivity(scope.db, {
            tenantId: scope.tenantId,
            actorId: scope.userId,
            entityType: "ai_agent",
            entityId: requestId,
            action: proposal.ok ? AI_ACTION_EVENTS.PROPOSED : AI_ACTION_EVENTS.DENIED,
            metadata: { tool: toolUse.name },
          });

          if (proposal.ok) pendingActionPlans.push(proposal.plan);
          messages.push({
            role: "tool",
            tool_call_id: toolUse.id,
            content: JSON.stringify(
              proposal.ok
                ? {
                    status: "pending_confirmation",
                    planId: proposal.plan.id,
                    summary: proposal.plan.summary,
                    alreadyPending: proposal.plan.isDuplicate ?? false,
                  }
                : { error: proposal.error },
            ),
          });
          continue;
        }

        const toolResult = await registry.execute(
          toolUse.name,
          toolUse.input,
          ctx,
          scope,
          availableTools,
        );
        toolsUsed.push(toolUse.name);

        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: requestId,
          action: toolResult.ok ? AI_AGENT_EVENTS.TOOL_EXECUTED : AI_AGENT_EVENTS.TOOL_DENIED,
          metadata: { tool: toolUse.name },
        });

        // Agent Runtime v3, Wave 3 — the OTHER half of the offered-option
        // selection mechanism (see the resolution hook earlier in this
        // file): this turn forced exactly this search tool for a goal's
        // still-missing field, so its real results become next turn's
        // candidate list, never invented. Only real {id, name} rows are
        // kept — a malformed/empty result just means no offer is stored,
        // which is safe (the next turn's resolver treats that as NONE).
        if (
          activeGoal &&
          pendingOfferedField &&
          toolUse.name === forcedToolName &&
          toolResult.ok &&
          Array.isArray(toolResult.data)
        ) {
          const offered: OfferedOption[] = (toolResult.data as { id?: unknown; name?: unknown }[])
            .filter((row) => typeof row.id === "string" && typeof row.name === "string")
            .map((row) => ({ id: row.id as string, name: row.name as string }));
          if (offered.length > 0) {
            const mergedState = await updateGoalState(
              scope.db,
              scope.tenantId,
              activeGoal.id,
              activeGoal.state,
              { __offeredAssets: offered, __offeredAssetsField: pendingOfferedField },
            );
            activeGoal = { ...activeGoal, state: mergedState };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolUse.id,
          content: JSON.stringify(toolResult.ok ? toolResult.data : { error: toolResult.error }),
        });
      }
    }

    // Graceful degradation, not a raw error: the model got stuck (ran out of
    // turns, or latched onto one tool call repeatedly) before ever reaching
    // a real answer or action. A 200 with an honest text response renders as
    // a normal assistant message in the drawer, not an error toast — and it
    // tells the user exactly what to do next instead of a technical message.
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "ai_agent",
      entityId: requestId,
      action: AI_AGENT_EVENTS.RESPONSE,
      metadata: { toolsUsed, creditsConsumed: totalCreditsConsumed, degraded: true },
    });
    return NextResponse.json({
      data: {
        text: "Não consegui concluir isso automaticamente. Pode me dizer diretamente os dados (nome, documento, cidade, estado e o que mais for pedido) em texto, em vez de só no anexo?",
        toolsUsed,
        creditsConsumed: totalCreditsConsumed,
      },
    });
  } catch (e) {
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "ai_agent",
      entityId: requestId,
      action: AI_AGENT_EVENTS.TOOL_FAILED,
      metadata: { error: e instanceof Error ? e.message : String(e) },
    });
    if (e instanceof AiPolicyError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: e.message, code: "insufficient_credits" }, { status: 402 });
    }
    if (e instanceof DuplicateRequestError) {
      return NextResponse.json({ error: e.message, code: "duplicate_request" }, { status: 409 });
    }
    if (e instanceof OpenAIProviderError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
