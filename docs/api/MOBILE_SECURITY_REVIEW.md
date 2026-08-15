# Mobile API Security Review

Data: 2026-08-15 · Baseado na auditoria factual em [MOBILE_API_AUDIT.md](MOBILE_API_AUDIT.md).

Classificação: **CRITICAL** (exploração direta e imediata) · **HIGH** (exploração provável, impacto sério)
· **MEDIUM** (requer condição adicional, ou impacto limitado) · **LOW** (higiene, sem exploração direta
identificada).

---

## Authentication

**Provider**: Supabase Auth (GoTrue) — confirmado, sem sistema de auth próprio. Três clients distintos:
browser/anon, server/cookie (também anon-key, RLS-bound), admin (service-role, **bypassa RLS
completamente**).

- **[LOW] Sem validação JWKS explícita no código** — a validação de assinatura acontece dentro de
  `supabase.auth.getUser()`/`getSession()` (delegada ao SDK), não há verificação manual custom. Isso é
  correto pelo padrão Supabase, mas significa que qualquer rota que decodifique claims SEM antes chamar
  `getUser()`/`getSession()` estaria confiando em um payload não verificado. `decodeSessionClaims()`
  (`jwt-claims.ts`) só faz base64-decode — **é seguro apenas porque é sempre chamado depois de uma
  verificação de sessão real no mesmo request**, nunca isoladamente. Nenhuma rota auditada quebra esse
  padrão, mas é uma invariante frágil que vale documentar explicitamente para quem for portar isso pro
  `apps/api` (Fastify) — lá a verificação JWKS terá que ser explícita, não vem de graça de um SDK Next.js.

- **[MEDIUM] MFA não confirmado como reforçado a nível de rota de API.** A checagem do cookie
  `mfa_verified` é feita em `middleware.ts`, mas só para navegação de página (`!isApiRoute`) e só para
  `tenant_owner`/`tenant_admin`. Não foi confirmado que rotas de API sensíveis (ex.: mudança de
  billing_plan, aceite de contrato) re-verificam o cookie MFA internamente. Recomendação: confirmar
  explicitamente antes de expor qualquer rota mutável a mobile para esses papéis.

## Authorization

- **[HIGH] `requireTenantScope()` usa sempre o client service-role — RLS é bypassada em ~80 rotas de
  staff.** O isolamento de tenant nessas rotas depende inteiramente do filtro manual
  `.eq("tenant_id", scope.tenantId)` escrito em cada rota, sem nenhum backstop no nível do banco. Isso já
  é reconhecido no próprio código (comentário em `tenant-context.ts`) e mitigado por `scopedSelect`/
  `scopedUpdate`/etc. para código novo, mas as ~80 rotas existentes não foram retrofitadas. Um único
  `.eq()` esquecido em uma rota futura é um IDOR/cross-tenant instantâneo, sem RLS para pegar o erro.
  **Ação recomendada antes do lançamento mobile**: nenhuma rota nova para mobile deveria usar filtragem
  manual — usar os helpers `scoped*` obrigatoriamente, ou migrar para um padrão que force o filtro
  estruturalmente.

- **[HIGH] `hasTenantPermission()` (o catálogo granular de RBAC) só é chamado em 6 rotas no repositório
  inteiro** (`contract-templates` × 3, `commercial/plan-change`, `commercial/accept`). A esmagadora
  maioria das ~80 rotas de tenant staff gateia só por `isTenantAdmin()`/checagem de role hardcoded, não
  pelo catálogo de permissões que o Tenant Studio permite configurar. Isso significa que delegar uma
  permissão granular via `tenant/studio` para um papel customizado **não tem efeito real** na maioria das
  rotas — um "Gerente de Frota" customizado com só `operations:view` concedido ainda teria (ou não teria)
  acesso conforme o hardcode da rota, não conforme a permissão configurada. Não é uma falha de segurança
  no sentido de dar acesso indevido, mas é uma falha de **integridade do modelo de autorização** — a UI
  promete granularidade que o backend não entrega na prática.

- **[MEDIUM] ABAC por branch (`branch_scope_mode`/`branch_id`) é computado e embutido em todo JWT, mas
  enforçado em só 2 rotas** (`commissions/transactions`, `commissions/campaigns`). Um usuário com escopo
  de branch limitado provavelmente tem acesso de fato irrestrito a todas as branches nas demais ~80
  rotas, contrariando o que o modelo de dados sugere.

- **[LOW] Sem CORS configurado em nenhum lugar do código-fonte.** Comportamento cross-origin depende de
  configuração no painel do Supabase (fora deste repo) e do same-origin padrão do browser. Para uma API
  que passará a ser chamada por um app mobile nativo (sem same-origin) e potencialmente por
  `api.shinaia.com.br` como domínio separado do app web, isso precisa de política explícita antes do
  lançamento — hoje não existe nenhuma, nem restritiva nem permissiva, documentada em código.

## Tenant Isolation

- Ver "Authorization" acima — RLS bypassada para rotas de staff; RLS é a defesa real e única para
  consumidores diretos-PostgREST (cliente/operador via app mobile atual, `rentals-portal.ts`).
- **[LOW/positivo, registrar como controle validado]**: `tenant_id` nunca é aceito do cliente em request
  alguma — é sempre derivado server-side dentro do `custom_access_token_hook` (Postgres, `security
definer`, execução restrita a `supabase_auth_admin`) a partir de `user_profiles.auth_user_id =
auth.uid()`. Confirmado que não há caminho para um cliente forjar esse claim.

## RLS

- Testado e confirmado nesta sessão (fases anteriores do contract engine) para as tabelas novas —
  isolamento cross-tenant bloqueado, catálogo global legível só por autenticados (não anônimo). Ver
  policies em `operations`, `contracts`, `tenant_contract_acceptances`, `rental_customers` — todas
  seguem o padrão `tenant_id = (auth.jwt()->>'tenant_id')::uuid` para staff, ou cadeia de subquery via
  `auth.uid()` para cliente/operador.
- **[HIGH — achado real, não teórico] O app mobile atual permite auto-cadastro via magic-link**
  (`LoginScreen.tsx`, `supabase.auth.signInWithOtp` com qualquer e-mail digitado), contradizendo a
  premissa de "staff-invite onboarding" registrada na memória do projeto. Como `rental_customers` não tem
  policy de `insert` visível na migration e a RLS de leitura é só `auth_user_id = auth.uid()`, o
  vazamento de dado não é automático — mas **qualquer pessoa pode logar no app mobile hoje sem nenhum
  vínculo prévio com um tenant**, e a experiência resultante (tela vazia, sem contratos) não foi
  auditada quanto a mensagens de erro ou timing que possam vazar existência de outros usuários. Recomenda-se
  confirmar no painel do Supabase se `auto_confirm`/criação automática de usuário via OTP está
  intencionalmente habilitada para este caso de uso, e se não, desabilitar.

## Secrets

- Nenhuma rota retorna a service-role key ou credenciais de provedor de tracking ao cliente — confirmado.
- `fleet_integrations.webhook_secret`/`webhook_token`: RLS restringe até `SELECT` à tenant dona; rota de
  webhook usa client admin, nunca expõe o segredo de volta na resposta.

## Rate Limiting

- **[MEDIUM]** Rate limiter é in-memory, por instância — não compartilhado entre instâncias/regiões
  (documentado no próprio código-fonte como limitação conhecida, recomendação de migrar para Redis/
  Upstash já registrada). Para um backend que hoje roda em serverless (Vercel) e potencialmente migra
  para Railway, isso é uma lacuna real de rate limiting distribuído — um atacante distribuído por vários
  cold starts/instâncias não é limitado de forma consistente.

## CORS

Ver item em Authorization — ausência total de política no código.

## Replay

- **[LOW/positivo]**: aceite de contrato tem proteção anti-replay real — `recordContractAcceptance()`
  (tenant-contract-engine) valida que `contractVersionId`/`snapshotId` enviados batem exatamente com o
  que está gravado na linha `contracts`, rejeitando qualquer tentativa de reenviar contra uma versão
  diferente (correção aplicada nesta própria sessão, testada).
- Webhooks (Stripe, fleet-location) usam assinatura/token, idempotência garantida por índice único em
  `platform_billing_events.stripe_event_id` — não é vetor mobile de qualquer forma.

## IDOR

- Ver "Authorization" — o risco estrutural é a ausência de RLS-backstop nas rotas TS combinada com
  filtragem manual não uniforme. Nenhum IDOR concreto foi confirmado nesta auditoria (não foi objetivo
  testar exploração ativa em todas as ~80 rotas), mas o padrão arquitetural é HIGH risk por design,
  mitigado por disciplina de código, não por controle estrutural.

## Mass Assignment

- Rotas auditadas (`operations`, `assets`, `contracts`, `invoices/[id]/checkout`) constroem objetos de
  update/insert campo a campo a partir do body, não fazem spread direto do body no insert/update — não foi
  encontrado um padrão de mass-assignment nas rotas lidas. Não auditado exaustivamente para todas as ~90
  rotas.

## Input Validation

- Validação é ad-hoc por rota (checagens `if (!body.x)`), não há schema/validador central (ex.: Zod) em
  uso confirmado nas rotas lidas. Isso é uma prática consistente mas não uma camada de defesa
  estruturada — recomendação de padronizar antes de expor a mobile.

## File Upload

- **[LOW/positivo]**: upload sempre mediado por rota de API (multipart `FormData`), nunca URL assinada
  client-side, para os dois buckets existentes. `contract-documents` tem allowlist de MIME type e limite
  de 10 MiB validados. `contract-documents` **não tem RLS em `storage.objects`** — autenticação é 100%
  na rota da API, não no Storage. Isso é consistente (documentado no próprio código como decisão
  deliberada), mas significa que um bug futuro na rota é a única linha de defesa, sem camada de RLS
  redundante no Storage.
- **[MEDIUM]** Não existe rota de download com signed URL para o lado CLIENTE de `contract-documents`
  (só o lado staff tem). Se o app mobile precisar mostrar o documento enviado de volta ao cliente, essa
  rota não existe hoje — gap funcional, não de segurança, mas relevante ao mobile.

## Tracking Privacy

- Nenhuma credencial de provedor GPS é exposta ao cliente — confirmado.
- Ingestão via webhook usa token de URL + HMAC opcional (**não obrigatório** — `X-Signature` só é
  verificado se o header está presente). **[MEDIUM]**: um dispositivo/atacante que descubra o token de
  URL mas não envie o header de assinatura ainda tem o payload aceito, já que a verificação HMAC não é
  mandatória. Recomenda-se tornar a assinatura obrigatória antes de expandir a base de dispositivos.

## Contract Acceptance

- Já coberto acima — `accepted_at`/`ip_address`/`user_agent`/`document_hash` sempre server-derived nos
  dois engines de contrato (`commercial-platform` e `tenant-contract-engine`), nunca aceitos do body do
  cliente. Confirmado por leitura direta do código em ambos os pacotes.

## Audit

- `logActivity()`/`tenant_activity_log` cobre a maioria das mutações auditadas nesta sessão. Cobertura
  para as ~80 rotas pré-existentes não foi auditada exaustivamente nesta rodada.

## Logging / PII exposure

- Não auditado em profundidade nesta rodada (fora do escopo de tempo). Recomenda-se auditoria dedicada
  de logs de erro (ex.: `console.error` com payloads completos) antes do lançamento mobile, já que
  `rentals-portal.ts`/`rentals.ts` (mobile) explicitamente evitam vazar erros brutos do Postgres ao
  usuário final — confirmar que o padrão é seguido em todas as ~90 rotas de API também.

---

## Resumo de severidade

| Severidade | Achados                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRITICAL   | Nenhum encontrado nesta auditoria                                                                                                                                                                                        |
| HIGH       | RLS bypassada + filtro manual como única defesa (80 rotas); `hasTenantPermission` só em 6 rotas; auto-cadastro no app mobile sem gate de convite                                                                         |
| MEDIUM     | MFA não confirmado a nível de rota; ABAC de branch não enforçado; rate limiting não distribuído; CORS ausente; HMAC de webhook de tracking não obrigatório; sem download signed-URL para cliente em `contract-documents` |
| LOW        | Base64-decode de claims sem re-verificação isolada (mitigado por padrão de uso); logging/PII não auditado a fundo                                                                                                        |
