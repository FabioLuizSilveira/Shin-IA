# Relatório Final — Tenant × Customer / Tenant × Operator Contract Engine

Data: 2026-08-15 · Branch: `release/v1.0-platform` · Status: **implementado e verificado, ainda não commitado**

---

## 1. Arquitetura criada

`packages/tenant-contract-engine` (novo) fica acima do schema de contratos, orquestrando:
resolução dinâmica → renderização de cláusulas → snapshot imutável → aceite → gate de operação.
Parametrizado por `partyType: "customer" | "operator"` — uma engine, duas relações, nunca
duplicada. Ver [ADR](docs/adr/dynamic-tenant-contract-architecture.md) para as decisões de design
completas.

## 2. Templates suportados

`VehicleRentalAgreement`, `EquipmentRentalAgreement`, `EquipmentWithOperatorAgreement`,
`ServiceProvisionAgreement` (customer) + `OperatorTerms` (operator) — os 4 do spec original mais
o quinto adicionado por decisão do usuário para cobrir Tenant×Operador. Todos globais (`tenant_id
null`), com possibilidade de override por tenant (schema já suporta, UI de clonagem não construída
nesta rodada — só visualização + publicação de nova versão).

## 3. Clause Library

25 categorias seedadas (GENERAL até CONSUMER_RIGHTS), uma cláusula placeholder por categoria,
versionadas (`tenant_contract_clauses`, `version` int, `status`). Texto jurídico é placeholder —
mesma ressalva já usada para os contratos comerciais da rodada anterior.

## 4. Contract Resolver

`TenantContractRequirementResolver.resolve()` — entrada exatamente os campos do item 7 do spec
original (tenant, blueprint, asset type, operation type, operator flags, tracking, insurance,
pricing, jurisdiction) mais `consumerRelationship`/`dataProcessingLegalBasis` como **configuração
jurídica explícita, nunca inferida**. Blueprint sem mapping → `NoContractMappingError`, nunca
fallback para contrato universal. `blueprint_contract_mappings` cobre os 10 blueprints reais
(`packages/blueprint-runtime/src/built-ins.ts`), não os 5 valores simplificados do onboarding.

## 5. Acceptance Flow

Cliente: tela em `apps/web/src/app/(customer)/rentals/[id]/contract/page.tsx`, dois checkboxes
não pré-marcados ("li e aceito" sempre; segundo checkbox só vira "autorizo tratamento de dados"
quando a base jurídica configurada é de fato `consent` — nos outros casos é só "li o aviso de
privacidade", correção pedida pelo usuário). `accepted_at`/`ip_address`/`user_agent` sempre
carimbados pelo backend. **Validação de integridade fechada na Fase K**: `recordContractAcceptance()`
rejeita qualquer tentativa de aceitar com `contractVersionId`/`snapshotId` que não bata
exatamente com o que está gravado na `contracts` row — testado e confirmado.

Operador: `apps/web/src/app/(tenant)/tenant/operators/page.tsx`, botão "Reconhecer Termos" —
`acceptance_method: "operator_acknowledgement"`, nomeado à parte de `clickwrap` de propósito para
nunca ser confundido com assinatura real do operador.

## 6. Billing Integration

Registro/controle apenas (decisão do usuário) — reaproveita `invoices`/`billing_accounts` (M29,
AR já existente). Ao aceitar um contrato com `billing_requirement.type !== "none"`, uma invoice é
criada automaticamente; o Tenant confirma pagamento manualmente na tela de billing já existente;
o gate só lê `invoices.paid_at`. Sem checkout Stripe cliente→tenant nesta rodada.

## 7. Operation Gate

`OperationContractGate` pendurado em `PATCH /api/operations/[id]` na transição real
`pending → in_progress` (os estados `approved`/`scheduled` do spec original não existem no
`operation_status` enum real de 5 estados — mapeamento consciente e documentado). Agrega aceite +
documentos aprovados + billing satisfeito. **Só o lado cliente gateia** — decisão explícita do
usuário: operador é tipicamente funcionário do Tenant ou dono do próprio equipamento, nunca
bloqueia liberação de operação.

## 8. IAM

`tenant.contract_templates.view/create/edit/publish`, `tenant.contracts.view/cancel/audit`,
`customer.contracts.view/accept` seedados e concedidos por padrão a `tenant_owner`/
`tenant_admin` em todos os tenants existentes, aplicados em runtime via `hasTenantPermission()`
(mesmo padrão já confirmado nesta sessão) nas rotas de `contract-templates`.

## 9. RLS

Tenant vê só seus próprios contratos/aceites/documentos (`tenant_id = jwt claim`). Cliente vê só
os seus, via a mesma cadeia de subquery (`rental_customer_organizations` → `rental_customers` →
`auth.uid()`) já estabelecida para `rental_customers`. Operador com conta própria vê só os seus
(`operators.auth_user_id = auth.uid()`). Catálogo global de cláusulas/templates: legível por
qualquer usuário autenticado, **não** anônimo — desvio deliberado do padrão público do
`commercial-platform` (biblioteca jurídica interna, não catálogo de marketing). Cross-tenant
testado e confirmado bloqueado (Fase K).

## 10. UI criada

- Cliente: aceite de contrato + upload de documentos (`rentals/[id]/contract`), lista de
  contratos (`rentals/contracts`).
- Tenant: fila de revisão de documentos (dentro de `ContractDetail`), cadastro de operadores +
  reconhecimento de termos (`tenant/operators`), templates/cláusulas/versões + publicar nova
  versão (`tenant/settings/legal/contract-templates`).

## 11. Testes

30 testes unitários (vitest) no `tenant-contract-engine` — `evaluateCondition` (todos os
operadores), `ContractTemplateEngine.render` (mandatória/condicional/força de consumidor/hash),
`TenantContractRequirementResolver` (global vs. override, erro sem mapping, auditoria),
`recordContractAcceptance`/`hasAcceptedContract` (customer/operator, **4 casos de rejeição**:
sem customerId, versão divergente, snapshot divergente, contrato inexistente), `OperationContractGate`
(bloqueado por cada motivo isoladamente, liberado quando todos passam, **nunca bloqueado por
aceite de operador ausente**). Todos verificados também contra o banco hospedado real em cada
fase (10 rodadas de scripts Node, sempre limpando os dados de teste depois).

## 12. Cobertura

Cada uma das 11 fases (A–K) foi verificada end-to-end contra o banco Supabase hospedado real
antes de avançar para a próxima, seguindo a mesma disciplina de verificação já estabelecida nesta
sessão — nunca só typecheck. `pnpm --filter @shina/web typecheck` limpo em todas as fases;
`next build` confirmado no início e ao final da sequência.

## 13. Pendências

- UI de clonagem de template por Tenant (copiar o template global, editar cláusulas próprias,
  publicar) — schema pronto (`tenant_id` não-nulo em `tenant_contract_templates`), UI construída
  só para visualização + publicar nova versão do template existente.
- Documentos obrigatórios: seedados só para `VehicleRentalAgreement` (CNH) e
  `EquipmentWithOperatorAgreement` (certificação) — fechando a lacuna identificada na pesquisa
  (`requires_cnh_category_b`/`requires_certified_operator` nos manifests de blueprint, antes
  desconectados). Os demais templates não têm documento obrigatório seedado (o Tenant pode
  adicionar via `contract_document_requirements` diretamente).
- `POST /api/operations` (criação) não bloqueia por falta de contrato — só o `PATCH` que libera
  a operação (`pending → in_progress`) gateia. Suficiente para o princípio central do spec
  ("nenhuma operação inicia sem aceite"), mas uma criação antecipada e nunca liberada não é
  bloqueada na origem.

## 14. Riscos jurídicos/técnicos encontrados

- Texto jurídico de todas as cláusulas é placeholder — jurídico da Shinã revisa antes de produção.
- Depósito/pagamento é só registro — Tenant ainda precisa confirmar pagamento manualmente; não há
  cobrança automática.
- Operador sem conta própria depende de staff registrar reconhecimento em seu nome — não é
  assinatura eletrônica real nesse caso, é registro administrativo (nomenclatura distinta
  `operator_acknowledgement` evita que isso seja mal-interpretado como aceite do próprio operador).
- Marketplace: colunas inertes em `contracts` (`marketplace_transaction_id`/`provider_tenant_id`/
  `requester_id`), sem lógica — reintegrar quando houver gatilho de produto real (nenhuma tabela
  de marketplace sobreviveu ao arquivamento de `packages/marketplace`).
- **Vulnerabilidade real encontrada e corrigida durante os testes de segurança da Fase K**:
  `recordContractAcceptance()` originalmente não validava que `contractVersionId`/`snapshotId`
  enviados batiam com o que foi de fato resolvido/gerado para aquele contrato — um cliente
  poderia, em tese, aceitar contra uma versão diferente da apresentada. Corrigido antes do
  commit: a função agora re-deriva esses valores da própria linha de `contracts` e rejeita
  qualquer divergência. Testado (3 novos testes unitários + script live contra o banco hospedado).

## 15. Confirmação

Nenhuma operação sujeita a contrato obrigatório inicia sem aceite válido do cliente — confirmado
por teste live contra o banco hospedado (bloqueado sem aceite → bloqueado com aceite mas sem
documento aprovado → liberado só com aceite + documentos aprovados + billing satisfeito). O
mesmo teste confirma explicitamente que a ausência de aceite/reconhecimento do **operador**
nunca bloqueia, por decisão de produto documentada.

---

## Estado do trabalho

4 migrations aplicadas ao Supabase hospedado (`20260076` a `20260081`). Pacote
`packages/tenant-contract-engine` (novo, 30 testes) e todas as mudanças em `apps/web`
verificadas — typecheck e build confirmados. Nada commitado ainda — aguardando confirmação do
usuário para commit e deploy, mesmo padrão desta sessão.
