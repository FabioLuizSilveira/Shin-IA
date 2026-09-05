import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { buildAgentContext } from "@/lib/ai/agent-context";
import { buildAgentToolRegistry } from "@/lib/ai/tools";
import { buildMutationToolRegistry } from "@/lib/ai/actions/tools";
import type { ProposedPlan } from "@/lib/ai/actions/mutation-registry";
import { AI_AGENT_EVENTS, AI_ACTION_EVENTS } from "@/lib/ai/audit-events";
import {
  runAiGateway,
  AiPolicyError,
  InsufficientCreditsError,
  DuplicateRequestError,
  OpenAIProviderError,
  type OpenAiMessage,
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
- Responda em português do Brasil, de forma direta e objetiva.`;

// Raised from 4 to 6 (2026-09-05): with 30+ tools now registered across
// Waves 3-7, a query needing 2 chained calls (e.g. resolve an asset name
// via list_assets, then call get_asset_health_score with its id) started
// hitting the old cap under gpt-4o-mini — a real tool-selection/chaining
// limitation, not something this constant alone fixes, but it buys enough
// room for the common 2-3 step case to converge instead of hard-failing.
const MAX_TURNS = 6;

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
  };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
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
  const availableMutationTools = await mutationRegistry.listAvailable(scope, ctx);
  const toolDefinitions = [
    ...registry.toDefinitions(availableTools),
    ...mutationRegistry.toDefinitions(availableMutationTools),
  ];
  const mutationToolNames = new Set(availableMutationTools.map((t) => t.name));

  const messages: OpenAiMessage[] = [{ role: "user", content: body.query.trim() }];
  const toolsUsed: string[] = [];
  const pendingActionPlans: ProposedPlan[] = [];
  let totalCreditsConsumed = 0;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const result = await runAiGateway({
        db: scope.db,
        adminDb: scope.db,
        ctx: { workspaceId: ctx.workspaceId, tenantId: ctx.tenantId, userId: ctx.userId },
        operation: "agent_query",
        capability: "text",
        entityType: "ai_agent",
        system: SYSTEM_PROMPT,
        messages,
        tools: toolDefinitions.length ? toolDefinitions : undefined,
        credentialMode: "shina_only",
      });
      totalCreditsConsumed += result.creditsConsumed ?? 0;

      if (result.stopReason !== "tool_calls" || result.toolUses.length === 0) {
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

        if (mutationToolNames.has(toolUse.name)) {
          const proposal = await mutationRegistry.propose(
            toolUse.name,
            toolUse.input,
            ctx,
            scope,
            availableMutationTools,
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

        messages.push({
          role: "tool",
          tool_call_id: toolUse.id,
          content: JSON.stringify(toolResult.ok ? toolResult.data : { error: toolResult.error }),
        });
      }
    }

    return NextResponse.json(
      { error: "Shinã excedeu o número máximo de turnos de ferramentas" },
      { status: 502 },
    );
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
