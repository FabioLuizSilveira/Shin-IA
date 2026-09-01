# Módulo Manutenção (P0)

Manutenção nativa da Shinã, reaproveitando tenancy/IAM/domínio existentes — nenhum sistema
paralelo. Ver `docs/architecture/ASSET_INTELLIGENCE.md` para a camada de IA (P1/P2, não
construída nesta rodada).

## Auditoria (Etapa 1) — o que já existia e foi reaproveitado

- **Asset**: `assets` já tinha `tenant_id/branch_id/asset_type_id/category/status/metadata`.
  Ganhou `odometer`/`hour_meter` como colunas reais (nullable, genéricas — nunca "km", pra caber
  em qualquer `asset_category`, mesmo precedente de `plate`/`renavam` no Infractions Engine).
- **Supplier**: `organizations` já tem `type = 'supplier'` — nenhuma entidade nova.
  `maintenance_orders.supplier_id` referencia `organizations` diretamente.
- **Contrato/Cliente/Operador**: `contracts`, `rental_customers`, `operators` reaproveitados como
  FK direta, sem duplicar nada.
- **Rule Engine / Workflow Engine**: confirmados mortos/arquivados neste repo (removidos, não só
  "sem uso") — todo estado/transição usa o mesmo mapa plano já usado em
  `operation-transitions.ts`/`inspection-engine`/`infractions-engine`/`crm-engine`.
- **Storage**: bucket privado novo `maintenance-documents`, mesmo padrão de
  `inspection-media`/`contract-documents`/`infraction-documents`.
- **IAM**: `tenant.maintenance.*` seguindo o padrão real de `hasTenantPermission()` — nenhuma
  permission key nova inventada fora desse padrão.
- **AI Platform**: `packages/ai-platform` confirmado "deliberadamente adiado" (CLAUDE.md) — não
  usado nesta rodada (P0 não depende de IA, per instrução explícita do spec).

## Schema (Etapa 2)

`supabase/migrations/20260112000000_maintenance.sql`: `maintenance_orders`,
`maintenance_items`, `maintenance_plans`, `maintenance_documents` + `assets.odometer`/`hour_meter`.
RLS idioma 2 (select-only via JWT `tenant_id`, escrita só via rota + `hasTenantPermission()`).
`total_cost_cents` é uma coluna gerada (`labor + parts + other`) — nunca calculada em dois lugares
que podem discordar.

## Pacote `packages/maintenance-engine`

Lógica pura, sem `SupabaseClient`: `transitions.ts` (`canTransitionOrder`, mesmo mapa-plano de
sempre), `cost.ts` (soma/custo-por-unidade/downtime, nunca divide por zero, nunca inventa dado
ausente), `preventive.ts` (`resolvePlanDue` — "o que ocorrer primeiro" entre data/km/horímetro,
**nunca inventa uma baseline** quando `lastTriggered*` está ausente, mesma disciplina do
`resolveDeadline()` do Infractions Engine). 26 testes, 100% dos casos de borda do spec
(reincidência de baseline ausente, gatilho combinado, plano inativo excluído).

## API (Etapa 17)

- `GET/POST /api/maintenance` — lista (filtros: asset/status/type/contract/supplier/período) e
  criação.
- `GET/PATCH /api/maintenance/:id` — detalhe + transição de status (422 real numa transição
  inválida, nunca um no-op silencioso — a mesma classe de bug que a rodada do Infractions Engine
  encontrou e corrigiu ao vivo).
- `POST /api/maintenance/:id/items` — item executado.
- `GET /api/assets/:id/maintenance` — histórico consolidado do ativo (Etapa 3): custos,
  preventiva/corretiva, reincidência de componente, custo/km, custo/hora, sem N+1.
- `GET/POST /api/maintenance/plans` — planos preventivos, já retornando `resolvePlanDue()` por
  plano (não faz o front recalcular).
- `GET /api/maintenance/analytics` — KPIs (Etapa 4): custo total, preventiva×corretiva,
  downtime/MTTR, MTBF (proxy — só quando o ativo tem 2+ eventos corretivos, nunca 1 ponto
  virando estatística), custo por fornecedor/contrato/asset type. **Rota dedicada, não forçada
  dentro de `packages/reporting-engine`'s `KpiType`** — aquele union alimenta os 7 cards fixos do
  dashboard geral; o conjunto de KPIs de manutenção é largo demais e específico demais pra caber
  ali sem distorcer o propósito daquele pacote (decisão documentada, não esquecimento).

Etapa 9 (Vistoria → Manutenção): `POST /api/maintenance` já aceita `sourceType`/`sourceId`
diretamente — uma tela que parte de uma `InspectionFinding` só precisa pré-preencher esses dois
campos, nenhuma rota de conversão dedicada foi necessária.

## UI (Etapa 19, parcial)

`tenant/maintenance` (lista com filtros de status, criação) + `MaintenanceOrderDetail` (drawer:
info, avançar status, editar custos, itens executados). Item novo "Manutenção" na sidebar.

**Não construído nesta rodada** (UI, não estava no P0 explícito da priorização do spec):
`/maintenance/plans`, `/maintenance/analytics`, `/maintenance/insights` como telas próprias, e a
aba "Manutenção" dentro de `assets/:id` — os endpoints que essas telas consumiriam já existem e
foram verificados via API, só falta a tela.

## Segurança

Testado ao vivo contra produção: Tenant A não enxerga nem edita ordens de manutenção do Tenant B
— ver relatório final. Isolamento de cliente/operador não se aplica ainda porque nenhuma rota
deste módulo é exposta a essas personas nesta rodada (só staff via `requireTenantScope()`).

## O que é P1/P2 — não construído, documentado, não escondido

Health Score, Anomaly Detection, Recommendations, Document AI, AI Copilot, Maintenance Auditor,
Shinã Insights, Predictive Risk, Asset Economics/TCO — nenhum construído. O spec do próprio
pedido instrui explicitamente "não bloquear P0 esperando IA avançada"; o schema (`source_type`/
`source_id`, colunas de `extraction_confidence`/`extraction_model` já em
`maintenance_documents`) já deixa espaço pra essas camadas entrarem sem uma segunda migration.
