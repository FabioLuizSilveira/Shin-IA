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
(`running`) → `cancelRequest` → `getRequest` (`cancelled`) — e revelou 3
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

- **Header e algoritmo exatos do HMAC do webhook.** O adapter implementa
  `x-clicksign-signature` + HMAC-SHA256 sobre o corpo bruto, mas essa
  combinação veio de fontes secundárias (não uma página da doc oficial que
  este trabalho conseguiu buscar diretamente) — confirmar registrando um
  webhook real no sandbox e inspecionando a entrega de verdade antes de
  depender disso em produção.
- **Campo do link de assinatura** em `GET
/envelopes/{id}/signers/{signer_id}` — usado por `getSigningSession()`,
  que não é exercitado pelo fluxo do P1 (a Clicksign manda o link
  diretamente por e-mail; esse método existe pra uma futura UI com
  assinatura embutida).
- **Campo de download do arquivo assinado** em `GET
/envelopes/{id}/documents` — usado por `getSignedArtifacts()`.
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
