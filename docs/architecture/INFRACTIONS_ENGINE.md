# Shinã Infractions Engine — Gestão de Infrações, Responsabilidade e Multas

**Status (2026-08-27): Fases A–H entregues e no ar em produção. Fase I (CSV real +
`docs/integrations/SENATRAN_INFRACTIONS.md`) e Fase J (isolamento permanente/E2E de segurança)
ainda não começadas — ver "Pendências" no fim deste documento.**

Log corrido do módulo, no mesmo padrão de `docs/architecture/INSPECTION_ENGINE.md` — cada fase
atualiza este arquivo com o que foi entregue, decisões tomadas e pendências.

---

## Fase A — Architecture Assessment

### 0. Onde isso entra na arquitetura atual

Domínio novo dentro de `apps/web` (rotas `tenant/infractions/*`, `app/api/infractions/*`, mesmo
padrão flat de `tenant/inspections`/`tenant/contracts`), com lógica pura isolada em
`packages/infractions-engine` (mesmo modelo de `packages/inspection-engine`/
`packages/tenant-contract-engine`: funções puras + interfaces de repositório injetadas, sem
acoplamento a Supabase ou a um provider externo específico). Não é um projeto paralelo — reaproveita
Asset, Contract, Operations/Allocations, Notification, Billing, Tracking, IAM já existentes.

### 1. Estado real confirmado (auditoria, não a documentação aspiracional)

**`assets`** (`20260008000000_assets.sql`): `id, tenant_id, branch_id, asset_type_id, name,
serial_number, category, status, version, metadata jsonb, ...`. **Não existe coluna de placa nem
de RENAVAM** — hoje só existem dentro de `metadata` (`{"plate": "..."}`) quando presentes, sem
índice, sem normalização. Isso é uma lacuna real para um motor cujo primeiro passo é "match por
placa/RENAVAM".

**`operations`** (`20260011000000_operations.sql` + `20260066000000_operations_asset_link.sql`):
`asset_id` foi adicionado depois (nullable, com constraint exigindo `asset_id` ou `resource_id`),
`scheduled_starts_at`/`scheduled_ends_at` são o range real, status é um enum de **5** valores
(`pending|in_progress|completed|cancelled|failed`). **Não tem `operator_id`** — vínculo com
operador é só via `operator_assignments.operation_id`.

**`allocations`** (`20260012000000_allocations.sql`) — tabela real e distinta de `operations`:
"time-bound assignment de um asset a um resource" — `resource_id, asset_id, period_starts_at,
period_ends_at, status`. É essa a peça que corresponde à palavra "Allocation" do spec, não uma
reinterpretação de `operations`.

**`contracts`** — confirmado: **sem `customer_id`** direto, vínculo com cliente é só via
`organization_id` → `rental_customer_organizations` → `rental_customers`. `contract_assets` é um
link plano (`contract_id, asset_id, quantity`), **sem range de datas próprio** — só o range do
contrato serve como janela temporal.

**Não existe hoje nenhum resolver "quem tinha o ativo no instante T"** em lugar nenhum do
código. O padrão de query mais próximo e reaproveitável é o de detecção de overlap em
`apps/web/src/lib/resource-availability.ts` (`.lt("scheduled_starts_at", endsAt).gt("scheduled_ends_at",
startsAt)`) — mesma forma que o `TemporalResponsibilityResolver` desta rodada vai usar, adaptada
para um ponto no tempo (`occurred_at`) em vez de um range.

**`packages/tracking-engine`** confirmado mínimo: só `GeofenceEngine` + tipos. Existe, porém,
uma tabela real de histórico de posição — `resource_locations` (`resource_id, latitude,
longitude, recorded_at, source, raw_payload`), indexada por `(resource_id, recorded_at desc)` —
diretamente usável como evidência contextual ("o ativo estava por perto nesse horário").

**`createNotification()`** (`apps/web/src/lib/notifications/create-notification.ts`) é sempre
imediato — não existe agendamento (`scheduled_for`). Existe, porém, um padrão real de cron:
`api/cron/forfeit-reservations` (autenticado por `Authorization: Bearer $CRON_SECRET`, registrado
em `apps/web/vercel.json`'s `crons`). O sweep diário de prazos desta rodada segue exatamente esse
padrão — não inventa um novo mecanismo de agendamento.

**`inspection-billing.ts`** confirma o padrão de cobrança condicional
(`ensureXCharge(db, row)`): idempotência por FK dedicada em `invoice_line_items`, resolve
`billing_accounts` por `tenant_id+organization_id` (bloco inline, não há helper genérico
extraído — `ensureInfractionCharge()` replica o mesmo bloco, não importa um compartilhado que não
existe).

**IAM**: `tenant.*` e `customer.*` são os únicos namespaces de permission reais — **não existe
`operator.*`** em lugar nenhum das migrations. Autorização de operador hoje **nunca** passa por
`hasTenantPermission()` — é sempre `requireMobileContext()` + posse de linha (`operator_id =
context.operatorId`), confirmado nas rotas de Inspection Engine construídas nesta mesma sessão.
**Decisão**: seguir o padrão real (posse via contexto), não inventar um sistema de permission key
`operator.*` que não existe em nenhuma outra parte do produto.

**Storage privado**: dois buckets privados já existem — `inspection-media` (15 MiB) e
`contract-documents` (10 MiB, PDF+imagens) — `infraction-documents` segue exatamente essa forma.

**Convenção de scope mobile**: 7 arquivos `apps/web/src/lib/mobile-*-scope.ts` já estabelecem o
padrão (`resolveXVisibility(context)` retornando union discriminada + `isXVisible(row,
visibility)` predicado puro testável) — `mobile-infractions-scope.ts` segue exatamente essa
forma.

**Não existe** precedente de importação CSV (upload→preview→mapping→validação→import) em lugar
nenhum do repo — só exportação (`api/export`). Construção nova.

### 2. Decisões arquiteturais (documentadas, não bloqueantes — todas reversíveis/aditivas)

1. **`assets` ganha colunas reais `plate`/`renavam`** (migration aditiva, nullable, com backfill
   de `metadata->>'plate'` quando presente e índice em `plate` normalizado). Manter só em jsonb
   inviabilizaria o índice/match confiável que é o primeiro passo de todo o domínio — não é
   over-engineering, é o campo central do produto.
2. **`Infraction` × `InfractionCase` são tabelas separadas.** `infractions` é o fato externo
   imutável (nunca editado após recebido, só reprocessado); `infraction_cases` é o processo
   operacional (1:1 com `infractions`, evolui). Justifica-se pelo mesmo motivo que
   `inspections`≠`inspection_reports`: snapshot imutável separado de estado mutável.
3. **"Allocation" do spec mapeia para a tabela real `allocations`**, não para `operations`. O
   `TemporalResponsibilityResolver` consulta ambas (operations tem `asset_id` desde a migration
   de 2026-07; allocations sempre teve) e prioriza a que efetivamente cobre `occurred_at`.
4. **Sem `operator.*` permission namespace novo** — autorização de operador via
   `requireMobileContext()` + posse, replicando o padrão já usado no Inspection Engine, não o
   texto literal da seção 45 do spec.
5. **Conjunto mínimo de tabelas** (10, não os 13 nomes literais do spec): `infractions`,
   `infraction_cases`, `infraction_evidence`, `infraction_deadlines`, `infraction_disputes`,
   `infraction_driver_identifications`, `infraction_defenses`, `infraction_payments`,
   `infraction_documents`, `infraction_provider_sync_runs`. `infraction_sources`/
   `infraction_matches`/`infraction_responsibilities`/`infraction_charges` do spec viram colunas
   em `infraction_cases` (status/match*confidence/responsible_party*\*) em vez de tabelas próprias
   — a granularidade adicional não teria consulta real que a justifique nesta rodada.
6. **Providers V1**: `ManualInfractionProvider` e `CsvInfractionProvider` reais;
   `NullOfficialProvider` explícito (nunca simula dado oficial). `SenatranInfractionProvider` fica
   só como interface preparada — sem endpoint/credencial inventados, documentado à parte em
   `docs/integrations/SENATRAN_INFRACTIONS.md` com campos marcados `TO_BE_CONFIRMED`.
7. **Cron de prazos** via `api/cron/infraction-deadlines`, mesmo padrão de autenticação de
   `forfeit-reservations` (`CRON_SECRET`), registrado em `vercel.json`.
8. **Cobrança nunca automática** — `ensureInfractionCharge()` só dispara quando
   `responsibility_confirmed_at` existe E um valor aprovado por humano está setado, mesmo
   princípio já usado em `ensureFindingCharge()`.

### 3. Riscos assumidos (documentar no relatório final)

- Sem provider oficial real (Senatran/SNE/Serpro) — só manual + CSV nesta rodada, por decisão
  explícita do próprio spec (regra 0/6/28/60).
- `driver_identification` armazena `operator_id` quando o condutor é um operador cadastrado; para
  condutor não cadastrado, campos de texto livre (nome/documento) ficam sujeitos a minimização —
  nunca duplicar CPF/CNH em múltiplas tabelas quando um identificador interno já existe.
- KPIs de Reporting exigiriam estender `KpiType` em `packages/reporting-engine` (união fixa) —
  fora do escopo imediato se o tempo não permitir; cards próprios do módulo cobrem o mínimo.

### 4. Plano de execução

Fase B (schema/migrations/RLS/IAM) → Fase C (ingestão/normalização/dedup) → Fase D (matching de
asset + temporal + responsabilidade) → Fase E (prazos + notificações) → Fase F (indicação/
defesa/contestação/pagamento) → Fase G (billing + reporting) → Fase H (Tenant Web + mobile) →
Fase I (CSV + provider foundation) → Fase J (hardening/E2E/isolamento).

---

## Fase B — Schema, `packages/infractions-engine`, IAM (entregue)

4 migrations (`20260105000000` a `20260108000000`): 10 tabelas + 15 enums, RLS select-only por
`tenant_id` do JWT em todas, mais a policy de cliente via `rental_customer_organizations` (mesma
cadeia de subquery já usada em `contracts`). IAM seedado (`tenant.infractions.*` +
`customer.infractions.view/respond`), grant automático a `tenant_owner`/`tenant_admin`.
`packages/infractions-engine` criado espelhando `packages/inspection-engine` (types, normalize,
dedup, matching, responsibility, deadline, transitions, providers) — 29 testes, 99%
statement/81.8% branch coverage.

**Bug real pego antes de dado de produção**: `infraction_cases.tenant_id` estava `not null`, mas
um caso pode nascer `unmatched` (tenant ainda desconhecido) — corrigido via
`20260107000000_infraction_cases_nullable_tenant.sql` antes de qualquer insert real acontecer.

## Fase C — Ingestão, matching, prazos (entregue)

`ingestInfraction()` (dedup via os dois índices únicos parciais + matching de asset por
placa/RENAVAM, nunca escolhendo sozinho em caso de ambiguidade), `resolveTemporalContext()`
(resolve contrato/operação/alocação/operador cobrindo `occurred_at`, chama
`suggestResponsibility()`), `createDeadlinesForCase()`/`sweepInfractionDeadlines()` (cron diário,
`api/cron/infraction-deadlines`, um alerta por limiar 7/3/1 dias + um ao virar `overdue`, via
`alerted_thresholds`).

## Fase D — Rotas de match e responsabilidade (entregue)

`POST /api/infractions` (entrada manual, mesmo pipeline que qualquer provider usaria),
`GET/POST /api/infractions/[id]/match`, `/responsibility/suggest`, `/confirm`, `/reject` — o
humano sempre decide, a sugestão nunca vira decisão sozinha. **Pendência conhecida**: reprocessar
casos genuinamente `unmatched` (tenant ainda desconhecido) fica para um cron futuro, não uma rota
de usuário — não implementado ainda.

## Fase E — Prazos ao vivo (entregue)

Verificado contra o banco hospedado: insert de deadline com enum inválido rejeitado pelo Postgres
(confirma que o enum é real, não só declarado); sweep recalculando status e disparando
notificação certa por limiar.

## Fase F — Fluxo operacional (entregue)

`disputes` (POST/PATCH, aceitar uma contestação devolve a responsabilidade para `pending`),
`driver-identification` (POST/PATCH, minimiza dado pessoal — só `operator_id` quando o condutor
já é cadastrado), `defense`/`appeal` (registro administrativo, nunca protocola sozinho numa
autoridade), `payment` (kind `to_authority` vs. `reimbursement_from_responsible`, dois conceitos
nunca misturados numa linha).

## Fase G — Billing (entregue)

`ensureInfractionCharge()` (`apps/web/src/lib/infraction-billing.ts`), mirror literal de
`ensureFindingCharge()`. Só dispara com responsabilidade confirmada + parte `customer` + um
pagamento `to_authority` real já registrado — nunca no recebimento da infração. Coluna nova
`invoice_line_items.infraction_case_id` (migration `20260109000000`), verificada ao vivo contra o
banco hospedado (insert → select → cleanup). **Reembolso de operador é uma lacuna conhecida** —
sem trilho de fatura/organização hoje, fica para o tenant resolver internamente (folha/acerto).
KPI de Reporting (`packages/reporting-engine`) **não construído** nesta rodada — risco de escopo
já registrado na Fase A, mantido como pendência.

## Fase H — Tenant Web UI (entregue)

`tenant/infractions` (lista com filtros de status, lançamento manual) + `InfractionDetail`
(drawer: resumo, sugerir/confirmar/rejeitar responsabilidade, prazos, contestação, registro de
pagamento). Item novo "Infrações" na sidebar. **Fora do drawer nesta rodada**: UI dedicada para
indicação de condutor e defesa/recurso — as rotas de API já existem (Fase F), só falta a tela;
telas mobile (operador/gestor) e Contract-Center-style self-service do cliente/operador também
não foram construídas. Preview local verificado sem erro de console; typecheck limpo em todo o
monorepo em cada fase.

## Pendências (não construídas nesta rodada)

- **Fase I** — importação CSV real (upload → preview → mapeamento de coluna → validação →
  import; não existe precedente algum no repo para esse fluxo, seria 100% novo),
  `CsvInfractionProvider` ligado a uma rota real, `docs/integrations/SENATRAN_INFRACTIONS.md`.
- **Fase J** — suite de isolamento permanente (tenant×tenant, operator×operator, customer×
  customer, seguindo o padrão `mobile-*-scope.ts` já usado no Inspection Engine) e testes E2E dos
  3 cenários críticos do spec (feliz, contestação, unmatched-depois-reprocessado).
- Reprocessamento de casos `unmatched` via cron (Fase D, mencionado acima).
- UI de indicação de condutor / defesa / recurso, telas mobile, self-service do cliente/operador.
- KPI cards de Reporting.
- Reembolso quando o responsável é `operator` (sem trilho de billing hoje).
