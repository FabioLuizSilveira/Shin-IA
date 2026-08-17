# Mobile Persona Architecture

Data: 2026-08-17 · Produzido no gate M22, após a decisão de app único
([ADR_UNIFIED_MOBILE_APP.md](../adr/ADR_UNIFIED_MOBILE_APP.md)). Documenta as quatro identidades
resolvidas por `requireMobileContext()` (`apps/web/src/lib/mobile-context.ts`), com base no
comportamento real já implementado nas Waves 0–4, não em suposição.

**Esta é documentação conceitual, não uma tabela de autorização.** O client mobile usa isto para
decidir _o que mostrar_; o backend (`requireMobileContext()` + `hasTenantPermission()` +
queries escopadas por posse) continua a única autoridade de _o que é permitido_. Nenhuma tela deve
decidir sozinha se uma ação é permitida — ela só decide se vale a pena mostrar o botão, e o backend
valida de novo em toda mutação/leitura sensível.

---

## `tenant_user`

- **Identity source**: JWT claim `tenant_id` presente (staff logado normalmente) OU
  `platform_role` presente + sessão de impersonation ativa (`getActiveImpersonation()`) — nunca
  resolvido por consulta a tabela, é a claim injetada server-side pelo `custom_access_token_hook`.
- **Bootstrap behavior**: retorna `tenants` row real, `branding` publicado
  (`StudioRuntime.getPublished("branding", tenantId)` ou `null`), `roles`/`permissions` efetivos
  (`getEffectiveTenantPermissions()` — lista completa se `tenant_owner`/`tenant_admin`, senão só as
  chaves concedidas via `tenant_user_roles`), `entitlements`/`features` do plano comercial da
  Shinã (`getEntitlements()`, produto `"platform"`).
- **Home/dashboard**: `GET /api/mobile/dashboard` — contadores de operações/ativos, resumo
  financeiro (só se `tenant.dashboard.financial`), alertas de `contract.operation_blocked`.
- **Navigation**: shell principal — Dashboard, Operations, Assets, Customers (via
  `/api/organizations`), Operators (via `/api/operators`), Contracts, Documents, Tracking,
  Billing, Reporting, Notifications. Este é o persona para o qual o shell visual do Emergent foi
  desenhado (ver ADR).
- **Permission behavior**: a maioria das rotas staff (`/api/operations`, `/api/assets`,
  `/api/contracts`, `/api/organizations`, `/api/operators`) exige só posse de vínculo com o
  tenant (`requireTenantScope()`), sem checagem de permission key adicional — confirmado na
  auditoria da Wave 4 (nenhuma rota staff de AR/reporting checa permission além de tenant scope).
  Exceções reais que exigem permission catalog: `tenant.dashboard.financial` (dashboard financeiro,
  billing summary/invoices/commissions mobile, reporting KPIs financeiros),
  `tenant.contracts.*`/`tenant.contract_templates.*` (Contract Center), `legal_contracts:accept`,
  `billing_plan:change`.
- **Entitlement behavior**: `features` do bootstrap reflete o plano comercial Shinã do tenant
  (`@shina/commercial-platform`, produto `"platform"`) — controla presença de features de produto
  (ex. módulos avançados), não é usado como autorização de dado individual.
- **Security boundaries**: `requireTenantScope()`/`requireMobileContext()` nunca aceitam
  `tenant_id` do cliente — sempre da claim JWT. Impersonation com `accessMode: "read_only"`
  bloqueia mutações (`isReadOnlyScope()`).

## `customer`

- **Identity source**: consulta real a `rental_customers.auth_user_id = auth.uid()`, e só é
  reconhecido como `customer` se existir **pelo menos um** vínculo em
  `rental_customer_organizations` — um `rental_customers` sem vínculo nenhum resolve como
  `unprovisioned`, nunca "customer vazio".
- **Bootstrap behavior**: `tenant: null` (um cliente pode pertencer a organizações de tenants
  diferentes — N:N — não existe "o" tenant dele), `roles: []`, `permissions: []`,
  `organizations: [{organizationId, tenantId}]` (a lista real de vínculos).
- **Home/dashboard**: sem endpoint de dashboard dedicado hoje — a tela inicial é tipicamente a
  lista de contratos/operações próprias.
- **Navigation**: Contracts (`/api/mobile/contracts`, `/api/mobile/contracts/{id}`, aceite via
  `/api/customer-contracts/{id}/accept`), Documents
  (`/api/customer-contracts/{id}/documents*`), Operations (`/api/mobile/operations`, escopado por
  `resolveOperationsVisibility`), Tracking (`/api/mobile/tracking/{resourceId}/*`, só recursos
  ligados a operações visíveis), Invoices/Billing
  (`/api/mobile/billing/summary`, `/api/mobile/invoices*`, escopado por
  `billing_accounts.organization_id`), Notifications (`/api/mobile/notifications`, por
  `recipient_external_ref = "customer:<id>"`), perfil próprio
  (`/api/mobile/customers/me`).
- **Permission behavior**: **não existe conceito de permission catalog para customer** além de
  `customer.contracts.view`/`customer.contracts.accept` (definidas mas não checadas ativamente nas
  rotas atuais, que usam posse em vez de catálogo). Toda visibilidade é por **posse**
  (`rental_customer_organizations` → organização → recurso), nunca por uma permission key.
- **Entitlement behavior**: nenhum entitlement próprio de customer existe hoje — o que ele vê é
  inteiramente função da posse (organizações a que pertence), não de um plano comercial dele.
- **Security boundaries**: `customer_id`/`organization_id` **nunca** são aceitos de query
  param/body — sempre resolvidos de `context.customerId`/`context.organizations` (derivados da
  sessão). Mesma resposta 404 para "não existe" e "não é seu" (higiene IDOR), em todas as rotas
  desde a Wave 2.

## `operator`

- **Identity source**: consulta a `operators.auth_user_id = auth.uid() AND status = 'active'` — um
  operador inativo ou sem `auth_user_id` (operador cadastrado só administrativamente, sem login
  próprio) resolve como `unprovisioned` quando tenta logar (mas continua existindo administrado
  pelo staff via `/api/operators`).
- **Bootstrap behavior**: `tenant` + `branding` + `entitlements` reais (mesma tenant do vínculo),
  mas `roles: []`/`permissions: []` sempre — operadores não têm `tenant_user_roles`.
- **Home/dashboard**: contadores de `operator_assignments` (via `/api/mobile/dashboard`, branch
  `operator`).
- **Navigation**: Assignments/Operations (`/api/mobile/operations`, escopado por
  `operator_assignments.operation_id`), Assets (`/api/mobile/assets`, escopado por
  `operator_assignments.asset_id`), Tracking (`/api/mobile/tracking/*`, recursos das operações
  atribuídas), Documents (`contract_documents` com `party_type = "operator"`, quando aplicável),
  Notifications (`/api/mobile/notifications`, `recipient_external_ref = "operator:<id>"`), perfil
  próprio (`/api/mobile/operators/me`).
- **Permission behavior**: idêntico a customer — sem permission catalog, tudo por posse via
  `operator_assignments`.
- **Entitlement behavior**: herda os `entitlements`/`features` do tenant (informativo), não tem
  entitlement próprio.
- **Security boundaries**: mesma disciplina de posse-como-fronteira e 404 uniforme das rotas de
  customer.

## `unprovisioned`

- **Identity source**: usuário autenticado (`auth.uid()` válido) sem linha correspondente em
  `rental_customers`(+ vínculo)/`operators`(ativo), e sem `tenant_id`/`platform_role`+impersonation
  na claim. Caminho real e esperado: auto-cadastro via Google OAuth (o único fluxo que ainda cria
  `auth.users` sem convite — `shouldCreateUser: false` bloqueia isso para magic-link, Wave 0).
- **Bootstrap behavior**: `tenant: null`, `branding: {"name": "Shinã"}` (`DEFAULT_BRANDING`
  hardcoded), `roles/permissions/entitlements/features/organizations` todos vazios.
- **Home/dashboard**: nenhum — toda rota `/api/mobile/*` de dado operacional responde `403` para
  este `userType`, sem exceção, confirmado em cada endpoint construído desde a Wave 2.
- **Navigation**: tela de estado ("conclua seu convite/onboarding" ou "saia da conta") — nunca uma
  tela operacional.
- **Permission behavior**: nenhuma — por construção, não há nada operacional a autorizar.
- **Entitlement behavior**: nenhum.
- **Security boundaries**: o client nunca deve tentar criar tenant/membership/role automaticamente
  a partir deste estado (ver M22.11) — isso é sempre um fluxo administrado pelo staff (convite) ou
  pendente de implementação futura de auto-onboarding autorizado, não uma ação client-side.

---

## Capability Matrix

| Capability    | Tenant User | Customer    | Operator     | Unprovisioned |
| ------------- | ----------- | ----------- | ------------ | ------------- |
| Dashboard     | conditional | conditional | conditional  | no            |
| Operations    | conditional | own         | assigned     | no            |
| Assets        | permission  | related     | assigned     | no            |
| Customers     | permission  | self only   | no           | no            |
| Operators     | permission  | no          | self         | no            |
| Contracts     | permission  | own         | conditional  | no            |
| Documents     | permission  | own         | own/assigned | no            |
| Tracking      | permission  | related     | assigned     | no            |
| Billing       | permission  | own         | no           | no            |
| Reporting     | permission  | no          | no           | no            |
| Notifications | yes         | yes         | yes          | limited       |

"conditional"/"permission" nesta tabela significa: gated por `tenant.dashboard.financial` (Billing,
Reporting financeiro) ou por posse de vínculo tenant (a maioria das demais). "own"/"related"/
"assigned"/"self only"/"self" significam: escopado por posse real (`rental_customer_organizations`,
`operator_assignments`), nunca por uma permission key própria de customer/operator (nenhuma existe
hoje, ver seções acima). Esta tabela **não deve virar uma tabela de autorização hardcoded no
client** — é um guia de navegação; a fonte de verdade continua sendo a resposta real do backend a
cada chamada.
