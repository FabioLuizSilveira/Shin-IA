# Shinã MKT — AI Provider Strategy (SHINA / BYOK / HYBRID)

**Data:** 2026-08-21. Substitui a antiga posição "BYOK only" documentada em `anthropic.ts`'s
comentário original ("Platform-level key for now; per-workspace BYOK arrives in M-MKT-11") pela
posição real do produto agora: **"Traga sua IA. Ou comece agora com a nossa."**

---

## Os três modos

| Modo     | Quem paga o provider                                         | Quando usar                                            |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `SHINA`  | Shinã (créditos do workspace)                                | Onboarding rápido, sem conta técnica                   |
| `BYOK`   | O workspace, direto ao provider                              | Já tem conta própria, quer controle total de custo     |
| `HYBRID` | Depende da política (`preferredSource`/`allowShinaFallback`) | Prefere BYOK mas quer um fallback opcional e explícito |

O modo é resolvido em `apps/mkt/src/lib/ai/policy.ts`'s `resolveAiPolicy()`: override do
workspace (tabela `mkt_ai_policy`) **limitado** pelo plano (`plan_versions.usage_limits` —
`byokAllowed`/`hybridAllowed`, o mesmo jsonb genérico que outros limites de plano já usam, sem
tabela/contrato novo por provider). Ausência de override = `BYOK`, nunca `SHINA` — nenhum workspace
começa a gastar crédito Shinã sem ter escolhido isso.

## Arquitetura reaproveitada (não paralela)

- **`@shina/ai-platform`'s `ModelProvider`/`ModelProviderRegistry`** — reaproveitado de verdade
  para a capability `text`: `apps/mkt/src/lib/ai/anthropic-provider.ts` implementa `ModelProvider`
  delegando para o `generateText()` já existente (não duplica a chamada fetch). Extensão aditiva
  em `packages/ai-platform/src/types.ts`: `ModelRequest.credentials?: { apiKey }` — opcional,
  não quebra o agent-runtime original (que registra um provider por processo com uma credencial
  fixa); o gateway do MKT passa uma credencial por request, resolvida por workspace.
  **Gap real, não contornado**: `ModelMessage.content` é só texto — a capability `vision`
  (clone de anúncio) não tem representação sem perda nesse formato, então `/api/clone` chama
  `analyzeImage()` diretamente pelo gateway, fora do `ModelProviderRegistry`. Documentado aqui,
  não escondido.
- **`@shina/commercial-platform`'s `plan_versions.usage_limits`** — mesma coluna jsonb genérica
  já usada por outros limites de plano; nenhum contrato/tabela por provider foi criado.
- **`mkt_ai_providers`** (existente desde M-MKT-11) — continua sendo o armazenamento BYOK
  (criptografado, por workspace); só ganhou `last_validated_at`/`updated_at`.
- **`mkt_ai_usage`** (existente desde a fundação do MKT) — continua sendo a tabela de metering;
  só ganhou colunas (`credential_source`, `billing_source`, `credits_consumed`,
  `estimated_cost_usd`, `idempotency_key`).
- **Novo, porque não existia nada equivalente**: `mkt_ai_policy` (política por workspace),
  `mkt_ai_credit_balances` + `mkt_ai_credits` (ledger append-only + saldo materializado,
  atualizados atomicamente pela função `mkt_apply_ai_credit_event()`), `mkt_model_cost_policy`
  (conversão custo real → créditos, nunca exposta ao cliente — RLS sem nenhuma policy para
  `authenticated`/`anon`).

## Segurança da credencial Shinã

`ANTHROPIC_API_KEY` só é lida em `apps/mkt/src/lib/ai/gateway.ts` (server-side, dentro de uma
Route Handler), nunca serializada numa resposta, nunca passada a um client component, nunca
presente em `NEXT_PUBLIC_*`. Nenhum bundle de browser/mobile a referencia.

## Segurança da credencial BYOK

Inalterado do M-MKT-11 (`mkt_ai_providers`): criptografada em repouso (`encryptSecret`/
`decryptSecret`, `MKT_ENCRYPTION_KEY`), nunca devolvida em plaintext pela API (`GET
/api/ai-providers` retorna `has_key: boolean`, nunca `api_key_enc`), isolada por
`workspace_id`/RLS. Novo nesta rodada: `POST /api/ai-providers/test` valida a chave com uma
chamada real mínima, sem nunca repassar o corpo de erro bruto do provider ao cliente, com
rate-limit de 10s e uma linha em `mkt_audit_trail`.

## Fluxo do gateway (`runAiGateway()`)

```
Route handler (/api/generate, /api/clone, /api/strategy)
  -> runAiGateway({ ctx, operation, capability, system, prompt, idempotencyKey })
       -> idempotency check (mkt_ai_usage.idempotency_key único por workspace)
       -> resolveAiPolicy() + resolveAnthropicKey() -> decideCredentialSource()
       -> [se SHINA_CREDITS] pré-checagem de saldo (estimateMaxCredits, leitura, sem gastar)
       -> chamada ao provider (ModelProviderRegistry para texto; analyzeImage() para visão)
       -> [se SHINA_CREDITS] custo real -> créditos (mkt_model_cost_policy) -> consumeCredits()
       -> insert em mkt_ai_usage (credential_source, billing_source, credits_consumed, ...)
```

`decideCredentialSource()` é pura e testada em `gateway.test.ts` (11 casos: os 3 modos × chave
presente/ausente × política de fallback). A garantia central do item 8 do spec — **HYBRID nunca
cai pro Shinã silenciosamente** — é o que esses testes verificam.

## O que NÃO foi implementado nesta rodada (limitações reais, não escondidas)

- **Fallback em runtime** (BYOK configurado mas a chamada falha por 401/429/billing) não troca
  para Shinã no meio da requisição, mesmo com `allowShinaFallback: true` — esse flag só governa a
  ausência de credencial na resolução inicial. Fallback por falha em tempo de execução exigiria
  reconstruir a chamada com outra credencial e outra estimativa de custo — não implementado, para
  não introduzir cobrança inesperada por um caminho parcialmente testado.
- **Idempotência de conteúdo**: o guard atual impede **cobrar duas vezes** o mesmo
  `idempotency_key` (rejeita com 409), mas não devolve a resposta original em cache — por design
  (`mkt_ai_usage` nunca guarda prompt/output completo, item 20: privacidade primeiro). Nenhuma das
  3 rotas hoje envia `x-idempotency-key` (o header é aceito mas opcional) — a UI ainda não gera um
  ID estável por tentativa.
- **Reserva de crédito pré-chamada**: a pré-checagem de saldo é uma leitura, não uma reserva —
  numa corrida rara entre duas chamadas simultâneas do mesmo workspace, ambas podem passar na
  pré-checagem e uma delas falhar ao debitar de verdade (capturado, logado, não lança erro pro
  usuário que já recebeu sua resposta). Aceitável para volume atual; um sistema de reserva
  duas-fases é over-engineering sem evidência de abuso real ainda.
- **Onboarding visual** ("Como você quer usar IA?", item 14) e a página de Settings → IA e
  Modelos (item 15/16/17) **não foram construídos** nesta rodada — o backend (`GET`/`PATCH
/api/ai-policy`, `GET`/`POST`/`DELETE /api/ai-providers`, `POST /api/ai-providers/test`) está
  pronto para uma UI consumir, mas nenhuma tela nova foi criada. `ANTHROPIC_API_KEY` continua
  sendo pedida apenas como variável de ambiente server-side, nunca no onboarding do usuário.
- **Multi-provider real**: `mkt_ai_providers`/`mkt_ai_policy` já modelam qualquer provider (o
  `check` constraint já lista openai/gemini/deepseek/mistral/groq/openrouter/ollama), mas o
  gateway (`PROVIDER = "anthropic"` fixo em `gateway.ts`) só tem implementação real para Anthropic
  — os outros ficam "conectáveis" na tabela mas sem cliente de chamada. Não inventado suporte
  falso (item 3).
- **Preço comercial**: nenhum `plan_versions.usage_limits.monthlyAiCredits` foi definido em
  nenhum plano real (Starter/Pro/Business seguem sem crédito Shinã concedido — modo efetivo
  permanece `BYOK` para todos até um humano decidir os números). `mkt_model_cost_policy`'s
  `credit_multiplier: 1000` é um placeholder técnico (1 crédito ≈ US$0,001, usando o preço real
  de lista da Anthropic como `cost_basis`) — não é uma decisão comercial, só a estrutura para
  receber uma depois (item 26).

## Migração dos workspaces existentes

`supabase/migrations/20260094000000_mkt_ai_gateway.sql` inseriu `mkt_ai_policy(mode='BYOK')`
para todo workspace com uma chave BYOK ativa já configurada — nenhum workspace existente muda de
comportamento. Workspaces sem nenhuma configuração continuam resolvendo para `BYOK` por padrão
(não `SHINA`), então nenhum deles passa a consumir a chave/crédito Shinã sem uma ação explícita.
