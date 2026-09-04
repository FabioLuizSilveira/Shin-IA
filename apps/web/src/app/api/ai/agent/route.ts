import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { buildAgentContext } from "@/lib/ai/agent-context";
import { buildAgentToolRegistry } from "@/lib/ai/tools";
import { AI_AGENT_EVENTS } from "@/lib/ai/audit-events";
import {
  runAiGateway,
  AiPolicyError,
  InsufficientCreditsError,
  DuplicateRequestError,
  AIProviderError,
} from "@shina/ai-gateway";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Você é a Shinã, a assistente operacional da plataforma Shinã.

REGRAS OBRIGATÓRIAS:
- Você só pode obter informações através das ferramentas (tools) fornecidas. Nunca invente dados, nunca acesse ou mencione acessar o banco de dados diretamente, nunca gere SQL.
- Toda afirmação sobre dados reais deve vir literalmente do resultado de uma ferramenta chamada nesta conversa.
- Se as ferramentas disponíveis não derem informação suficiente para responder, diga isso claramente em vez de adivinhar.
- Você nunca decide ou executa uma ação real (aprovar, cancelar, assinar, etc.) — nesta fase você só consulta e explica; qualquer ação real é feita por um humano na interface do Shinã.
- Você só sabe o que este usuário pode saber e só faz o que este usuário pode fazer — nunca mencione ou tente acessar dados de outro tenant.
- Responda em português do Brasil, de forma direta e objetiva.`;

const MAX_TURNS = 4;

interface AnthropicContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  tool_use_id?: string;
  content?: string;
}

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
  const toolDefinitions = registry.toDefinitions(availableTools);

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: body.query.trim() },
  ];
  const toolsUsed: string[] = [];
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

      if (result.stopReason !== "tool_use" || result.toolUses.length === 0) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: requestId,
          action: AI_AGENT_EVENTS.RESPONSE,
          metadata: { toolsUsed, creditsConsumed: totalCreditsConsumed },
        });
        return NextResponse.json({
          data: { text: result.text, toolsUsed, creditsConsumed: totalCreditsConsumed },
        });
      }

      const assistantContent: AnthropicContentBlock[] = result.toolUses.map((t) => ({
        type: "tool_use",
        id: t.id,
        name: t.name,
        input: t.input,
      }));
      if (result.text) assistantContent.unshift({ type: "text", text: result.text });
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: AnthropicContentBlock[] = [];
      for (const toolUse of result.toolUses) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "ai_agent",
          entityId: requestId,
          action: AI_AGENT_EVENTS.TOOL_REQUESTED,
          metadata: { tool: toolUse.name, input: toolUse.input },
        });

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

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult.ok ? toolResult.data : { error: toolResult.error }),
        });
      }
      messages.push({ role: "user", content: toolResults });
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
    if (e instanceof AIProviderError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
