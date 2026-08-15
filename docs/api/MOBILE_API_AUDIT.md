# Mobile API Audit — Shinã Backend

Data: 2026-08-15 · Auditoria completa do backend real, fonte de verdade para `mobile-openapi.yaml`.

**Metodologia**: 5 agentes de exploração leram o código real (rotas, migrations, middleware, packages) em
paralelo. Nenhuma linha deste documento representa um endpoint proposto como implementado — a coluna
Status distingue os quatro estados definidos no prompt original. Onde a auditoria não conseguiu confirmar
um detalhe com confiança, isso está marcado explicitamente (não foi adivinhado).

---

## 1. Apps do monorepo

| App                                 | Package                | Framework                                           | Papel                                                                                                                                                                       |
| ----------------------------------- | ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                          | `@shina/web`           | Next.js (porta 3002)                                | App tenant-facing atual — **onde vive hoje toda a lógica de negócio real** (IAM, tenant context, RLS-bypass manual, ~90 rotas de API)                                       |
| `apps/mkt`                          | `@shina/mkt`           | Next.js (porta 3003)                                | Site de marketing/vendas MKT                                                                                                                                                |
| `apps/api`                          | `@shina/api`           | Fastify standalone, deploy Railway (`railway.toml`) | **Casca vazia** — hoje só expõe `GET /health`. É o alvo arquitetural do diagrama do usuário (`api.shinaia.com.br`), mas nenhuma lógica de domínio foi portada para cá ainda |
| `apps/mobile`                       | `@shina/mobile`        | Expo ~56 / React Native 0.85.3                      | App React Native atual — **fala direto com Supabase PostgREST, nunca chama nenhuma API Next.js ou o `apps/api`**                                                            |
| `apps/admin-web`, `apps/tenant-web` | — (sem `package.json`) | —                                                   | Diretórios vazios/obsoletos — não são apps ativos, confirmado (só `.env.local`/`.turbo`/`coverage`/`node_modules`)                                                          |

## 2. Packages relevantes (com `src/` real)

| Package                                                     | Responsabilidade                                                                                              | Exposição via API                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `billing-platform`                                          | `BillingProvider` (Stripe), sync de webhook, claims de assinatura                                             | Consumido por rotas `/api/commercial/*`, `/api/invoices/*`                                                     |
| `commercial-platform`                                       | Contratos Tenant↔Shinã (assinatura platform/mkt) — templates, snapshots, aceite                               | Consumido por `/api/commercial/*`, `/api/onboarding/*`                                                         |
| `tenant-contract-engine`                                    | Contratos Tenant↔Cliente / Tenant↔Operador (locação/serviço) — resolver dinâmico, gate de operação            | Consumido por `/api/contracts/*`, `/api/customer-contracts/*`, `/api/operators/*`, `/api/contract-templates/*` |
| `tracking-engine`                                           | Modelo canônico de posição/telemetria + engine de geofence                                                    | Consumido por `apps/web/src/lib/geofence-repository.ts`, webhook de ingestão                                   |
| `blueprint-runtime`                                         | Catálogo em memória de blueprints (rental-cars, forklift, crane, etc.)                                        | Consumido por `/api/blueprints/*`                                                                              |
| `commission-engine`                                         | Cálculo de comissões                                                                                          | Consumido por `/api/commissions/*`                                                                             |
| `reporting-engine`                                          | KPIs com tendência (`KpiEngine`)                                                                              | Consumido por `/api/tenant-reports`                                                                            |
| `resource-engine`                                           | Prevenção de overbooking de recursos                                                                          | Consumido por `/api/operations`, `/api/resources`                                                              |
| `authorization`, `iam-domain`, `iam-repository`, `security` | Catálogo IAM real, coerentes mas **deliberadamente não forçados** (ver `hasTenantPermission()` só em 6 rotas) | Parcial                                                                                                        |
| `notification-engine`                                       | Modelo de notificação                                                                                         | Consumido por `apps/web/src/lib/notifications/create-notification.ts`                                          |
| `database`                                                  | Tipos gerados do schema Supabase                                                                              | Interno                                                                                                        |

**Arquivados (só `dist`/`node_modules`, sem `src`)**: `auth`, `billing-engine`, `domain`, `marketplace`, `rule-engine`, `workflow-engine` — confirmado em disco, consistente com o audit de 2026-07-31 já registrado em `CLAUDE.md`.

## 3. Documentação existente

`docs/` já contém uma quantidade grande de documentos (`ARCHITECTURE.md`, `DATABASE.md`, `IAM.md`,
`AUTHORIZATION_MODEL.md`, `RLS_POLICIES.md`, `PERMISSIONS_MATRIX.md`, `TENANT_IAM.md`,
`CANONICAL_DATA_MODEL.md`, entre outros) — **a atualidade desses documentos frente ao código real não foi
verificada nesta auditoria** (fora de escopo dado o volume; `CLAUDE.md` já registra precedente de drift
significativo entre documentação e implementação real neste projeto — mesma cautela se aplica aqui).
`docs/adr/` tem 1 ADR (`dynamic-tenant-contract-architecture.md`). **Nenhum arquivo OpenAPI/Swagger
pré-existente foi encontrado em todo o repositório** (busca case-insensitive por `openapi`/`swagger` em
`.yaml`/`.yml`/`.json`, excluindo `node_modules`/`dist`, achou só uma coincidência incidental num artefato
de coverage de testes).

## 4. `apps/mobile` — estado real

- Expo ~56, React Native 0.85.3, React 19.2.3, `@supabase/supabase-js ^2.38.0`, `@react-navigation/native`.
- 3 telas: `LoginScreen`, `RentalsListScreen`, `RentalDetailScreen`.
- **Zero chamadas `fetch()` a qualquer API** — confirmado por grep, retorno zero. Todo acesso a dado é via
  `supabase.from(...)`/`supabase.auth.*`, com comentário explícito no código: _"Mobile talks directly to
  PostgREST... there is no Next.js API layer."_
- Login: OAuth Google + magic-link email **self-service** (qualquer e-mail pode se cadastrar via OTP) —
  não é gated por convite de staff como a memória do projeto assumia. Deep link (`shinacustomer://`)
  validado (fix de segurança já aplicado nesta base, comentário "MÉD-12").
- Tabelas consultadas diretamente: `contracts`, `rental_customers`, `rental_service_requests`.

## 5. Inventário de endpoints

Legenda de Auth: **TS** = `requireTenantScope()` (staff do tenant, claim JWT `tenant_id`) · **SU** =
sessão Supabase direta via `supabase.auth.getUser()`/`getSession()` (cliente/operador, sem claim de
tenant) · **PR** = `requirePlatformRole()` (staff da plataforma) · **PUBLIC** = sem sessão exigida ·
**S2S** = servidor-a-servidor (assinatura/token, não para mobile).

### Auth/Sessão

| Method | Path                         | Auth                 | Permission | Status                              |
| ------ | ---------------------------- | -------------------- | ---------- | ----------------------------------- |
| POST   | /api/auth/mfa/enroll         | SU                   | —          | IMPLEMENTED                         |
| POST   | /api/auth/mfa/confirm        | SU (aal2)            | —          | IMPLEMENTED                         |
| POST   | /api/auth/mfa/recovery       | SU                   | —          | IMPLEMENTED                         |
| POST   | /api/auth/mfa/recovery-codes | SU                   | —          | IMPLEMENTED                         |
| GET    | /api/impersonation/status    | SU                   | —          | INTERNAL_ONLY (staff da plataforma) |
| POST   | /api/impersonation/start     | SU + `platform_role` | —          | INTERNAL_ONLY                       |
| POST   | /api/impersonation/end       | SU                   | —          | INTERNAL_ONLY                       |

### Onboarding

| Method | Path                     | Auth | Permission                                  | Status                               |
| ------ | ------------------------ | ---- | ------------------------------------------- | ------------------------------------ |
| GET    | /api/onboarding/status   | SU   | ownership via `checkout_session_references` | IMPLEMENTED (não mobile — fluxo web) |
| POST   | /api/onboarding/complete | SU   | —                                           | IMPLEMENTED (não mobile — fluxo web) |

### Operations

| Method | Path                     | Auth | Permission | Status      |
| ------ | ------------------------ | ---- | ---------- | ----------- |
| GET    | /api/operations          | TS   | —          | IMPLEMENTED |
| POST   | /api/operations          | TS   | —          | IMPLEMENTED |
| GET    | /api/operations/{id}     | TS   | —          | IMPLEMENTED |
| PATCH  | /api/operations/{id}     | TS   | —          | IMPLEMENTED |
| GET    | /api/operations/calendar | TS   | —          | IMPLEMENTED |

### Assets & Asset Types

| Method | Path             | Auth | Permission | Status      |
| ------ | ---------------- | ---- | ---------- | ----------- |
| GET    | /api/assets      | TS   | —          | IMPLEMENTED |
| POST   | /api/assets      | TS   | —          | IMPLEMENTED |
| PATCH  | /api/assets/{id} | TS   | —          | IMPLEMENTED |
| GET    | /api/asset-types | TS   | —          | IMPLEMENTED |
| POST   | /api/asset-types | TS   | —          | IMPLEMENTED |

### Resources

| Method | Path                     | Auth | Permission | Status                                                 |
| ------ | ------------------------ | ---- | ---------- | ------------------------------------------------------ |
| GET    | /api/resources           | TS   | —          | IMPLEMENTED                                            |
| POST   | /api/resources           | TS   | —          | IMPLEMENTED                                            |
| PATCH  | /api/resources/{id}      | TS   | —          | IMPLEMENTED                                            |
| GET    | /api/resources/locations | TS   | —          | PARTIAL — só última posição por recurso, sem histórico |

### Contratos (Tenant×Cliente/Operador)

| Method          | Path                                       | Auth                 | Permission                                                            | Status                                                                              |
| --------------- | ------------------------------------------ | -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET             | /api/contracts                             | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| POST            | /api/contracts                             | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| GET             | /api/contracts/{id}                        | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| PATCH           | /api/contracts/{id}                        | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| GET/POST        | /api/contracts/{id}/customers              | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| GET/POST/DELETE | /api/contracts/{id}/assets                 | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| GET             | /api/contracts/{id}/documents              | TS                   | —                                                                     | IMPLEMENTED (staff, com signed URL)                                                 |
| PATCH           | /api/contracts/{id}/documents/{documentId} | TS                   | —                                                                     | IMPLEMENTED                                                                         |
| GET             | /api/contract-templates                    | TS                   | `tenant.contract_templates.view`                                      | IMPLEMENTED                                                                         |
| GET             | /api/contract-templates/{id}               | TS                   | `tenant.contract_templates.view`                                      | IMPLEMENTED                                                                         |
| POST            | /api/contract-templates/{id}/publish       | TS                   | `tenant.contract_templates.publish`                                   | IMPLEMENTED                                                                         |
| POST/GET        | /api/customer-contracts/{id}/documents     | SU (rental customer) | verificação manual `rental_customers`→`rental_customer_organizations` | IMPLEMENTED — **sem rota de download com signed URL para o cliente** (só metadados) |
| POST            | /api/customer-contracts/{id}/accept        | SU                   | verificação manual da mesma cadeia                                    | IMPLEMENTED                                                                         |

### Organizações/Clientes

| Method | Path                    | Auth | Permission | Status      |
| ------ | ----------------------- | ---- | ---------- | ----------- |
| GET    | /api/organizations      | TS   | —          | IMPLEMENTED |
| POST   | /api/organizations      | TS   | —          | IMPLEMENTED |
| PATCH  | /api/organizations/{id} | TS   | —          | IMPLEMENTED |

### Operadores

| Method | Path                                  | Auth | Permission | Status      |
| ------ | ------------------------------------- | ---- | ---------- | ----------- |
| GET    | /api/operators                        | TS   | —          | IMPLEMENTED |
| POST   | /api/operators                        | TS   | —          | IMPLEMENTED |
| PATCH  | /api/operators/{id}                   | TS   | —          | IMPLEMENTED |
| POST   | /api/operators/{id}/acknowledge-terms | TS   | —          | IMPLEMENTED |

### Tracking

| Method       | Path                                  | Auth                        | Permission | Status                                                          |
| ------------ | ------------------------------------- | --------------------------- | ---------- | --------------------------------------------------------------- |
| POST         | /api/webhooks/fleet-location/{token}  | S2S (token + HMAC opcional) | —          | IMPLEMENTED (não mobile)                                        |
| GET/POST     | /api/geofences                        | TS                          | —          | IMPLEMENTED                                                     |
| PATCH/DELETE | /api/geofences/{id}                   | TS                          | —          | IMPLEMENTED                                                     |
| —            | histórico de posições por dispositivo | —                           | —          | **MISSING** — nenhuma rota retorna histórico, só última posição |

### Billing/Faturas

| Method | Path                                                  | Auth                        | Permission               | Status                                                                                     |
| ------ | ----------------------------------------------------- | --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| GET    | /api/commercial/plans                                 | **PUBLIC**                  | —                        | IMPLEMENTED                                                                                |
| GET    | /api/commercial/contract                              | **PUBLIC**                  | —                        | IMPLEMENTED                                                                                |
| GET    | /api/commercial/subscription                          | TS                          | —                        | IMPLEMENTED                                                                                |
| GET    | /api/commercial/plan-change                           | TS                          | —                        | IMPLEMENTED                                                                                |
| POST   | /api/commercial/plan-change                           | TS                          | `billing_plan:change`    | IMPLEMENTED                                                                                |
| POST   | /api/commercial/portal                                | TS                          | —                        | IMPLEMENTED                                                                                |
| GET    | /api/commercial/acceptances                           | TS                          | —                        | IMPLEMENTED                                                                                |
| GET    | /api/commercial/acceptances/{id}                      | TS                          | —                        | IMPLEMENTED                                                                                |
| POST   | /api/commercial/accept                                | TS                          | `legal_contracts:accept` | IMPLEMENTED                                                                                |
| GET    | /api/invoices                                         | TS (ou SU+`scope=platform`) | —                        | IMPLEMENTED — leitura segura para mobile                                                   |
| GET    | /api/invoices/{id}                                    | TS                          | —                        | IMPLEMENTED                                                                                |
| PATCH  | /api/invoices/{id}                                    | TS                          | —                        | IMPLEMENTED                                                                                |
| POST   | /api/invoices/{id}/checkout                           | TS                          | —                        | IMPLEMENTED — preço sempre resolvido server-side de `invoices.total_amount`, nunca do body |
| POST   | /api/webhooks/stripe, /api/webhooks/stripe-commercial | S2S                         | —                        | IMPLEMENTED (não mobile)                                                                   |
| POST   | /api/platform-legal/manual-activation                 | PR                          | —                        | INTERNAL_ONLY                                                                              |

### Notificações

| Method | Path                   | Auth | Permission | Status                                                                                                                                                           |
| ------ | ---------------------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /api/notifications     | TS   | —          | PARTIAL — hoje é broadcast por tenant (`recipient_external_ref: "tenant:<id>"`), **não há targeting por usuário** apesar da coluna `person_id` existir no schema |
| PATCH  | /api/notifications     | TS   | —          | PARTIAL — mesma limitação                                                                                                                                        |
| —      | registro de push token | —    | —          | **MISSING** — nenhuma tabela/rota de device token em todo o repositório                                                                                          |

### Relatórios/Dashboard

| Method | Path                 | Auth | Permission | Status      |
| ------ | -------------------- | ---- | ---------- | ----------- |
| GET    | /api/tenant-metrics  | TS   | —          | IMPLEMENTED |
| GET    | /api/tenant-reports  | TS   | —          | IMPLEMENTED |
| GET    | /api/tenant-activity | TS   | —          | IMPLEMENTED |

### Comissão

| Method   | Path                                                                                  | Auth | Permission | Status                                                                      |
| -------- | ------------------------------------------------------------------------------------- | ---- | ---------- | --------------------------------------------------------------------------- |
| GET/POST | /api/commissions/{campaigns,plans,rules,settlements,targets,transactions} + sub-rotas | TS   | —          | IMPLEMENTED (baixa prioridade mobile — provavelmente não necessário no MVP) |

### Tenant Settings/Studio/IAM

| Method          | Path                                                            | Auth | Permission | Status                                                                                                           |
| --------------- | --------------------------------------------------------------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| GET/PATCH       | /api/tenant-settings/{company,profile,fleet-integration}        | TS   | —          | IMPLEMENTED                                                                                                      |
| GET/POST/DELETE | /api/tenant-settings/{permissions,roles,roles/{id}/permissions} | TS   | —          | IMPLEMENTED (não mobile — admin web)                                                                             |
| GET/PUT/POST    | /api/tenant-studio/{type}, .../publish, .../versions            | TS   | —          | IMPLEMENTED (não mobile)                                                                                         |
| POST            | /api/tenant-studio/branding/upload                              | TS   | —          | IMPLEMENTED — **este é o padrão de upload a reaproveitar para mobile** (multipart, nunca signed-URL client-side) |

### Documentos (armazenamento)

| Bucket               | Público | Limite | Padrão                                                                                                                                                  |
| -------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant-branding`    | sim     | 2 MiB  | upload via API route, retorna URL pública                                                                                                               |
| `contract-documents` | não     | 10 MiB | upload via API route (multipart), **sem rota de download com signed URL para o lado cliente** (só o lado staff tem, em `/api/contracts/{id}/documents`) |

### Não classificados nesta rodada (precisam de leitura direta antes de entrar no OpenAPI como `implemented`)

`/api/branches`, `/api/blueprints*`, `/api/ai/insights`, `/api/export`, `/api/support-messages` — auth
confirmada como TS por grep, mas comportamento/descrição não lidos linha a linha nesta auditoria. Não
incluídos no OpenAPI desta rodada para não arriscar descrição incorreta.

### Plataforma (fora do escopo mobile do tenant, listado por completude)

`/api/platform-settings/*`, `/api/platform-support/*`, `/api/tenants`, `/api/tenants/{id}` — todos
`PR` (`requirePlatformRole()`), staff da Shinã, não relevantes para o app mobile de tenant/cliente/operador.

## 6. Capability Matrix (Fase 5)

| Capability                                                               | Status      | Nota                                                                                                               |
| ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Bootstrap (user/tenant/branding/roles/permissions/entitlements/features) | **MISSING** | Não existe rota única — precisaria agregar `jwt-claims` + várias tabelas. Ver Gap MOB-001.                         |
| Dashboard (KPIs/operações/ativos/alertas)                                | PARTIAL     | `/api/tenant-metrics` existe mas é web-oriented, não testado para payload mobile-friendly                          |
| Operations (list/detail/lifecycle)                                       | IMPLEMENTED | Cobertura completa para tenant staff                                                                               |
| Assets (list/detail/availability)                                        | IMPLEMENTED | —                                                                                                                  |
| Operators (list/detail/certifications)                                   | IMPLEMENTED | Sem endpoint de "availability"/assignments dedicado — `operator_assignments` existe na tabela mas sem rota própria |
| Customers (list/detail/operations/contracts)                             | PARTIAL     | Organizations sim; não há rota "GET meus contratos" fora do padrão RLS-direto que o app mobile já usa              |
| Contracts (list/detail/accept/evidence/PDF)                              | PARTIAL     | Aceite real e seguro implementado; **sem PDF/download de evidência para o cliente**                                |
| Documents (list/upload/download/approve)                                 | PARTIAL     | Upload sim; download com signed URL só do lado staff                                                               |
| Tracking (current/history/geofence)                                      | PARTIAL     | Última posição sim; histórico não existe                                                                           |
| Billing (invoices/status)                                                | IMPLEMENTED | Read-safe, preço nunca confiado do cliente                                                                         |
| Notifications (list/read/push)                                           | PARTIAL     | In-app list/patch existe; sem push registration                                                                    |
| Reporting (mobile KPIs)                                                  | PARTIAL     | Existe para web, não validado para mobile                                                                          |

**DOMAIN_ONLY** (regra existe no Core, sem endpoint adequado): posições históricas de tracking
(`resource_locations` existe, sem rota de histórico); `operator_assignments` (tabela existe desde a
Fase I do contract engine, sem rota própria); targeting de notificação por usuário (coluna `person_id`
existe, não usada).
