# Asset Intelligence — arquitetura conceitual (não implementada nesta rodada)

Este documento registra a arquitetura pretendida para a camada de IA sobre dados de manutenção
(Health Score, Anomaly Detection, Recommendations, Predictive Risk, AI Copilot, Maintenance
Auditor) — nenhuma dessas camadas foi construída na rodada que entregou o P0 do
`docs/modules/MAINTENANCE.md`. Existe pra não perder o desenho quando alguém retomar isso.

## Por que não foi construído agora

O próprio pedido que originou o módulo Manutenção instrui explicitamente: "Não bloquear P0
esperando IA avançada." O P0 (ordens, itens, planos preventivos, histórico, custos, analytics,
permissões, isolamento de tenant) foi priorizado e entregue sozinho; ver o relatório final da
sessão para o status real de cada peça.

## Pipeline conceitual

```
Maintenance Data + Asset Data + Contracts + Tracking + Inspections + Infractions + Operations
        ↓
Asset Intelligence Engine
        ↓
Scores · Anomalies · Recommendations · Predictions · AI Copilot
```

## Decisões de arquitetura já tomadas (pra quando isso for construído)

1. **Health Score é determinístico, não um LLM** — escala 0–100, versionado (`policyVersion`),
   com `reasons[]` explicando o número. Nunca usar LLM pra matemática determinística (regra
   explícita do pedido original).
2. **Anomaly Detection começa em regras + estatística simples** — comparação contra baseline
   histórico do próprio tenant/ativo, nunca um modelo caixa-preta na primeira versão.
3. **Recommendations reaproveita o conceito de transição controlada** (mesmo house pattern de
   `canTransitionOrder`) — nunca executa ação crítica sozinha; sempre `accept`/`dismiss`/`create
maintenance order` como decisão humana.
4. **Predictive Risk é estimativa, nunca certeza** — todo campo se chama `RiskScore`/`riskLevel`,
   nunca "failure probability" apresentado como fato. Baseado em regra/distribuição histórica
   antes de qualquer modelo de ML real.
5. **Document AI**: upload → extração → rascunho estruturado → confirmação humana → registro.
   `maintenance_documents` já tem `extraction_confidence`/`extraction_model`/`extracted_at`
   reservados (colunas existem, nada as escreve ainda) — nenhuma segunda migration será
   necessária só pra isso.
6. **AI Copilot nunca gera SQL livre contra produção.** Arquitetura obrigatória: usuário → camada
   de query IA → permissão + tenant scope → tools/query functions aprovadas e pré-definidas →
   dado estruturado → LLM só explica o que já veio filtrado. Reaproveitar `packages/ai-platform`
   (hoje "deliberadamente adiado", sem integração — este seria o primeiro gatilho de produto real
   pra tirá-lo do estado adiado, conforme o próprio CLAUDE.md permite quando há necessidade
   concreta).
7. **Maintenance Auditor** roda como um serviço/agente periódico (mesmo padrão de cron já usado
   por `infraction-deadlines`/`infraction-unmatched-sweep` — `Authorization: Bearer $CRON_SECRET`,
   registrado em `vercel.json`), nunca como parte do request path do usuário.

## Pré-condição para começar

O volume real de dados de manutenção (ordens, itens, planos) precisa existir antes de qualquer
score/anomalia fazer sentido — um baseline histórico vazio não produz um score confiável, só uma
falsa precisão. Recomendação: revisitar depois que o P0 estiver em uso real por pelo menos um
ciclo de manutenção completo em produção.
