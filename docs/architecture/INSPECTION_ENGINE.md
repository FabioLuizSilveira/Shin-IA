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

_Em andamento — atualizado ao final da fase._
