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

## Wave 3 Phase A — Contratos

**`GET /api/mobile/contracts`** (`userType: customer` apenas) — lista os contratos do cliente
autenticado, escopados via `rental_customer_organizations` (nunca um `organization_id`/`customer_id`
enviado pelo app). Tenant staff continua usando `GET /api/contracts`, já existente.

**`GET /api/mobile/contracts/{id}`** — detalhe. **Nunca retorna o template editável**, só o snapshot
imutável já renderizado (`snapshot.rendered_content`) — é isso que o app deve mostrar como "o
contrato". Inclui `version`/`effectiveAt`, `assets` (itens do contrato), `acceptance.accepted`,
`billing` (`type`, `satisfied` — registro/controle apenas, não existe cobrança automática nesta
wave), `documents.allApproved` (resumo; para a lista completa por requisito, chame
`GET /api/customer-contracts/{id}/documents`, endpoint reutilizado, não duplicado) e
`allowedActions` (`["view"]` sempre; `"accept"` só quando o contrato ainda está em `draft` e não foi
aceito; `"download"` quando existe snapshot). Mesma higiene IDOR das outras rotas: contrato de outro
cliente responde `404`, nunca `403` (não confirma a existência do dado alheio).

**Aceite — `POST /api/customer-contracts/{id}/accept`** (endpoint reutilizado, não um `/api/mobile/*`
novo — mesma autenticação de sessão Supabase que todo o resto do app mobile já usa). O corpo aceito é
só `{ dataProcessingConsent?: boolean }` — **o app nunca envia** `accepted_at`, `document_hash`,
`contract_version`, `snapshot_id`, `tenant_id` ou `customer_id`; tudo isso é resolvido e validado
server-side. Anti-tamper real: o backend re-deriva `contractVersionId`/`snapshotId` a partir do
próprio contrato e rejeita qualquer valor que não bata (não é um TODO — já implementado e coberto por
teste ao vivo). Fluxo recomendado no app: (1) `GET /api/mobile/contracts/{id}` para mostrar o
`snapshot.rendered_content` e conferir `allowedActions.includes("accept")`, (2) checkbox nunca
pré-marcado, (3) `POST /api/customer-contracts/{id}/accept`. Se a resposta for `422` com
"não possui um requisito jurídico dinâmico associado", esse contrato específico não passa pelo motor
novo — trate como um contrato legado, sem fluxo de aceite nesta wave.

## Wave 3 Phase B — Documentos

Três rotas, todas customer-session-authenticated (mesmo padrão de `/api/customer-contracts/{id}/accept`
— nenhuma é `/api/mobile/*`, porque nenhuma precisa de agregação/DTO-shaping além do que a rota já
faz):

- **`GET /api/customer-contracts/{id}/documents`** — requisitos do template + documentos já enviados
  pelo cliente (`status: pending|approved|rejected`).
- **`POST /api/customer-contracts/{id}/documents`** — upload, sempre `multipart/form-data`
  (`file` + `requirement_id`) direto para esta rota. **Nunca peça uma URL assinada para o app fazer
  upload direto pro Storage** — o bucket `contract-documents` é privado sem RLS de `storage.objects`,
  a autorização vive inteiramente na rota. Limite 10 MiB, apenas `image/png`, `image/jpeg`,
  `application/pdf`. Rate-limited (10 uploads / 5 min).
- **`GET /api/customer-contracts/{id}/documents/{documentId}/url`** (novo nesta wave, fecha o gap
  MOB-004) — gera uma URL assinada de 5 minutos para o cliente rebaixar o próprio documento.
  **Nunca cacheie essa URL** — ela expira rápido; peça uma nova a cada exibição/download. Documento
  de outro contrato ou de outro cliente responde `404` (nunca `403` — não confirma a existência do
  dado alheio). Rate-limited (30 req / 5 min).

Nenhuma dessas rotas aceita um `storage_path`/caminho arbitrário do app — o backend sempre decide o
caminho no Storage a partir de `tenant_id`/`contract_id`/`requirement.key`, nunca do nome do arquivo
enviado (correção de um vetor de path traversal fechado nesta wave).

## Wave 3 Phase C — Tracking

**`GET /api/mobile/tracking/{resourceId}/current`** — última posição conhecida de um recurso
(veículo/equipamento), escopada pela identidade: `tenant_user` vê qualquer recurso do próprio tenant;
`customer`/`operator` só veem um recurso quando ele está vinculado a uma operação que já podem ver
(o mesmo escopo de `GET /api/mobile/operations`, reaproveitado — não existe uma tabela separada
"cliente → ativo rastreável"). Campos sempre presentes: `latitude`, `longitude`, `recordedAt`,
`lastCommunicationAt`, `source`. `speed`/`ignition` só aparecem quando o provedor de GPS do tenant
realmente os enviou naquele fix — **nunca assuma que esses dois campos sempre existem**. Nunca
retorna nada do provedor (token, `provider_name`, id de conta) — só o modelo canônico Shinã.
`data: null` quando o recurso nunca teve uma posição registrada.

**`GET /api/mobile/tracking/{resourceId}/history`** — histórico de posições, `from`/`to`/`limit`
(query params). `limit` é sempre limitado a 500 no servidor mesmo se você pedir mais — não existe
"histórico completo" nesta wave. Reautoriza `resourceId` a cada chamada; não assuma que uma vez
autorizado, sempre autorizado.

Geofencing (entrada/saída de cercas virtuais) existe no backend (`tenant/tracking`, engine real) mas
**não tem endpoint mobile nesta wave** — não construa telas de geofence no app ainda.

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

## Wave 3 Phase D — Notificações e Push

**`GET /api/mobile/notifications`** / **`PATCH /api/mobile/notifications`** (`userType: customer` ou
`operator` apenas) — inbox real por usuário, não mais broadcast. Uma notificação endereçada a outro
cliente/operador nunca aparece na lista e não pode ser marcada como lida, mesmo que o app conheça o
`id` dela — a checagem de posse está embutida na própria query (`recipient_external_ref`), não é uma
etapa separada que possa ser burlada. `tenant_user` continua usando `GET/PATCH /api/notifications`
(inalterado, broadcast por tenant — targeting individual de staff continua fora de escopo).

**`POST /api/mobile/devices`** — registra/atualiza o push token do device atual. `deviceId` deve ser
um identificador estável gerado pelo app (uma vez por instalação, ex. via `expo-application` ou
similar) — **nunca invente um novo a cada chamada**, isso criaria uma linha nova por request em vez
de atualizar a existente. O app **nunca envia `user_id`** — é sempre resolvido a partir da sessão.
Chame isso a cada login e periodicamente (ex. ao abrir o app) para manter `last_seen_at` fresco.

**`DELETE /api/mobile/devices/{deviceId}`** — desabilita o device (não apaga o histórico). Chame no
logout para parar de receber push nesse aparelho.

**Nenhum provedor de push está integrado ainda** (Expo Push / FCM / APNs — `push_delivery_provider:
pending`). Esta wave só entrega a fundação de registro; não espere notificações push chegando de
fato até a Shinã confirmar a integração de um provedor.

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
sendo rastreado. Desde a Wave 3 Phase C, use `/api/mobile/tracking/{resourceId}/current` (última posição,
escopada por identidade) e `/api/mobile/tracking/{resourceId}/history` (histórico limitado, `from`/`to`/
`limit`) — ver seção "Wave 3 Phase C — Tracking" abaixo para detalhes completos.
`/api/resources/locations` continua existindo mas é staff-only (bulk, todos os recursos do tenant).

## Contratos

O fluxo de aceite é sempre: (1) buscar o texto do contrato já renderizado (snapshot imutável), (2)
mostrar checkboxes nunca pré-marcados, (3) `POST /api/customer-contracts/{id}/accept`. O app **nunca**
envia `accepted_at`, hash do documento, ou a versão do contrato — tudo isso é resolvido server-side a
partir do que já foi apresentado. Se a rota rejeitar por "não possui requisito jurídico dinâmico
associado" (422), esse contrato específico não passa pelo motor novo de contratos — trate como
contrato legado, sem fluxo de aceite no app.
