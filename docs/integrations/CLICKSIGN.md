# Integração Clicksign (Signature Platform, P1)

**Status: implementado contra o sandbox da Clicksign
(`https://sandbox.clicksign.com/api/v3`). Produção NÃO está implementada
nem autorizada** — não existe env var, flag ou branch de código que ative
produção; o único base URL que existe no adapter
(`packages/signature-platform/src/providers/clicksign.ts`) é o de sandbox.
Ativar produção exige uma mudança de código futura e separada, explicitamente
autorizada — nunca um flip de configuração.

Este documento separa o que foi **confirmado na documentação oficial**
(`developers.clicksign.com`, consultada ao vivo durante a construção deste
adapter) do que **foi confirmado ao vivo contra o sandbox real** (2026-09-03,
com a conta do usuário) e do que **ainda não foi exercitado**. Nenhum
comportamento abaixo foi inventado — onde nada disso deu resposta completa,
o código (`clicksign-status-mapper.ts`) falha alto (`throw`) em vez de
adivinhar.

## Confirmado ao vivo contra o sandbox real (2026-09-03)

Um teste E2E completo (`clicksign.e2e.test.ts`) rodou de ponta a ponta
contra a conta sandbox real do usuário — `createRequest` → `getRequest`
(`running`) → `cancelRequest` → `getRequest` (`cancelled`) — e revelou 4
pontos onde o texto da doc oficial diverge do comportamento real da API:

1. **`content_base64` precisa de um Data URI completo**
   (`data:<content-type>;base64,<...>`), não base64 cru como o texto da doc
   de upload de documento afirma — a API rejeita base64 cru com 400
   ("Formatação do campo inválida. O valor deve ser um Data URI completo.").
2. **Cancelar um envelope `running` não é `PATCH /envelopes/{id}
{status:"canceled"}`** — esse endpoint só aceita `draft`/`running` como
   valores de destino (`400: "status deve estar em: draft, running"`).
   Cancelamento acontece no nível do DOCUMENTO: `PATCH
/envelopes/{id}/documents/{document_id} {status:"canceled"}` (confirmado
   também em `developers.clicksign.com/reference/editar-documento`) — como
   o P1 sempre tem exatamente um documento por envelope, cancelar o único
   documento cancela o envelope inteiro na prática (`getRequest()` depois
   confirma `status: cancelled`).
3. **O campo `name` de um signatário tem validação de formato** — um nome
   como `"Shinã E2E Test Signer"` foi rejeitado (`400: "name não está em um
formato válido"`); um nome completo plausível sem dígitos/abreviações
   funcionou. A regra exata não foi isolada (não vale a pena adivinhar o
   regex), só documentado que existe.
4. **Ativar o envelope (`PATCH status:"running"`) NÃO dispara o e-mail de
   assinatura por si só.** Confirmado ao vivo 2026-09-03: dois envios reais
   (pra `fabio@shinaia.com.br` e `fabioshinaia@gmail.com`) não chegaram —
   o envelope ficava `running`, o signatário `pending`, e nada acontecia.
   Existe uma chamada separada e obrigatória:
   `POST /envelopes/{id}/notifications {data:{type:"notifications",
attributes:{}}}` — só depois dela a Clicksign de fato manda o e-mail
   (`summary: [{signer_id, notified:true}]` na resposta). `createRequest()`
   agora chama isso automaticamente logo após a ativação. Sem essa
   correção, TODA solicitação de assinatura criada pelo P1/P2 ficava presa
   pra sempre sem nenhum erro visível — o pior tipo de bug silencioso.
5. **O header real do webhook é `Content-Hmac`, não `x-clicksign-signature`.**
   Confirmado em duas etapas no dia 2026-09-04: primeiro, um teste real
   contra produção (assinatura completa de verdade, webhook entregue 3x
   pela Clicksign) revelou os headers reais recebidos — `content-hmac` era
   o único específico da Clicksign ali (o resto é infraestrutura de
   Vercel/Datadog/Sentry); `x-clicksign-signature` nunca apareceu em
   nenhuma entrega real. Depois, a página primária
   `developers.clicksign.com/docs/seguranca-de-webhooks` (não alcançável
   nas buscas durante a construção do P1, só localizada depois de já saber
   o nome certo do header) confirmou o formato exato: **o valor do header
   vem prefixado `sha256=` antes do hex digest** — `Content-Hmac:
sha256=<hex>` — HMAC-SHA256(key=secret, message=corpo bruto). Esse
   prefixo era a causa raiz de 3 tentativas reais de webhook falharem
   mesmo já usando o header certo e o algoritmo certo: comparar o valor
   completo (`sha256=...`) contra um hex digest sem prefixo nunca bate
   (tamanhos diferentes). A doc também confirma "não formate o JSON antes
   do cálculo" — por isso o corpo é lido como texto bruto, nunca
   `JSON.parse()`'d antes da verificação.
6. **O payload do webhook (`document_closed`/`close`) carrega o id do
   DOCUMENTO, não o id do envelope.** Confirmado ao vivo 2026-09-04: depois
   da correção #5, o primeiro webhook aceito com sucesso (200) ainda não
   batia com nenhuma `signature_requests` — `event.providerRequestId`
   extraído do payload era um UUID diferente do envelope. Bati esse UUID
   contra `GET /envelopes/{id}/documents` e confirmei: é o id do
   **documento**, não do envelope. Corrigido assim: `createRequest()` agora
   retorna também `providerSecondaryId` (o id do documento), gravado numa
   coluna nova `signature_requests.provider_document_id`;
   `applySignatureEvent()` busca a linha por `provider_request_id` OU
   `provider_document_id`. Também corrigi um bug relacionado que só
   apareceria no P2 (nunca exercitado antes por falta de webhook real
   funcionando): `getSignedArtifacts()` estava sendo chamado com
   `event.providerRequestId` (o id do documento, errado) em vez do
   `provider_request_id` real da linha (o id do envelope, o que o método
   realmente precisa).
7. **O campo de download do arquivo assinado é `links.files.signed`, não
   `attributes.downloads.signed_file_url`** (o nome antigo era um chute
   documentado como não confirmado). Confirmado no mesmo `GET
/envelopes/{id}/documents` do achado #6 — a resposta real tem
   `data.links.files.{original,signed,ziped}`, URLs pré-assinadas do S3 da
   Clicksign com expiração curta.
8. **`default_subject`/`default_message` existem em `attributes` do
   envelope** (confirmado via `GET /envelopes/{id}` — ambos `null` por
   padrão numa envelope criada sem eles) e mudam o assunto/corpo do e-mail
   que o signatário recebe. `createRequest()` agora envia os dois, vindos
   de `CreateSignatureRequestInput.emailSubject`/`emailMessage`
   (`apps/web`'s `POST /api/signature-requests` preenche com o nome do
   tenant). **Isso NÃO muda quem aparece como remetente** — a Clicksign
   sempre manda pelo nome/e-mail da conta (hoje pessoa física do usuário);
   trocar isso é configuração da própria conta Clicksign (Configurações →
   Personalizar → remetente customizado, sujeito ao plano), fora do
   alcance desta API.

## Confirmado na documentação oficial

- Base URL sandbox: `https://sandbox.clicksign.com/api/v3`.
- Autenticação: header `Authorization: <access_token>` (token cru, não
  `Bearer`) + `Content-Type: application/vnd.api+json` (formato JSON:API).
- Ciclo de vida do Envelope: só 4 status — `draft`, `running`, `closed`,
  `canceled` (grafia americana, sem "l" duplo).
- Sequência de criação: `POST /envelopes` (draft) → `POST
/envelopes/{id}/documents` (`filename` + `content_base64` — ver correção
  #1 abaixo, o texto da doc está errado nesse campo) → `POST
/envelopes/{id}/signers` (`name`, `email`, `communicate_events`) → `POST
/envelopes/{id}/requirements` (duas por par signatário/documento: uma de
  qualificação `{action:"agree", role:"sign"}` — é isso que obriga o
  signatário a assinar de fato — e uma de autenticação
  `{action:"provide_evidence", auth:"email"}` — verificação de identidade
  por e-mail, a mais simples disponível) → `PATCH /envelopes/{id}
{status:"running"}` ativa (irreversível: não volta pra `draft`).
- `POST /webhooks` registra um endpoint e devolve um `secret` usado pro
  HMAC.
- Nomes de evento confirmados nos exemplos da doc: `document_closed`
  (todos os requirements de um documento cumpridos) e `close` (documento
  fechado manualmente).

## Pontos ainda não exercitados (`TO_BE_CONFIRMED`)

Nenhum destes foi inventado — cada um está isolado no código com um
comentário explícito apontando pra este documento, e falha alto em vez de
assumir um valor. Diferente da seção anterior, estes não foram exercitados
nem uma vez contra o sandbox real ainda (o E2E de 2026-09-03 cobriu
`createRequest`/`getRequest`/`cancelRequest`, não o webhook nem
`getSigningSession`/`getSignedArtifacts`).

- **Campo do link de assinatura** em `GET
/envelopes/{id}/signers/{signer_id}` — usado por `getSigningSession()`,
  que não é exercitado pelo fluxo do P1 (a Clicksign manda o link
  diretamente por e-mail; esse método existe pra uma futura UI com
  assinatura embutida).
- **Vocabulário completo de eventos de webhook** além de
  `document_closed`/`close` — recusa, cancelamento, expiração de prazo são
  prováveis mas não confirmados.
- **Se existe um `event.id` de verdade** no payload do webhook — não
  confirmado nas páginas consultadas; o adapter monta um id sintético
  (`{envelopeId}_{eventName}_{occurred_at}`) até confirmar.

## Por que "email" como único método de autenticação no P1

A Clicksign suporta vários métodos (`email`, `sms`, `whatsapp`, `pix`,
`icp_brasil`, `liveness`, `facial_biometrics`). P1 usa só `email` — é o
único que não exige nenhuma infraestrutura adicional (telefone verificado,
integração de biometria, certificado ICP-Brasil) que a Shinã não tem hoje.
Suportar outros métodos é uma extensão futura do `ClicksignProvider`, não
uma limitação estrutural da Signature Platform.

## Por que Shinã não manda seu próprio e-mail com o link de assinatura

A spec original (seção 35) pede explicitamente para evitar e-mails
duplicados — a Clicksign já notifica cada signatário diretamente
(`communicate_events.signature_request: "email"` na criação do
signatário). `ProviderSigner.signingUrl` fica `null` no retorno de
`createRequest()` por isso; uma futura UI com assinatura embutida chamaria
`getSigningSession()` sob demanda, não construiria um e-mail próprio com o
link.

## Configuração

```
SIGNATURE_PROVIDER=clicksign
CLICKSIGN_API_KEY=<access token do sandbox>
CLICKSIGN_WEBHOOK_SECRET=<secret devolvido por POST /webhooks>
```

Não existe `CLICKSIGN_ENV` — não há nada pra selecionar.

## Rodando o teste E2E real

```bash
CLICKSIGN_API_KEY=<...> pnpm --filter @shina/signature-platform test
```

Sem a variável, `clicksign.e2e.test.ts` é pulado automaticamente — `pnpm
test` continua limpo pra quem não tem credenciais. Rodado com sucesso em
2026-09-03 contra a conta sandbox real do usuário (14/14 testes,
incluindo o E2E). Cobre só o que dá pra testar sem um humano clicando num
link de assinatura ou um webhook publicamente alcançável: criar envelope,
confirmar `running`, cancelar, confirmar `cancelled`. O caminho completo
assinatura → webhook → `getSignedArtifacts()` precisa de um ambiente
publicamente alcançável (deploy real ou túnel) — não foi (e não pode ser,
honestamente) testado contra `localhost`.
