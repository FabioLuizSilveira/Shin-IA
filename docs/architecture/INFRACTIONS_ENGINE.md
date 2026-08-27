# Shinã Infractions Engine — Gestão de Infrações, Responsabilidade e Multas

**Status: Fase A (Architecture Assessment) concluída. Execução em andamento — ver seções
seguintes conforme cada fase é entregue.**

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
