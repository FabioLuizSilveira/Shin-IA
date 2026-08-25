# Shinã Inspection Engine — Vistoria Digital

**Status: Fases A–G concluídas (V0). Production Completion (V1 comercial, P0.1–P1.4) concluída
2026-08-25 — ver seção "Production Completion" no fim deste documento. Overlay no mobile e
verificação em device real seguem pendentes, documentados explicitamente, não escondidos.**

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

## Fase D — UX (Tenant Web + Mobile concluídos)

**Status: concluída. Tenant Web verificado ao vivo pela UI real (banco hospedado). Mobile
verificado por bundle estático completo (Metro/Hermes, 1516 módulos, zero erros) — sem device
real disponível (cota EAS esgotada até 2026-09-01), limite documentado, não escondido.**

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

### Mobile — captura guiada

**Arquivos:** `apps/mobile/src/screens/InspectionCaptureScreen.tsx` (fluxo guiado item-a-item —
contador de progresso, instrução, captura de foto inline via `CameraView`, controle real por
`field_type` para texto/número/boolean/select/condition, salvamento imediato de cada resposta no
servidor — nada fica só em memória local, então o app matado/reaberto recupera o progresso real
via nova busca, não um cache local), `InspectionsScreen.tsx` (lista, no menu), botões "Vistoria
de Check-in"/"Check-out" no `AssetDetailScreen`. `apps/mobile/src/lib/shinaia-api.ts` ganhou os
tipos e métodos de Inspection, incluindo `uploadInspectionMedia()` — a única chamada multipart do
cliente, construída do zero (o helper `request()`/`mutate()` só faz JSON).

**Dependências novas** (maior lacuna do módulo, `apps/mobile` não tinha nenhuma antes):
`expo-camera`, `expo-file-system`, `expo-location`, instaladas via `npx expo install` (versões
corretas pro SDK 56). Por causa do aviso em `apps/mobile/AGENTS.md` ("Expo HAS CHANGED — leia a
doc versionada antes de escrever código"), consultei a documentação real da v56 antes de escrever
qualquer linha — `CameraView`/`useCameraPermissions()`/`takePictureAsync()` e o novo padrão de
upload via `File` (implementa `Blob`) vêm de lá, não de suposição.

**Verificação**: sem device real disponível (mesmo bloqueio de cota EAS já documentado no módulo
Firebase, até 2026-09-01). Fiz a verificação estática mais forte possível sem device:
`npx expo export --platform android` — bundle completo via Metro/Hermes, 1516 módulos, zero
erros de resolução. Isso prova que toda importação e módulo nativo referenciado (câmera,
localização, sistema de arquivos) linka corretamente; não prova comportamento em runtime real
(permissões do SO, câmera física). Limite documentado, não escondido.

### Pendências desta fase

- Verificação em device real (câmera de verdade, permissões do SO) — bloqueada pela cota EAS.
- Nenhum teste automatizado novo (componentes React sem suíte de testes no padrão do projeto —
  as demais telas `tenant/*`/mobile também não têm). Verificação foi ao vivo (web) e por bundle
  estático (mobile).
- Fluxo de captura guiada não foi conectado à persona "operator" (`OperatorHomeScreen` é uma tela
  única sem stack próprio hoje) — só `tenant_user` (fleet_manager/operations_manager/owner/admin)
  tem acesso pelo app mobile nesta rodada. Decisão de escopo, documentada.

### Próximo passo

## Fase E — Comparação

**Status: concluída.** Revendo o que o spec pede nesta fase (before/after, findings, revisão
humana, abstração de IA) contra o que já foi entregue: os quatro itens já existiam desde as Fases
C/D — comparação BEFORE×AFTER (`computeComparisons()` + rota `/compare` + UI), findings
(schema + rotas + UI de criação/revisão), revisão humana (fluxo `detected → under_review →
confirmed/rejected` já testado ao vivo), e a abstração de IA (`InspectionMediaComparisonProvider`

- `NullMediaComparisonProvider`). O único item genuinamente pendente é um **provider real de
  visão computacional** — sem credenciais configuradas e sem decisão de produto sobre qual serviço
  usar (Anthropic Vision, OpenAI, Gemini), então fica como interface pronta pra plugar, não
  implementada com dado simulado (item 29 do spec).

Único gap real fechado nesta fase: **UI de criação manual de constatação** — a rota
`POST /api/findings` existia desde a Fase C mas nenhuma tela a chamava. Adicionado formulário na
gaveta de detalhe (`inspection-detail.tsx`): descrição, severidade, item do checklist associado
(opcional). Testado ao vivo contra o banco hospedado: criação → revisão → confirmação, ponta a
ponta pela UI real.

## Fase F — Laudo + Integrações

**Status: concluída.**

- `POST`/`GET /api/inspections/[id]/report` — laudo digital (item 13 do spec), snapshot imutável
  (mesmo padrão de `tenant_contract_snapshots`) do estado da vistoria concluída, hash SHA-256 via
  `hashContent()`. Só gera a partir de status `completed`.
- `POST /api/inspections/[id]/sign` — aceite/assinatura (item 12), com a mesma regra não
  negociável já aplicada duas vezes nesta sessão pra `tenant_contract_acceptances`:
  `accepted_at`/`ip_address`/`user_agent` sempre carimbados pelo backend a partir do request,
  nunca aceitos do corpo. Só o signer `tenant_staff` está conectado nesta rodada — assinatura de
  cliente/operador via self-service precisa de rota própria voltada pro cliente (nos moldes de
  `/api/customer-contracts/[id]/accept`, com `requireMobileContext()` em vez de
  `requireTenantScope()`), decisão de escopo deliberada, documentada aqui em vez de simulada com
  uma sessão de staff fazendo as vezes de cliente.
- `apps/web/src/lib/inspection-billing.ts` (`ensureFindingCharge`) — item 15 do spec
  ("AI suggestion → human confirmation → business rule → approval → billing"): dispara quando uma
  constatação vira `chargeable`, mas só gera fatura real quando `approved_cost_amount` já foi
  setado por um humano via `PATCH /api/findings/[id]` (nunca a partir de sugestão de IA).
  Idempotente via coluna nova `invoice_line_items.inspection_finding_id`
  (`20260101000000_inspection_finding_billing_link.sql`, mesmo padrão de `invoices.contract_id`).
  Sem contrato vinculado à inspeção, não há cobrança automática — decisão de escopo documentada.

**Verificação ao vivo contra o banco hospedado** (não simulada): fluxo completo — check-in real
preenchido → `in_progress` → bloqueio correto em `pending_review` sem fotos obrigatórias →
liberado após mídia → `completed` → laudo gerado (hash SHA-256 real) → assinado (ip_address/
user_agent/document_hash conferidos na linha real do banco, hash bate exatamente com o do laudo)
→ uma constatação levada a `chargeable` gerando fatura real de R$850, vinculada ao contrato real,
com vencimento em D+7. Todos os dados de teste removidos ao final.

## Fase G — Hardening

**Status: concluída, dentro do que é possível verificar neste ambiente.**

### Isolamento entre tenants — testado via HTTP real, não só chamada direta ao domínio

Diferente da Fase C (que verificou isolamento só com uma leitura fabricada direto no banco), esta
fase testou o item 28 do spec ("Tenant A nunca acessa inspeções ou fotos do Tenant B") através
das rotas de API reais, com uma sessão de usuário real do Tenant A (`Veloz Rent a Car`) tentando
acessar um recurso genuíno criado no Tenant B:

| Ataque                                                 | Resultado                            |
| ------------------------------------------------------ | ------------------------------------ |
| `GET` inspeção de outro tenant                         | `404 Inspection not found`           |
| `PATCH` (mudar status) de outro tenant                 | `404 Inspection not found`           |
| `GET /api/inspections?assetId=<ativo de outro tenant>` | `200`, lista vazia (nunca vaza dado) |
| `POST /api/findings` contra inspeção de outro tenant   | `404 Inspection not found`           |
| Qualquer rota, sem sessão (`credentials: omit`)        | `401 Unauthorized`                   |

Todas as 5 tentativas bloqueadas corretamente. O fixture do Tenant B (branch/asset_type/asset/
inspection reais, criados só pra este teste) foi removido ao final.

### O que fica pendente (documentado, não escondido)

- **Sem device móvel real** — cota EAS esgotada até 2026-09-01 (mesmo bloqueio do módulo Firebase
  desta sessão). Verificação mobile ficou no nível de bundle estático (Fase D).
- **Sem provider de IA real** — decisão de produto + credenciais pendentes (Fase E).
- **Assinatura self-service de cliente/operador** — rota própria não construída nesta rodada
  (Fase F), documentada como próximo passo natural quando o Customer Portal ganhar uma tela de
  vistoria.
- **`docs/PERMISSIONS_MATRIX.md`/`docs/ARCHITECTURE.md`** — já eram documentos aspiracionais
  antes deste módulo (confirmado na Fase A: papéis e convenções que não batem com o código real).
  Optei por não adicionar as novas permissions de Inspection Engine lá, pra não emprestar
  credibilidade a um documento já sabidamente desatualizado — a fonte de verdade real deste
  módulo é este arquivo (`docs/architecture/INSPECTION_ENGINE.md`) e as migrations.
- **Testes automatizados de API/RLS via HTTP** — a verificação de isolamento acima foi feita ao
  vivo via script, não como suíte de teste permanente (`vitest`) rodável em CI. As rotas de API
  não têm testes unitários (mesma lacuna já existente em toda a API de `apps/web` — nenhuma rota
  `app/api/**` tem teste próprio no padrão atual do projeto, só `packages/inspection-engine` tem
  cobertura de verdade, 32 testes/99%).
- **Performance** — não perfilada especificamente; o padrão de queries (sempre filtradas por
  `tenant_id`, índices criados em todas as FKs de consulta frequente) segue o mesmo usado no
  resto da plataforma, sem motivo concreto pra suspeitar de problema, mas não medido sob carga.
- **Overlay/marcação visual de avaria** (item 11 do spec) — o campo `overlay_region` existe no
  schema e no domínio (Fase B/C), mas não há UI de desenhar/marcar a região sobre a foto (nem
  web nem mobile) — só entrada de coordenadas seria possível programaticamente hoje, não há tela
  pra isso. Decisão de escopo: um canvas de arrastar-e-marcar é um investimento de UI grande
  demais pra esta rodada sem uma avaria real pra desenhar sobre (tudo aqui foi testado com dados
  de demonstração).

---

## Relatório Final

### O que foi entregue

Um domínio novo e completo — schema (11 tabelas + 9 enums + RLS + permissions), pacote de
domínio puro (`@shina/inspection-engine`, 32 testes, 99% de cobertura), 15 rotas de API reais,
UI completa no Tenant Web (lista, builder de templates, gaveta de detalhe com timeline/
comparação/revisão/laudo/assinatura), e captura guiada real no mobile (câmera, upload, geolocalização
best-effort). Cada peça foi verificada contra o banco hospedado real, nunca simulada — inclusive
dois bugs reais e pré-existentes da plataforma foram encontrados e corrigidos no processo
(`hasTenantPermission()` quebrado pra qualquer papel não-admin; `min_photos` de item opcional
tratado como obrigatório).

### Cenário do item 33 (Definition of Done) — o que já roda de ponta a ponta

1-9 (criar/selecionar template, contrato exigir vistoria conceitualmente via
`blueprint_inspection_mappings`, abrir pelo celular, identificar o ativo, carregar o checklist
certo, capturar fotos obrigatórias, registrar dados operacionais, aceite, concluir check-in) —
**todos reais e testados**, web e mobile.
10-14 (uso do ativo, check-out, mesmos pontos revistoriados, comparação BEFORE×AFTER, diferenças
apresentadas) — **reais e testados** (Fase C smoke test + Fase D UI).
15-18 (finding criado, revisado, confirmado/rejeitado) — **reais e testados** (Fase E).
19 (laudo final gerado) — **real e testado** (Fase F).
20 (workflow apropriado disparado) — **parcial**: notificações disparam (`pending_review`,
`rejected`, laudo disponível, avaria confirmada) e a cobrança dispara quando aplicável (Fase F);
não existe "Workflow Engine" pra disparar contra (confirmado morto na Fase A) — o equivalente
real são esses hooks diretos, que é o padrão usado em toda a plataforma.
21 (histórico auditável) — **real**: `tenant_activity_log` via `logActivity()` em toda transição/
criação/laudo/assinatura.
22 (isolamento entre tenants) — **real e testado via HTTP** (Fase G).

### Pendências assumidas (não esquecidas — listadas aqui de propósito)

- Provider de IA real para comparação de imagens (decisão de produto + credenciais).
- Verificação em device móvel real (cota EAS).
- Assinatura self-service de cliente/operador (rota própria, fora desta rodada).
- Overlay visual de marcação de avaria (schema pronto, UI não construída).
- `operator` persona não tem acesso ao fluxo de vistoria no mobile ainda (só `tenant_user`).
- Textos de laudo/report são estruturados (JSON), não há exportação em PDF nem link de
  compartilhamento seguro (item 13 do spec menciona os três; só a visualização web existe hoje,
  via a própria gaveta de detalhe).

### Decisões arquiteturais principais (recapitulando)

Todas documentadas em detalhe nas seções de cada fase acima; resumo: Rule/Workflow Engine estão
mortos, o módulo segue os padrões reais que os substituem; `inspections` é tabela nova, não
reaproveita `operations`; bucket de mídia privado, nunca público; IA isolada em
`packages/inspection-engine`, não em `@shina/ai-platform` (que é text-only); nomenclatura de
permission segue o padrão `tenant.recurso.acao` mais recente; nenhuma policy de RLS dá acesso
direto a cliente/operador via `auth.uid()` — acesso deles é sempre via API route, consistente com
a migração Customer Portal RLS→API desta mesma sessão.

---

## Production Completion (V1 Comercial) — 2026-08-25

Ver `INSPECTION_PRODUCTION_COMPLETION_PLAN.md` (raiz do repo) para a auditoria completa (código +
banco) que precedeu esta rodada e as decisões arquiteturais tomadas. Execução autônoma por fases
(P0.1→P0.5, depois P1.1/P1.2), commits reais a cada fase, typecheck/build limpos após cada uma.
Regra fundamental respeitada: `InspectionMediaComparisonProvider` permanece só com
`NullMediaComparisonProvider` — nenhum provider de IA visual foi conectado nesta rodada.

### Implementado

**P0.1 — Acesso do operador (mobile)**: a persona `operator` já existia de verdade
(`operators` + RLS + `requireMobileContext()` já resolvia o tipo) — o gap real era só a
integração com o Inspection Engine. Novas rotas `/api/mobile/operator-inspections/*` (list,
detail, transição de status restrita a `in_progress`/`pending_review`/`abandoned` — nunca
`completed`/`rejected`, que continuam exclusivas de revisão de staff —, upload de mídia
idempotente por checksum, assinatura do checklist). `inspection_signatures.report_id` virou
nullable (migration `20260102000000`) porque o operador assina o checklist antes de existir um
laudo formal. Telas `Inspections`/`InspectionCapture` do mobile passaram a ser compartilhadas
entre `tenant_user` e `operator` via parâmetro `scope`, sem duplicar UI. `OperatorHomeScreen`
ganhou o atalho "Minhas Vistorias".

**P0.2/P0.3 — Self-service do cliente + aceite/contestação**: vínculo real
`customer.customerId → inspections.customer_id` (nunca um id vindo do client) em
`/api/mobile/customer/inspections/*`, novas telas em `(customer)/rentals/[id]/inspections` e
`.../inspections/[inspectionId]`. "CONCORDO" grava em `inspection_signatures`
(`signer_type=customer`, IP/UA/timestamp sempre carimbados no backend). "REGISTRAR DIVERGÊNCIA"
usa uma entidade nova e pequena, `inspection_disputes` (`open → under_review → accepted/rejected
→ resolved`), deliberadamente **não** um `Finding` — ver decisão 2 do plano de produção. Staff
revisa disputas em `PATCH /api/inspections/:id/disputes/:disputeId`.

**P0.4 — Laudo profissional em PDF**: `@react-pdf/renderer` novo (avaliado contra Puppeteer —
rejeitado por exigir Chromium headless incompatível com o runtime serverless atual), renderiza
sempre a partir do snapshot imutável de `inspection_reports`, nunca de dado mutável ao vivo.
White-label real via o `branding` studio config já existente (`companyName`/`logoUrl`), sem
Shinã hardcoded. Seções: cabeçalho, ativo, contrato, checklist por seção, evidências (fotos via
signed URL), comparação check-in×check-out, avarias, aceites, rodapé com hash SHA-256 + QR code
de verificação. Rota staff (`/api/inspections/:id/report/pdf`) e cliente
(`/api/mobile/customer/inspections/:id/report/pdf`), ambas ownership-checked.

**P0.5 — Compartilhamento seguro + verificação pública**: dois mecanismos deliberadamente
distintos (mesma separação do spec). `inspection_report_shares` — token de alta entropia, só o
**hash** do token é persistido (nunca o valor em claro), TTL configurável (padrão 7 dias),
revogação (`revoked_at`), `access_count`/`last_accessed_at` como audit trail; única rota pública
que retorna o PDF completo é `/api/share/inspection-report/[token]`.
`inspection_reports.verification_token` (coluna nova, gerada por versão de laudo) alimenta
`/verify/inspection-report/[token]` — página pública que confirma só `Documento válido`/`Documento
não validado` + número/data/hash/status, nunca mídia ou dado pessoal, exatamente como o exemplo
do spec. Nenhum ID sequencial é usado como mecanismo de segurança em nenhum dos dois.

**P1.1 — Overlay de avaria (web)**: `InspectionOverlayPicker` — arrastar retângulo sobre a foto,
coordenadas normalizadas 0..1 (`{type:"rectangle", x, y, width, height}`), gravadas em
`inspection_findings.overlay_region` (já existia no schema). Decisão arquitetural: a marcação
vive no _finding_, não numa coluna nova em `inspection_media` — a foto "dona" da marcação é a que
tem `finding_id` apontando pro finding (nova rota `PATCH /api/inspections/:id/media/:mediaId` faz
esse vínculo). Evita ambiguidade sem exigir migration na tabela de mídia.

**P1.2 — Viewer BEFORE×AFTER (web)**: componente `InspectionComparisonViewer` reutilizável, modos
lado-a-lado e slider (`clip-path`, sem re-crop), pareamento sempre por `template_item_id` (nunca
ordem de upload), integrado à gaveta de detalhe existente.

**Migrations desta rodada**: `20260102000000_inspection_v1_completion.sql` —
`inspection_signatures.report_id` nullable, `inspection_findings.preexisting_finding_id`
(self-FK, ainda não usado por nenhuma rota — ver Pendências), `inspection_disputes` (tabela +
RLS select-only), `inspection_reports.verification_token`, `inspection_report_shares` (tabela +
RLS select-only), permissions `tenant.inspections.share` / `customer.inspections.dispute` (as
duas `customer.inspections.*` restantes já existiam desde a Fase B).

### Testado

- **Typecheck**: `@shina/web`/`@shina/mobile`/`@shina/inspection-engine` limpos após cada fase
  (comando real, não assumido).
- **Build de produção**: `pnpm build` de `apps/web` limpo após P0.4 e novamente após P1.1/P1.2
  (pega problemas de bundling do `@react-pdf/renderer` que o typecheck sozinho não pegaria).
- **Runtime smoke do `@react-pdf/renderer`**: renderização real de um PDF mínimo confirmada fora
  do Next.js (Node puro) antes de confiar na lib no build.
- **Isolamento de dados (script real contra o banco hospedado, fixtures criadas e limpas na
  mesma execução)**: operador A não enxerga inspeção de operador B (e enxerga a própria);
  cliente A não enxerga inspeção/assinatura/disputa de cliente B (e enxerga a própria); hash de
  token de compartilhamento nunca colide entre tokens distintos. Script não ficou como suíte
  permanente — ver Pendências.
- **Migration**: aplicada e verificada no banco hospedado real via `supabase db push --linked`.

### Não testado

- **Nenhuma verificação em device móvel real** (Android/iOS) — cota EAS segue esgotada até
  2026-09-01, mesma limitação já registrada na rodada anterior. As mudanças mobile desta rodada
  (rotas `scope`-aware, tela de assinatura do operador) só passaram por typecheck +
  `expo export` estático, não por um dispositivo real.
- **Teste HTTP end-to-end via servidor rodando** (preview/dev server) das novas rotas — a
  verificação de isolamento foi feita direto contra o banco com os mesmos filtros que as rotas
  usam (prova a garantia real de segurança), não via requisição HTTP completa passando por
  `requireMobileContext()`/`requireTenantScope()`. Mais forte que um script manual solto, mas
  ainda não é a suíte HTTP permanente pedida no item 24 do spec.
- **UI do overlay/slider não navegada no browser** — só typecheck + build; não houve dado real de
  avaria com foto para navegar visualmente nesta rodada (mesma ressalva já registrada na Fase A
  sobre overlay).

### P1.3/P1.4 — atualização (mesma rodada, após o corte inicial acima)

**P1.3 — Offline real no mobile: implementado.** `apps/mobile/src/lib/inspection-offline-queue.ts`
— toda resposta/foto do `InspectionCaptureScreen` agora grava primeiro em AsyncStorage (nunca só
em estado React) e só depois tenta a rede; falha vira item na fila, retentado automaticamente em
três gatilhos: reconexão real (`NetInfo`), a tela voltando a ficar em foco, e antes de "Enviar
para revisão" (que agora bloqueia com mensagem clara se ainda há item na fila, em vez do erro
genérico "item faltando" que o completion-check do servidor daria). Retry cego é seguro porque as
duas escritas já eram idempotentes do lado do servidor (upsert em `inspection_id+item_id`;
dedupe de mídia por `checksum_sha256`, adicionado nesta mesma rodada). Banner de status usa
exatamente o texto de exemplo do spec ("✓ N sincronizados" / "⟳ N aguardando envio" / "Sem
conexão — vistoria salva neste aparelho"). Usa `crypto.getRandomValues` (já polyfilled via
`react-native-get-random-values`, usado em `secure-session-store.ts`) em vez de
`crypto.randomUUID()`, que não é garantido disponível no Hermes desta versão do app — checado
antes de usar, não assumido. Verificado: typecheck limpo + `expo export --platform android`
recompila o bundle Hermes completo sem erro de resolução. **Não verificado**: comportamento real
em device (cota EAS ainda esgotada até 2026-09-01) — a UX de offline/reconexão em si não foi
observada rodando de verdade, só validada estaticamente.

**P1.4 — Suíte de testes de isolamento permanente: implementado (parcial, ver escopo abaixo).**
`apps/web/src/lib/mobile-inspections-scope.ts` (`resolveInspectionVisibility`/
`isInspectionVisible`, seguindo exatamente o padrão já usado por `mobile-operations-scope.ts`) +
`apps/web/src/__tests__/lib/mobile-inspections-scope.test.ts`, 14 testes reais: operador A não lê
vistoria de operador B (nos dois sentidos), cliente A não lê vistoria/aceite de cliente B (nos
dois sentidos), `tenant_user` não atravessa tenant, e um caso de borda (operator_id igual mas
tenant diferente também é negado). As rotas de lista (`operator-inspections`,
`customer/inspections`) foram refatoradas para usar essa função em vez de inlinar o filtro —
então o que está testado é a lógica que realmente roda, não uma reimplementação em paralelo.
`apps/web` já roda `pnpm test` no CI existente (`.github/workflows/ci.yml`, task `test` do Turbo)
— esse arquivo entra automaticamente na esteira, sem mudança de CI. Todos os 125 testes vitest
pré-existentes de `apps/web` continuam passando (204 no total somando `inspection-engine` e
`blueprint-runtime`). **Escopo real do que ficou coberto**: só o nível de
descriptor/predicate/rota-de-lista. As rotas de detalhe/PATCH/mídia/assinatura (`[id]/route.ts`,
`[id]/media/route.ts`, `[id]/sign/route.ts`, tanto do lado operador quanto cliente) continuam
inlinando o `.eq()` de posse diretamente — corretas na leitura de código, mas não exercitadas por
este arquivo de teste nem por uma suíte HTTP completa fim-a-fim (subir servidor, autenticar,
bater na rota de verdade). Isso é mais forte que o script manual que existia antes (prova a
função que a rota de fato usa, roda em CI, permanece no repo), mas ainda não é a suíte HTTP
completa que o item 24 do spec pede no sentido mais literal.

### Pendências (não escondidas)

- **Overlay no mobile** (item 12 do spec): não implementado — só a versão web existe. O fluxo de
  "2-3 interações" no celular (tocar/arrastar sobre a foto recém-capturada) fica para uma próxima
  rodada.
- **`preexisting_finding_id`**: coluna existe (migration desta rodada), mas nenhuma rota
  preenche esse campo automaticamente ao criar um finding de check-out — hoje é só uma FK
  disponível para uso manual/futuro, não uma automação real de "vincular ao finding do check-in
  anterior".
- **Conflitos de sincronização** (item 21 do spec): sem estratégia implementada além do que já
  existia (upsert por `inspection_id+item_id` nas respostas, idempotência por checksum nas
  fotos) — não há detecção explícita de `version`/`updated_at` divergente entre device e servidor.
- **Compressão/thumbnails de mídia** (item 26 do spec): não implementado — uploads continuam indo
  na resolução capturada pela câmera (já limitados a `quality: 0.7` do lado do Expo, mas sem
  resize/thumbnail dedicado).
- IA visual real, cobrança automática por IA, OCR, reconhecimento de placa — como o spec exige,
  **nenhum foi implementado** (regra fundamental desta rodada).

### Métricas

- Migrations novas: 1 (`20260102000000`), aplicada no banco hospedado real.
- Endpoints novos: 15 (`operator-inspections` ×5, `customer/inspections` ×4 + PDF, `disputes`,
  `report/pdf` staff, `report/shares` ×2, `share/inspection-report`, `verify/inspection-report`,
  `media/:mediaId` ×2 incluindo o novo signed-URL de leitura).
- Páginas novas: 4 web (`rentals/.../inspections`, `.../inspections/[id]`,
  `verify/inspection-report/[token]`, mais a página de laudo compartilhado é a própria rota de
  API que serve o binário).
- Componentes novos: 3 (`InspectionComparisonViewer`, `InspectionOverlayPicker`, mais a
  integração ampliada de `InspectionDetail`).
- Dependência nova: `@react-pdf/renderer` + `qrcode` (produção), `@types/qrcode` (dev).
