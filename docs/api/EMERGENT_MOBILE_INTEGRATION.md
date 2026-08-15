# Integração Mobile — Guia para o Emergent

Data: 2026-08-15 · Este documento acompanha [mobile-openapi.yaml](mobile-openapi.yaml).

**Status atual**: `GET /api/mobile/bootstrap` (Wave 1) está implementado e é o ponto de entrada oficial
do Mobile BFF. Outros endpoints úteis para o app ainda não existem (marcados `x-shina-status: proposed`
no OpenAPI) — implemente a UI contra o contrato, mas espere que endpoints `proposed` retornem 404 até
serem construídos e liberados pela equipe Shinã.

## Base URL

Hoje: `https://app.shinaia.com.br` (onde as rotas `implemented` realmente respondem).
Alvo futuro: `https://api.shinaia.com.br` (ainda não operacional — ver ADR sobre a decisão de onde o
backend mobile vai viver).

## Autenticação

O app autentica via **Supabase Auth**, não via um endpoint de login próprio da Shinã:

1. Use o SDK Supabase (`@supabase/supabase-js`) com a URL e a `anon key` do projeto (fornecidas
   separadamente, nunca commitadas no OpenAPI).
2. Login: `supabase.auth.signInWithOAuth({provider: "google"})` ou
   `supabase.auth.signInWithOtp({email})` (magic link).
3. Após autenticar, o SDK mantém a sessão localmente. Todo request à API Shinã leva o access token
   dessa sessão:

```
Authorization: Bearer <supabase_access_token>
```

4. O token já contém claims específicas da Shinã (`tenant_id`, `tenant_role`, `platform_role`,
   `entitlements`, etc.) — computadas server-side, nunca aceitas de volta do cliente. **Você não precisa
   decodificar essas claims no app** — chame `GET /api/mobile/bootstrap` logo após autenticar para
   receber o contexto já resolvido em JSON.

**Atenção — tipos de usuário diferentes**: nem todo usuário tem as mesmas claims. Um cliente final
(`rental_customers`) ou um operador (`operators`) **não recebe `tenant_id` no JWT** — só staff do tenant
(`user_profiles`) recebe. Não assuma que o JWT sempre tem `tenant_id`; use o campo `userType` do bootstrap
para decidir o que renderizar.

**Auto-cadastro bloqueado (Wave 0)**: o magic-link de e-mail só completa o login se a conta já existir
(criada via convite do tenant) — um e-mail novo recebe a mesma resposta de "e-mail enviado" mas não cria
conta nenhuma, então não trate "recebi confirmação de envio" como "a conta existe". Login via Google
ainda pode criar um `auth.users` novo na primeira vez (limitação do próprio GoTrue, não há flag
equivalente a `shouldCreateUser: false` para OAuth) — nesse caso o bootstrap retorna
`userType: "unprovisioned"` e a UI deve mostrar uma tela de "conclua seu convite/onboarding" ou "saia da
conta", nunca dados operacionais.

## Bootstrap — `GET /api/mobile/bootstrap`

**Implementado.** É a única chamada necessária logo após o login — chame antes de renderizar qualquer
tela autenticada. Retorna: `schemaVersion`, `user` (com `userType: "tenant_user" | "customer" |
"operator" | "unprovisioned"`), `tenant` (null para customer/unprovisioned — um cliente pode pertencer a
mais de um tenant, não existe "o" tenant dele), `branding` (config real publicada pelo tenant, ou
`{"name": "Shinã"}` para unprovisioned), `roles`, `permissions` (efetivas, já resolvidas — só para
esconder botões na UI, nunca defesa), `entitlements`, `features`, e `organizations` (só presente quando
`userType === "customer"`, lista de `{organizationId, tenantId}`).

### `BootstrapProvider`

Estruture a integração atrás de uma interface `BootstrapProvider` no app — durante desenvolvimento/
testes, um mock pode retornar um payload fixo; `ApiBootstrapProvider` (chamando `GET /api/mobile/
bootstrap` de verdade) é a implementação oficial para qualquer build que não seja puramente local. Não
componha o bootstrap manualmente a partir de outras rotas legadas (`/api/tenant-settings/company`, etc.)
— isso contorna a resolução de userType/permissões e reintroduz exatamente o tipo de inconsistência que
este endpoint existe para eliminar.

## Endpoints

Consulte `mobile-openapi.yaml` — cada operação tem `x-shina-status` (`implemented`/`partial`/`proposed`)
e, quando implementada, `x-shina-source` apontando pro arquivo real no backend (não relevante para o
Emergent, mas prova que não é um endpoint fictício).

## Wave 2 — Dashboard, Operações, Ativos, Clientes e Operadores

Todos os endpoints abaixo são `implemented`, chamam `requireMobileContext()` e retornam `403` para
`userType: "unprovisioned"`. Nenhum aceita um `tenant_id`/`customer_id`/`operator_id` do corpo ou de
query string para decidir escopo — a identidade vem sempre do JWT/sessão, resolvida server-side.

**`GET /api/mobile/dashboard`** — contadores e alertas agregados, formato varia por `userType`:
`tenant_user` recebe contadores de operações/ativos, `financialSummary` (só presente se o usuário tiver a
permissão `tenant.dashboard.financial` — omitido, não zerado, quando ausente) e `alerts` (eventos
`contract.operation_blocked` recentes); `customer`/`operator` recebem contadores menores, escopados às
suas próprias operações/contratos/atribuições.

**`GET /api/mobile/operations`** e **`GET /api/mobile/operations/{id}`** — lista e detalhe de operações
visíveis à identidade atual. O detalhe inclui `allowedActions` (array de strings, ex.
`["in_progress", "cancelled"]`) — **sempre um preview, nunca uma permissão real**: o app usa isso só para
habilitar/desabilitar botões; a mutação real (`PATCH /api/operations/{id}`, endpoint de staff, não
mobile) valida tudo de novo de forma independente. `allowedActions` é sempre `[]` para `customer`/
`operator` (não existe rota de mutação para essas duas identidades nesta wave — telas para elas são
view-only). Quando uma transição está bloqueada por exigência de contrato, `contractGate` vem preenchido
(`{blocked: true, reasons: [...]}`) e a transição correspondente já sai excluída de `allowedActions` — não
tente decidir isso no client. `trackingSummary` é a última posição conhecida do recurso vinculado (não
histórico — mesmo gap MOB-003 já documentado), `null` quando não há posição registrada.

**`GET /api/mobile/assets`** e **`GET /api/mobile/assets/{id}`** — lista e detalhe de ativos visíveis.
Sem `allowedActions` (não há mutação de ativo nesta wave) e sem `trackingSummary` (assets e resources são
conceitos/tabelas separados neste schema — não assuma que todo ativo tem posição GPS). Filtros
(`category`, `status`, `branchId`) tocam só colunas genéricas — não espere um filtro específico por tipo
de blueprint (ex. "placa do veículo") até que isso seja adicionado explicitamente ao contrato.

**`GET /api/mobile/customers/me`** (`userType: customer` apenas) e **`GET /api/mobile/operators/me`**
(`userType: operator` apenas) — perfil "de mim mesmo". Não existe um `GET /api/mobile/customers/{id}`
genérico nem `GET /api/mobile/operators/{id}` — cada identidade só enxerga o próprio registro. Staff do
tenant continua usando `GET /api/organizations` (lista clientes) e `GET /api/operators` (lista
operadores) — não foram duplicados para mobile porque `tenant_user` já tem acesso total a eles.

## Schemas

Todos os schemas reutilizáveis (`Operation`, `Asset`, `Contract`, `Document`, `TrackingPosition`,
`Invoice`, `Notification`, etc.) estão em `components/schemas` do OpenAPI. Gere tipos TypeScript a
partir dele (ver seção Type Generation) em vez de duplicar interfaces manualmente.

## Erros

**Formato real hoje**: `{"error": "mensagem em texto"}` — string plana, sem código estruturado. O
formato `{"error": {"code", "message", "request_id"}}` está documentado no OpenAPI como `proposed`
(`ApiError` schema) — **não trate como implementado ainda**. Códigos HTTP usados hoje: `400`, `401`,
`403`, `404`, `409` (conflito de agenda), `422` (validação/regra de negócio), `429` (rate limit,
`Retry-After` header presente), `500`.

## Paginação

Nenhum padrão consistente confirmado — a maioria das listas retorna o array completo, sem cursor/offset.
Não assuma paginação automática; se uma tela precisar de paginação real, isso é um gap a ser fechado pela
equipe Shinã antes do lançamento daquela tela específica, não algo pra inferir no client.

## Permissões / Entitlements

`permissions` e `entitlements` no bootstrap (quando existir) são **strings opacas** — não construa lógica
de UI baseada em conhecer o significado interno de cada chave além do que a Shinã documentar
explicitamente. O app nunca decide autorização sozinho — toda ação mutável já é validada server-side; a
UI só usa `permissions`/`entitlements` para **esconder** botões que resultariam em 403, nunca como única
defesa.

## Upload de arquivos

Sempre `multipart/form-data` direto pra rota de API (ver `POST /api/customer-contracts/{id}/documents`
no OpenAPI) — **nunca** peça uma URL assinada pro app fazer upload direto pro Storage. O padrão de
download por URL assinada (quando existir, ver gap MOB-004) expira em minutos — não cacheie a URL, peça
uma nova a cada exibição.

## Tracking

O app nunca recebe credenciais de provedor de GPS. `resourceId` identifica o recurso (veículo/equipamento)
sendo rastreado; a última posição vem de `/api/resources/locations`. Histórico completo ainda não existe
(gap MOB-003) — não construa uma tela de "trajeto" até essa rota existir.

## Contratos

O fluxo de aceite é sempre: (1) buscar o texto do contrato já renderizado (snapshot imutável), (2)
mostrar checkboxes nunca pré-marcados, (3) `POST /api/customer-contracts/{id}/accept`. O app **nunca**
envia `accepted_at`, hash do documento, ou a versão do contrato — tudo isso é resolvido server-side a
partir do que já foi apresentado. Se a rota rejeitar por "não possui requisito jurídico dinâmico
associado" (422), esse contrato específico não passa pelo motor novo de contratos — trate como
contrato legado, sem fluxo de aceite no app.
