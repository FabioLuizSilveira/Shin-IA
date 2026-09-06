# Integração oficial de infrações — Senatran / RENAINF / SNE / Serpro / DETRAN

**Status: nenhuma integração oficial está configurada ou implementada.** Este documento existe
para registrar o que se sabe hoje, o que falta confirmar antes de qualquer implementação, e onde
plugar quando isso acontecer — não é uma promessa de que a integração existe.

Ver também `docs/architecture/INFRACTIONS_ENGINE.md` (Fase A, decisão 6): "Senatran/RENAINF/SNE/
Serpro/DETRAN são provider adapters intercambiáveis, nunca uma dependência dura do produto" — este
documento detalha só o adapter oficial, o Infractions Engine em si não depende dele para
funcionar (o fluxo manual e o de importação CSV já cobrem uso real hoje, ver
`INFRACTIONS_ENGINE.md` Fases C e I).

---

## Por que "SNE" não é o nome certo para modelar isso

A rodada que construiu este módulo começou com o pedido "vamos seguir para o SNE" — um nome de
sistema real do Senatran (Sistema Nacional de Educação de Trânsito, historicamente também referido
a variações do RENAINF), mas o próprio spec que guiou a construção adverte explicitamente para
**não modelar o domínio em torno desse nome único** (seção 2 do spec original). O motivo prático:
o cenário real de integração com "o sistema do governo para infrações" não é um único endpoint —
é um conjunto de sistemas e portais que mudam de nome, de dono e de contrato de API com o tempo:

- **RENAINF** — Registro Nacional de Infrações, mantido pelo Denatran/Senatran, é o sistema
  federal onde autuações de órgãos autuadores são consolidadas.
- **SNE** — nome de sistema/portal específico do Senatran, não confirmado como a API pública de
  integração relevante para este produto (pode ser um portal administrativo interno, não uma API
  de consumo por terceiros — `TO_BE_CONFIRMED`).
- **Serpro** — processador de dados federal que historicamente intermediou acesso a bases como o
  RENACH/RENAVAM; pode ou não ser o intermediário técnico real para consulta de infrações,
  dependendo do convênio vigente (`TO_BE_CONFIRMED`).
- **DETRANs estaduais** — cada estado tem seu próprio DETRAN, com seus próprios portais e (às
  vezes) suas próprias APIs de consulta de infração — não existe hoje uma API estadual única.
- **Órgãos autuadores municipais** (ex: CET-SP, prefeituras com radar próprio) — podem autuar
  diretamente, fora do fluxo estadual/federal.

Ou seja: "integrar com o SNE" não é uma tarefa bem definida sem saber, para o tenant específico,
em qual estado/município os ativos operam e qual convênio de acesso a dados esse tenant (ou a
Shinã como plataforma) efetivamente tem. **Por isso o Infractions Engine trata toda fonte oficial
como um `InfractionProvider` intercambiável** (`packages/infractions-engine/src/types.ts`), nunca
uma dependência hard-coded de um nome de sistema específico.

## O que existe hoje no código (e o que não existe)

- `NullOfficialProvider` (`packages/infractions-engine/src/providers.ts`) — implementação
  explícita de "nenhum provider oficial configurado". Qualquer tentativa de sincronizar a partir
  de uma fonte oficial antes de uma integração real existir recebe um erro tipado
  (`NullOfficialProviderError`), nunca dado simulado como se fosse real.
- `infraction_source` (enum) já inclui `senatran`, `renainf`, `serpro`, `detran` como valores
  válidos — são rótulos de dado, não integrações funcionando. Uma infração pode ser marcada com
  uma dessas fontes manualmente (ex: um staff registrando "isso veio de uma notificação do
  DETRAN-SP que recebi por e-mail") sem que exista nenhuma automação por trás.
  `infraction_provider_sync_runs.provider` usa o mesmo enum — hoje só `manual` e `csv_import`
  geram runs reais.
- `InfractionProvider` (interface, `types.ts`) é o contrato que qualquer adapter real
  precisaria implementar: `capabilities` (supportsPull/supportsPush/
  supportsDriverIdentification/supportsPaymentStatus/supportsAppealSubmission) +
  `fetchInfractions(input)`. Um adapter oficial entraria aqui, ao lado de
  `ManualInfractionProvider`/`CsvInfractionProvider`, sem mudar nenhum outro ponto do sistema —
  `ingestInfraction()` (`apps/web/src/lib/infraction-ingest.ts`) já é agnóstico de fonte.

## O que precisa ser confirmado antes de qualquer código de integração real

Todos os itens abaixo são `TO_BE_CONFIRMED` — nenhum foi verificado nesta rodada, e nenhum deve
ser assumido:

- `TO_BE_CONFIRMED`: qual é, de fato, a API/portal correto para consulta de infração por
  placa/RENAVAM que a Shinã teria acesso legítimo a usar — federal (RENAINF/Serpro), estadual
  (DETRAN por UF) ou municipal, e se isso varia por tenant conforme onde os ativos dele operam.
- `TO_BE_CONFIRMED`: modelo de autorização/credencial — convênio direto da Shinã, ou credencial
  própria de cada tenant (mais provável, já que infrações são vinculadas ao CPF/CNPJ do
  proprietário do veículo, não da plataforma).
- `TO_BE_CONFIRMED`: se a integração é _pull_ (a Shinã consulta periodicamente) ou _push_
  (o órgão notifica via webhook/e-mail estruturado) — os dois mudam a forma do adapter
  significativamente (`capabilities.supportsPull` vs `supportsPush` já modelam essa distinção no
  contrato, mas nenhum dos dois foi implementado).
- `TO_BE_CONFIRMED`: se indicação de condutor e defesa/recurso têm protocolo oficial via API
  (`supportsDriverIdentification`/`supportsAppealSubmission`) ou são sempre um processo manual em
  portal — permanece `TO_BE_CONFIRMED` tecnicamente (nenhuma API real foi identificada ainda), mas
  a decisão de produto/jurídica que antes bloqueava isso **já foi tomada** (2026-09-05, usuário):
  automatizar o protocolo oficial via API está autorizado, quando/se uma integração real existir.
  Isso não desbloqueia nenhum código agora — ainda não existe API nenhuma para chamar — só remove
  a barreira de decisão que antes exigiria uma segunda aprovação separada da integração técnica.

**Status geral (2026-09-05, confirmado com o usuário): nenhum convênio/credencial com qualquer
órgão (RENAINF/Serpro/DETRAN/municipal) existe ainda.** A integração oficial continua
genuinamente bloqueada em fatos do mundo real, não em código — segue exatamente como descrito
abaixo, sem nenhuma implementação nova.

- `TO_BE_CONFIRMED`: SLA/rate limit/custo de qualquer uma dessas APIs, se existirem.

## Onde plugar quando (e se) isso for confirmado

1. Implementar uma classe `SenatranInfractionProvider` (ou o nome real do sistema confirmado)
   satisfazendo `InfractionProvider`, ao lado das existentes em
   `packages/infractions-engine/src/providers.ts`.
2. Uma rota nova (`apps/web/src/app/api/infractions/sync/[provider]` ou equivalente) chamando
   `ingestInfraction()` para cada resultado — o mesmo caminho que `POST /api/infractions` (manual)
   e `POST /api/infractions/import` (CSV) já usam, sem duplicar lógica de dedup/matching.
   2b. Um `infraction_provider_sync_runs` novo por execução — a tabela e o padrão de contagem já
   existem (usados pela primeira vez pela Fase I/CSV import), só precisam de um `provider` real
   em vez de `csv_import`/`manual`.
3. Credenciais como variável de ambiente por tenant ou globais (dependendo da resposta ao
   `TO_BE_CONFIRMED` de autorização acima) — nunca hard-coded, nunca simuladas.
4. Scraping de portal está **explicitamente fora de escopo, sempre** (item 60 do spec original) —
   qualquer integração real usa API/serviço autorizado, nunca automação de navegador contra um
   portal público.

Até que os pontos acima sejam confirmados por alguém com autoridade para negociar/confirmar o
acesso real (não é uma decisão técnica que o código possa resolver sozinho), o Infractions Engine
segue operando plenamente via entrada manual e importação CSV — ver `INFRACTIONS_ENGINE.md`.
