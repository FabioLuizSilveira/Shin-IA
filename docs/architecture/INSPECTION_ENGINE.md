# Shinã Inspection Engine — Vistoria Digital

**Status: Fase A (Discovery) concluída. Fase B (Domain + Database) iniciando nesta sessão.**

Log corrido do módulo, no mesmo padrão de `docs/architecture/FIREBASE_AUTH_MIGRATION.md` — cada
fase atualiza este arquivo com o que foi entregue, decisões tomadas e pendências.

---

## Fase A — Architecture Assessment

### 0. Onde isso entra na arquitetura atual

O Inspection Engine **não é um app novo nem uma engine paralela** — é um domínio novo dentro de
`apps/web` (rotas `tenant/inspections/*` e `app/api/inspections/*`, no mesmo padrão flat de
`tenant/contracts`/`tenant/operations`), com a lógica pura de domínio isolada em
`packages/inspection-engine` (novo pacote, mesmo modelo de `packages/tenant-contract-engine` e
`packages/tracking-engine`: classes/funções puras + interfaces de repositório injetadas, sem
acoplamento a Supabase ou a um provider de IA específico). `apps/mobile` ganha as telas de
captura (câmera é 100% funcionalidade nova lá, ver §5).

### 1. Achados que mudam o que o spec original assumia

O spec pede para integrar com "Rule Engine" e "Workflow Engine" existentes. **Uma auditoria real
do repositório (não apenas o CLAUDE.md) confirma que ambos foram deletados** — `packages/
rule-engine` e `packages/workflow-engine` só têm `dist/`/`node_modules/` residuais, sem
`package.json`, sem `src/`, invisíveis ao pnpm workspace e ao Turbo (commit `1622e70`). As
tabelas órfãs `workflow_definitions` e `rule_sets` também têm zero referências em `apps/web/src`.

Isso **não é um bloqueio** — é exatamente o cenário que o item 14 do spec já previa ("Evite
implementar máquinas de estado paralelas **se** o Workflow Engine existente resolver o
problema"): como ele não existe, o padrão real e já usado por **todo** o resto do domínio
(operações, contratos, reservas) é aplicado aqui também — ver §2. Da mesma forma, "Rule Engine"
vira `evaluateCondition()` (`packages/tenant-contract-engine/src/clause-conditions.ts`), um
avaliador puro de `{field, op, value}` sobre jsonb, já em produção. Reaproveitado, não
reinventado.

**Decisão registrada, não redução silenciosa de escopo**: a integração com "Workflow Engine" e
"Rule Engine" do spec (itens 5 e 14) será feita contra os padrões reais que os substituem no
código hoje, não contra pacotes que não existem.

### 2. Lifecycle da Inspection — padrão de transição (não uma state machine nova)

Mesma receita de `apps/web/src/lib/operation-transitions.ts` + `app/api/operations/[id]/
route.ts`: um `Record<InspectionStatus, InspectionStatus[]>` extraído para
`apps/web/src/lib/inspection-transitions.ts`, validado na rota PATCH, com `logActivity()` depois
de cada transição bem-sucedida (e também nas rejeitadas, como o gate de contrato já faz). Estados
da Inspection (distintos do `Finding`, que tem seu próprio ciclo — §9 do spec):

```
draft → in_progress → pending_review → completed
                                     ↘ rejected
in_progress → abandoned
```

### 3. Onde a Inspection vive — não reaproveita `operations` diretamente

`operation_type` já contém `'inspection'` como valor de enum e há seed real usando isso
(`20260050000000_apply_demo_seed.sql`). Mas uma vistoria do spec é ordens de magnitude mais rica
(template, seções, itens, respostas, mídia, findings, comparação, laudo, assinatura) do que o que
`operations` (5 colunas de payload) pode carregar sem virar uma tabela genérica demais.

**Decisão**: `inspections` é uma tabela nova e rica. Ela **pode** referenciar `operation_id`
(nullable) quando a vistoria está amarrada a uma operação de agenda/recurso real — mesmo padrão
já usado por `tenant_contract_acceptances.operation_id`. Isso preserva a modelagem de
"agendamento" (`operations`) separada de "evidência/laudo" (`inspections`), sem duplicar
conceito.

### 4. Blueprint → Template — config, não código

Mapeamento novo `blueprint_inspection_mappings` (mesma forma exata de
`blueprint_contract_mappings`, já seedado para os 10 blueprints reais em
`20260078000000_blueprint_contract_mappings_seed.sql`): `blueprint_id text, purpose
inspection_purpose ('check_in'|'check_out'), template_key text, is_default boolean, required
boolean, ai_damage_detection_enabled boolean, ai_requires_human_approval boolean default true`.
Isso cobre o item 30 do spec (o YAML conceitual `inspection.checkIn.template` /
`aiDamageDetection.requireHumanApproval`) como linhas de banco, nunca como
`if (blueprintId === "munk")`.

`BlueprintCapabilities` (`packages/blueprint-runtime/src/types.ts`) é um struct fixo de 7
booleans sem flag de inspeção. **Decisão**: adicionar `inspection: boolean` ao struct e a todo
`BASE_CAPABILITIES` dos 10 built-ins (mudança aditiva e controlada no pacote, não um redesenho).

### 5. Fotos guiadas e captura — maior superfície nova do módulo

`apps/mobile` não tem `expo-camera`, `expo-image-picker`, `expo-file-system` ou `expo-location`
hoje — só `expo-image` (display). Toda a captura guiada (item 6 do spec) é construção nova.
**Risco assumido e documentado**: build real do EAS segue bloqueado até 2026-09-01 (cota
gratuita esgotada, já documentado em `docs/architecture/FIREBASE_AUTH_MIGRATION.md`). O trabalho
de mobile desta fase será construído e testado via Expo Go onde a Câmera funcionar nele (ao
contrário do Google Sign-In, `expo-camera` funciona normalmente em Expo Go); verificação em
device real de produção fica pendente pelo mesmo motivo já registrado no módulo de auth.

### 6. Storage — bucket privado novo, não reaproveita `asset-photos`

`asset-photos` é **público** (`20260093000000_asset_photos_storage.sql`) — serve fotos de
catálogo de ativos. O spec exige explicitamente que fotos de vistoria nunca sejam públicas por
padrão (item 20). **Decisão**: bucket novo `inspection-media`, privado, seguindo exatamente o
padrão já implementado (não apenas planejado) do bucket `contract-documents`: uma linha por
arquivo em `inspection_media` (nunca upsert de path único, ao contrário de
`api/assets/[id]/photo`), leitura via `createSignedUrl()` com TTL curto, upload via rota de API
que verifica posse antes de gerar o path.

### 7. IA — abstração isolada no pacote novo, não em `@shina/ai-platform`

`ModelProvider` (`packages/ai-platform`) é **text-only** hoje — gap já documentado no próprio
código (`apps/mkt/src/lib/ai/anthropic-provider.ts:12-18`) para o caso simétrico de
`analyzeImage()` do Ad Cloner, que também não usa essa interface pelo mesmo motivo. Seguindo o
padrão já estabelecido pelo próprio `packages/tenant-contract-engine` para
`ContractSignatureProvider` (interface definida no pacote de domínio, implementação mínima,
slots vazios documentados): `InspectionMediaComparisonProvider` vive em
`packages/inspection-engine`, não em `@shina/ai-platform`. Nenhuma implementação real (Anthropic
Vision, etc.) nesta fase — só a interface + um `NullComparisonProvider` que retorna "não
configurado", documentado como dependência externa pendente (item 29 do spec: nunca simular
resultado real como se fosse funcionalidade pronta).

### 8. IAM — nomenclatura

Duas convenções coexistem no código real (`tenant.recurso.acao` nos seeds mais recentes de
`tenant_permissions`, e `recurso:acao` checado em algumas rotas older via `hasTenantPermission`).
A convenção mais recente e mais bem documentada é a `tenant.recurso.acao`
(`20260076000000_tenant_contract_engine.sql`). **Decisão**: novas permissions seguem esse
padrão: `tenant.inspections.view`, `.create`, `.update`, `.complete`, `.approve`,
`.review_damage`, `.manage_templates`, mais `customer.inspections.view`/`.accept` para o aceite
do cliente (espelhando `customer.contracts.accept`).

### 9. O que será reaproveitado literalmente (sem reinventar)

| Necessidade                            | Reaproveita                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Escopo/tenant                          | `requireTenantScope()` + `scopedSelect/Insert/Update`                        |
| Permissões                             | `hasTenantPermission()` + padrão de seed de `20260076000000`                 |
| Auditoria operacional                  | `logActivity()`                                                              |
| Evidência jurídica (aceite/assinatura) | forma de `tenant_contract_acceptances` + `hashContent()` + snapshot imutável |
| Notificações                           | `createNotification()`                                                       |
| Arquivo privado                        | bucket `contract-documents` + rota de signed URL                             |
| Mapeamento blueprint→config            | forma de `blueprint_contract_mappings`                                       |
| Regra condicional                      | `evaluateCondition()`                                                        |
| Gate de pré-condição                   | forma de `OperationContractGate.check()`                                     |
| Cobrança                               | `ensureContractInvoice()` (registro, nunca cobrança automática)              |
| Forma de pacote de domínio             | `packages/tracking-engine` (engine + repositórios injetados)                 |

### 10. Riscos assumidos (carregados para o relatório final)

- Sem device real pra testar câmera/upload em produção (mesmo bloqueio de EAS do módulo Firebase).
- `events.domain_events` é uma tabela outbox sem produtor nem worker — não será usada; eventos
  de domínio deste módulo seguem o padrão real (`logActivity` + `createNotification` diretos).
- IA de comparação de imagens fica como interface + adapter nulo nesta rodada — nenhum provider
  real configurado (sem credenciais, sem decisão do usuário sobre qual provider usar).
- `BlueprintCapabilities` ganha um campo novo — mudança aditiva no pacote, sem quebrar nenhum
  blueprint existente (todos os 10 built-ins são atualizados juntos).

---

## Fase B — Domain + Database

**Status: schema, RLS e permissions concluídos e verificados ao vivo contra o banco hospedado.
Repositórios/domain package ficam para o início da Fase C (ver "Próximo passo" abaixo).**

### Migrations

- `supabase/migrations/20260098000000_inspection_engine.sql` — 9 enums novos
  (`inspection_type`, `inspection_status`, `inspection_template_status`,
  `inspection_field_type`, `inspection_purpose`, `inspection_media_type`,
  `inspection_finding_severity`, `inspection_finding_status`, `inspection_signer_type`), 11
  tabelas (`inspection_templates`, `inspection_template_sections`,
  `inspection_template_items`, `blueprint_inspection_mappings`, `inspections`,
  `inspection_responses`, `inspection_media`, `inspection_findings`,
  `inspection_comparisons`, `inspection_reports`, `inspection_signatures`), RLS em todas
  (select-only staff via `auth.jwt()->>'tenant_id'`, catálogo global+overlay nas tabelas de
  template), 9 permissions novas + grant a `tenant_owner`/`tenant_admin`.
- `supabase/migrations/20260099000000_inspection_engine_seed.sql` — bucket privado
  `inspection-media` (15 MiB, png/jpeg/webp/mp4/mov/pdf), dois templates globais
  (`vehicle_standard_v1` — 4 seções/21 itens, espelhando o exemplo de veículo do spec;
  `equipment_standard_v1` — 3 seções/13 itens, espelhando o exemplo de empilhadeira),
  `blueprint_inspection_mappings` para os 10 blueprints built-in reais × 2 propósitos
  (check_in/check_out) = 20 linhas.

### Verificação ao vivo (banco hospedado, não mockado)

- As 11 tabelas + 2 templates + 7 seções + 34 itens + 20 mapeamentos + bucket existem e têm os
  valores esperados (conferido via `service_role` diretamente).
- RLS: a `anon key` recebe lista vazia em `select` (nunca erro, nunca dado) e é bloqueada com
  `new row violates row-level security policy` em `insert` — confirmado nas duas pontas, não só
  assumido pela presença da policy.
- Nenhum teste automatizado (`vitest`) ainda — este é só schema; os testes de domínio entram na
  Fase C junto com `packages/inspection-engine`.

### Decisões desta fase (ver corpo da Fase A para o raciocínio completo)

1. Sem tabela de audit events própria — `tenant_activity_log`/`logActivity()` cobre o rastro
   operacional; `inspection_signatures` cobre a evidência jurídica (mesma forma de
   `tenant_contract_acceptances`).
2. Templates sem versionamento imutável completo (só `status`/`version int` na própria linha) —
   trade-off de escopo assumido, documentado na Fase A como algo a promover se virar requisito
   real.
3. RLS só idioma 2 (select-only staff) e idioma 5 (catálogo global+tenant) — nenhuma policy
   `auth.uid()` para cliente/operador, porque o acesso deles é sempre via rota de API com
   `requireMobileContext()`, consistente com a migração Customer Portal RLS→API desta mesma
   sessão (uma sessão Firebase não tem `auth.uid()` do Supabase).
4. `inspections.operation_id` é nullable — a vistoria pode existir sem uma operação de
   agenda/recurso amarrada.

### Pendências

- `packages/inspection-engine` (domínio puro + interfaces de repositório) — Fase C.
- `apps/web/src/lib/inspection-transitions.ts` (mapa de transição, mesmo padrão de
  `operation-transitions.ts`) — Fase C.
- `BlueprintCapabilities.inspection` (flag nova no pacote `blueprint-runtime`) — Fase C.
- Rotas de API (`app/api/inspections/*`) — Fase C.
- UI Tenant Web, Inspection Builder, captura guiada mobile — Fase D.
- Comparação BEFORE×AFTER, findings, revisão humana, `InspectionMediaComparisonProvider` —
  Fase E.
- Laudo, assinatura, hooks de Workflow/Notification/Billing/Tracking — Fase F.
- Testes de domínio/RLS/isolamento entre tenants, hardening — Fase G.

## Fase C — Inspection Runtime

**Status: pacote de domínio + rotas de API principais concluídos e verificados ao vivo contra o
banco hospedado, com dados reais (não mockados). Falta a flag `inspection` no
`BlueprintCapabilities` do `blueprint-runtime` — pendência explícita, ver abaixo.**

### Arquivos criados

- `packages/inspection-engine/` — pacote novo completo: `types.ts`, `transitions.ts`
  (`ALLOWED_TRANSITIONS`/`canTransition` para `Inspection`, `FINDING_ALLOWED_TRANSITIONS`/
  `canTransitionFinding` para `InspectionFinding`), `evaluate-condition.ts`,
  `completion-validator.ts`, `comparison.ts`, `media-comparison-provider.ts`,
  `template-resolver.ts`, `hash.ts`, `repositories.ts`, `index.ts`, mais 7 arquivos de teste (32
  testes, 99%/87,5% de cobertura statements/branch).
- `apps/web/src/lib/inspection-repository.ts` — implementação real do
  `InspectionTemplateRepository` contra o Supabase, mesmo split de `blueprint-runtime-factory.ts`
  (mapeamento linha↔domínio só existe aqui).
- `apps/web/src/app/api/inspections/route.ts` (GET lista / POST cria — resolve blueprint→template
  via `resolveInspectionTemplate`, nunca cai num template genérico por omissão).
- `apps/web/src/app/api/inspections/[id]/route.ts` (GET detalhe hidratado / PATCH transição de
  status — `pending_review` exige `checkTemplateCompletion().canComplete`, gate falho não
  bloqueia envio mas fica registrado em `tenant_activity_log`).
- `apps/web/src/app/api/inspections/[id]/items/[itemId]/route.ts` (PATCH — upsert de resposta,
  idempotente, ownership do item verificada contra o template da inspeção).
- `apps/web/src/app/api/inspections/[id]/media/route.ts` (POST — upload multipart pro bucket
  `inspection-media`, checksum SHA-256 real calculado no servidor, path novo por arquivo, nunca
  upsert de path fixo, rollback do storage se o insert falhar).
- `apps/web/src/app/api/inspections/[id]/compare/route.ts` (POST — computa e persiste
  `inspection_comparisons` entre a inspeção e sua `linked_inspection_id`).
- `apps/web/src/app/api/findings/route.ts` + `[id]/route.ts` (POST cria / PATCH revisão —
  `DETECTED → UNDER_REVIEW → CONFIRMED/REJECTED → CHARGEABLE/WAIVED → RESOLVED`).

### Teste real ponta a ponta (não simulado)

Script executado contra o banco hospedado, usando um ativo real do tenant demo (Chevrolet Onix,
Acme Logística): criou inspeção de check-in real, preencheu itens obrigatórios, confirmou que
`checkTemplateCompletion` bloqueia sem fotos obrigatórias e libera quando presentes, validou as
transições de status (inclusive que pular direto pra `completed` é rejeitado), criou o check-out
vinculado com valores diferentes (odômetro, combustível, condição do pneu), computou e persistiu
a comparação BEFORE×AFTER (23 linhas, diffs corretos), criou um Finding e o levou por
`detected → under_review → confirmed` com custo estimado, e confirmou isolamento entre tenants
numa leitura fabricada. Todas as linhas de teste foram limpas ao final.

**Bug real encontrado e corrigido por esse teste**: itens de foto opcionais com `min_photos`
definido (`roof`/`dashboard`/`trunk` no seed) estavam sendo bloqueados como se fossem
obrigatórios — corrigido em `completion-validator.ts` (min só se aplica a item opcional depois
que pelo menos 1 foto já foi enviada pra ele) e coberto por dois testes de regressão novos.

### Pendências desta fase

- Flag `inspection: boolean` em `BlueprintCapabilities`
  (`packages/blueprint-runtime/src/types.ts`) e nos 10 `BASE_CAPABILITIES` dos built-ins —
  mudança pequena, aditiva, ainda não feita.
- `GET /api/inspections/[id]/report` (laudo) e rota de assinatura ficam pra Fase F.
- Nenhuma rota de API foi exercitada via HTTP real com sessão de usuário nesta fase — a
  verificação foi via chamada direta ao repositório/domínio contra o banco real (mesmo código,
  sem a camada HTTP). Teste via requisição HTTP real fica pra Fase G (hardening).

## Fase D — UX (Tenant Web concluído; Mobile pendente)

**Status: Tenant Web completo e verificado ao vivo, incluindo a criação e o preenchimento de uma
vistoria real pela UI (não só via chamada direta ao domínio, como na Fase C). Mobile (captura
guiada) ainda não iniciado — próximo passo.**

### Arquivos criados

- `apps/web/src/app/api/inspection-templates/` (+ `[id]`, `[id]/sections`,
  `[id]/sections/[sectionId]/items`, `[id]/sections/[sectionId]/items/[itemId]`) — CRUD real de
  templates (o Inspection Builder precisa disso pra não ser uma tela fake). Template global
  (`tenant_id` null) é sempre somente-leitura por essas rotas; só o template do próprio tenant é
  editável. `manage_templates` fica restrito a `tenant_owner`/`tenant_admin`.
- `apps/web/src/app/(tenant)/tenant/inspections/page.tsx` — lista com filtro por status,
  formulário de criação (ativo/tipo/propósito, blueprint como override manual quando o ativo não
  tem um associado).
- `apps/web/src/app/(tenant)/tenant/inspections/templates/page.tsx` — Inspection Builder: lista
  de templates (globais com cadeado, do tenant editáveis), criação de seção/item por formulário,
  publicação.
- `apps/web/src/components/ui/inspection-detail.tsx` — gaveta de detalhe: timeline (Rascunho →
  Em andamento → Aguardando revisão → Concluída), ações de transição, checklist com contagem de
  fotos, botão de comparação BEFORE×AFTER, revisão de constatações (revisar/confirmar/rejeitar).
- `apps/web/src/components/layout/sidebar.tsx` — item "Vistorias" adicionado à navegação.

### Bug real encontrado e corrigido nesta fase

**`hasTenantPermission()` sempre retornava `false` pra qualquer papel que não fosse
`tenant_owner`/`tenant_admin`** — bug pré-existente, não introduzido por este módulo, mas que
bloqueava a própria entrega da Fase D. A função comparava `tenant_user_roles.user_id` direto com
o uid canônico de auth, mas essa coluna na real guarda `user_profiles.id` (mesma resolução que
`custom_access_token_hook` já faz). Como `tenant_owner`/`tenant_admin` saem por atalho antes da
query (sem round-trip ao banco), o bug nunca tinha sido exercitado por uma conta real que não
fosse dono/admin — até a conta demo `fleet_manager` (que já tem `operations:write`) bater um
`Forbidden` real criando uma vistoria pela UI, mesmo com o grant existindo em
`tenant_role_permissions`. Corrigido em `apps/web/src/lib/tenant-context.ts`, nas duas funções
(`hasTenantPermission`/`getEffectiveTenantPermissions`). Migration
`20260100000000_inspection_permissions_operational_roles.sql` também concede as permissions
operacionais de vistoria a `fleet_manager`/`operations_manager`.

### Verificação ao vivo pela UI real (não só chamada direta ao domínio)

Com a conta real `demo.equipe@shinaia.com.br` (papel `fleet_manager`): criei uma vistoria de
check-in real pelo formulário da lista (ativo Chevrolet Onix), a gaveta abriu mostrando o
checklist vazio do `vehicle_standard_v1`; cliquei "Iniciar vistoria" e o status mudou pra "Em
andamento" corretamente; cliquei "Enviar para revisão" sem preencher nada e o sistema bloqueou
corretamente, listando os itens obrigatórios faltando (`plate, odometer, fuel_level, tires,
dashboard_alerts, operating_condition`) — confirmando que `checkTemplateCompletion()` está
realmente conectado, não só testado isoladamente. Builder testado abrindo o template global
`vehicle_standard_v1` e confirmando que as 4 seções/21 itens reais aparecem com tipo de campo e
obrigatoriedade corretos. Dados de teste limpos do banco ao final.

### Pendências desta fase

- Mobile (captura guiada) — não iniciado. Maior lacuna de dependências novas (sem
  `expo-camera`/`expo-image-picker`/`expo-file-system`/`expo-location` hoje) e sem possibilidade
  de teste em device real (cota EAS esgotada até 2026-09-01, mesmo bloqueio já documentado no
  módulo Firebase).
- Nenhum teste automatizado novo nesta fase (componentes React sem suíte de testes no padrão do
  projeto — as demais páginas `tenant/*` também não têm). Verificação foi ao vivo, via navegador,
  contra o banco hospedado real.

### Próximo passo

Continuar a Fase D com Mobile (captura guiada) — adicionar as dependências de câmera ao
`apps/mobile`, construir as telas de vistoria (lista, checklist com captura foto-a-foto guiada),
conectar às rotas de API já existentes. Testável via Expo Go (câmera funciona lá, ao contrário do
Google Sign-In); verificação em device real de produção fica pendente pelo bloqueio de EAS.
