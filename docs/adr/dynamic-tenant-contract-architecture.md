# ADR — Dynamic Tenant Contract Architecture

**Status**: Accepted · **Date**: 2026-08-15

## Contexto

O sistema não tinha nenhuma engine de contrato operacional. `contracts` (M27,
`supabase/migrations/20260013000000_contracts.sql`) é um registro CRUD plano — `type`, `status`,
valor, período — sem cláusulas, sem versionamento real, sem aceite, sem snapshot.
`rental_customers`/`rental_customer_organizations` modela a identidade Tenant×Cliente e dá acesso
via RLS, mas sem nenhum conceito de acordo jurídico. O pacote `commercial-platform` (assinatura
Tenant↔Shinã) tem o padrão certo — template/versão/snapshot/aceite — mas é 1:1 por produto
(`platform`/`mkt`), incompatível com N templates configuráveis por Tenant/Blueprint/tipo de
operação.

## Decisão

Construir `packages/tenant-contract-engine`, um motor de resolução dinâmica de contrato — nunca
um contrato universal — parametrizado por `partyType: "customer" | "operator"`, reaproveitando o
mesmo motor para as duas relações em vez de duplicar a engine inteira.

### Contratos por Blueprint

`blueprint_contract_mappings` (tabela, não código) liga cada um dos 10 blueprints reais
(`packages/blueprint-runtime/src/built-ins.ts`) a um ou mais `contract_template_key`, com um
default por blueprint. O resolver (`TenantContractRequirementResolver`) nunca cai num contrato
universal por omissão — blueprint sem mapping é erro explícito
(`NoContractMappingError`), não fallback silencioso.

### Cláusulas condicionais

Formato jsonb declarativo (`{field, op, value}`), avaliado por `evaluateCondition()` — puro,
testável isoladamente, sem DSL nova. Cláusulas mandatórias sempre entram; condicionais entram
conforme o contexto de renderização. Categorias PRIVACY/CONSUMER_RIGHTS são protegidas: o
resolver as força a entrar quando `consumer_relationship != "business"`, mesmo que um Tenant
tente configurá-las como opcionais — nunca removível por configuração (item 17 do spec original).

### Snapshots imutáveis

`tenant_contract_versions` nunca sofre UPDATE após `published` (nova versão = nova linha).
`tenant_contract_snapshots` é o registro imutável do que foi de fato apresentado/aceito por um
contrato específico — `recordContractAcceptance()` valida que `contractVersionId`/`snapshotId`
recebidos batem exatamente com o que está gravado em `contracts.template_version_id`/
`snapshot_id`, rejeitando qualquer tentativa de aceitar contra uma versão diferente da que foi
resolvida para aquele contrato (fechado na Fase K após teste de segurança revelar a lacuna).

### Acceptance gate na Operação

`OperationContractGate` se pendura na transição real `pending → in_progress` de `operations`
(os estados `approved`/`scheduled` do spec original não existem no `operation_status` enum real
de 5 estados — mapeamento consciente, documentado, não um gap). Agrega três checks: aceite do
cliente, documentos obrigatórios aprovados, exigência de billing satisfeita. **Só o lado cliente
gateia** — decisão explícita do usuário: operador é tipicamente funcionário do Tenant ou o
próprio dono do equipamento, então aceite/reconhecimento de operador nunca bloqueia liberação de
operação, é só registro/documentação no Contract Center.

### Separação Tenant×Cliente / Tenant×Operador

`party_type` no template e na tabela de aceites separa as duas relações por construção — nunca
misturadas automaticamente (item 19). `OperatorTerms` usa `acceptance_method:
"operator_acknowledgement"` (não `"clickwrap"`) quando o staff registra em nome de um operador
sem conta própria — nomenclatura deliberadamente distinta de um aceite real do próprio operador.

### Documentos obrigatórios

Bucket privado novo (`contract-documents`, primeiro bucket privado do projeto — o único existente
antes, `tenant-branding`, é público). Sem RLS em `storage.objects` (mesmo padrão do bucket
público — autenticação só na API route), retrieval via `createSignedUrl()`.

### Billing — registro/controle apenas

Sem checkout Stripe cliente→tenant nesta rodada (decisão do usuário). `billing_requirement` no
contrato gera automaticamente uma linha em `invoices` (M29, AR já existente) ao aceitar; o Tenant
confirma pagamento manualmente na tela de billing já existente. O gate só lê `invoices.paid_at`.

## Consequências

- Reaproveita 100% da infraestrutura de IAM (`hasTenantPermission`), RLS (mesmo padrão
  select-only-por-tenant-JWT + cadeia de subquery por `auth.uid()` já usada em
  `rental_customers`), auditoria (`logActivity`) e o módulo de AR (`invoices`) já existentes —
  nenhuma engine nova de billing/IAM/audit foi criada.
- Marketplace, Stripe real para depósito, e-signature externa: fora de escopo, colunas/enum
  values inertes deixados como pontos de extensão documentados, não esquecidos.
- `contracts.organization_id` passou a nullable (Fase I) para acomodar `OperatorTerms`, que não
  tem contraparte de organização — mesmo padrão já usado para `commercial_terms_snapshots.tenant_id`
  nullable (comprador só-MKT) na rodada anterior desta sessão.
