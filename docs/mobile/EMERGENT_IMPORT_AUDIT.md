# Emergent Import & Architecture Audit — M21

Data: 2026-08-17 · Escopo: branch `origin/feat/emergent-mobile-integration` (8 commits, não mesclada,
não fazia parte do working tree até esta auditoria — lida via `git show`, nunca dada `checkout`).
Comparada contra o backend real (`apps/web`) e o app mobile real já existente (`apps/mobile`, "Shinã
Cliente"). Nenhum código foi alterado nesta milestone — auditoria pura, conforme instruído.

**Achado central**: o branch contém **dois artefatos distintos** de qualidade muito diferente:

1. Um **backend Python (FastAPI + MongoDB) abandonado** — protótipo inicial de um MVP genérico de
   aluguel de carros ("Car Rental Management API"), testado apenas contra um preview host do próprio
   Emergent, nunca chamado pelo frontend atual. **Backend paralelo morto, não em uso.**
2. Um **frontend Expo/React Native bem construído** ("Shinã I.A.", persona de gestor de frota —
   diferente da persona cliente-final do `apps/mobile` real) que já foi projetado desde o início para
   **não ter backend próprio** — usa Supabase real para auth e um client HTTP tipado
   (`shinaia.ts`) que tenta o backend real da Shinã e cai para mocks tipados quando a flag de "live"
   está desligada (que é o estado atual, documentado e intencional).

O PRD commitado no próprio branch (`memory/PRD.md`) já afirma: _"Nesta fase, a camada mobile usa
adapters tipados + dados mockados (sem backend/DB paralelo no Emergent). Os contratos reais de
`/mobile/bootstrap` e módulos serão auditados/fornecidos depois."_ — ou seja, o autor sabia que este
momento (esta auditoria) viria, e já deixou o import numa posição segura para receber os contratos
reais.

---

## 1. Migration Map

Mapeamento entre o path inventado em `frontend/src/api/shinaia.ts` (client fetch) e o endpoint real
que já existe no backend (`apps/web`), construído nas Waves 2–4 desta mesma sessão.

**Descoberta arquitetural importante**: este app tem persona de **staff/gestor de frota** ("Comandante
Shinã", tema dark, ver `design_guidelines.json`/PRD), não de cliente final — diferente do
`apps/mobile` real, que é "Shinã Cliente". Isso significa que o backend correto para a maior parte
destas telas são as rotas **staff-facing** (`requireTenantScope()`) e o branch `tenant_user` das
rotas `/api/mobile/*` já construídas (que já autenticam staff via `requireMobileContext()`), **não**
as rotas `/api/mobile/*` voltadas a `customer`/`operator` construídas para o app cliente.

| Path chamado pelo import   | Endpoint real equivalente                                                        | Status                             | Nota                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /mobile/bootstrap`    | `GET /api/mobile/bootstrap`                                                      | **Quase pronto**                   | Só falta o prefixo `/api` na base URL/rewrite; formato do payload precisa ser conferido campo a campo contra `BootstrapResponse` real                                                                                                                                                                  |
| `GET /operations/overview` | `GET /api/mobile/operations` (lista) ou `GET /api/mobile/dashboard` (contadores) | **Precisa decisão de shape**       | Não existe um endpoint "overview" único — o import terá que escolher entre a lista real (`/api/mobile/operations`) ou compor com o dashboard agregado                                                                                                                                                  |
| `GET /assets`              | `GET /api/mobile/assets`                                                         | **Pronto**                         | Shape já é lista de ativos; conferir campos                                                                                                                                                                                                                                                            |
| `GET /assets/{id}`         | `GET /api/mobile/assets/{id}`                                                    | **Pronto**                         | —                                                                                                                                                                                                                                                                                                      |
| `GET /tracking/positions`  | `GET /api/mobile/tracking/{resourceId}/current`                                  | **Gap real**                       | Real é por-recurso, não uma lista bulk de todas as posições atuais do tenant — precisaria de um novo endpoint agregado (`GET /api/mobile/tracking` bulk) ou N chamadas no client. **Não inventar um bulk endpoint sem decisão de produto** — documentar como gap.                                      |
| `GET /financial/overview`  | `GET /api/mobile/billing/summary`                                                | **Shape diferente**                | Real retorna `{receivables, overdue, paid, nextDue}`, não necessariamente o shape que `MOCK.financial` assume — precisa reconciliar os adapters `map*`                                                                                                                                                 |
| `GET /operators`           | `GET /api/operators` (staff)                                                     | **Pronto, path errado**            | Rota staff real já lista todos os operadores do tenant; só precisa apontar para o path certo                                                                                                                                                                                                           |
| `GET /clients`             | `GET /api/organizations` (staff)                                                 | **Nome de domínio diferente**      | "Clientes" no domínio real são `organizations` (tipo `customer`), não uma entidade `clients` separada — reconciliar terminologia no client, não criar tabela nova                                                                                                                                      |
| `GET /contracts`           | `GET /api/contracts` (staff)                                                     | **Pronto, path errado**            | —                                                                                                                                                                                                                                                                                                      |
| `GET /documents`           | _nenhum endpoint equivalente_                                                    | **Gap real, genuinamente ausente** | Documentos hoje só existem escopados por contrato (`/api/contracts/{id}/documents` staff, `/api/customer-contracts/{id}/documents` customer) — não existe uma "caixa de entrada" de documentos cross-contrato para o tenant inteiro. Se este app quer isso, é trabalho novo, não uma correção de path. |
| `GET /notifications`       | `GET /api/notifications` (staff, broadcast)                                      | **Pronto, path errado**            | —                                                                                                                                                                                                                                                                                                      |

**Nenhum path chama o backend Python morto (`backend/server.py`) ou qualquer host do Emergent.** O
único domínio de terceiros referenciado em todo o branch é `demobackend.emergentagent.com`, e só
dentro do backend Python morto (rota `/api/auth/google-session`) — nunca no fluxo real do frontend.

---

## 2. Classificação KEEP / ADAPT / REPLACE / DELETE / MERGE

| Componente                                                                              | Classificação                        | Justificativa                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/server.py`, `backend/requirements.txt`, `backend/tests/`, `backend/pytest.ini` | **DELETE**                           | Protótipo abandonado (MVP genérico de aluguel de carros, domínio `locador`/`locatario` — não é o domínio Shinã), testado só contra preview host do Emergent, zero uso pelo frontend atual. Nenhuma lógica daqui deve virar infraestrutura viva.                                                                                                                                                                      |
| `.emergent/` (inteiro: `cron/`, `markers/`, `emergent.yml`)                             | **DELETE**                           | Scaffolding da própria plataforma Emergent (manifesto de ambiente, scripts de cron/webhook, marcadores de bootstrap/restore) — não é código do produto Shinã.                                                                                                                                                                                                                                                        |
| `frontend/src/api/shinaia.ts`                                                           | **ADAPT**                            | Arquitetura correta (live-com-fallback-para-mock, nunca throw, token real do Supabase) — só precisa remapear os paths (ver Migration Map acima) e ajustar os tipos `map*` para o shape real de cada endpoint.                                                                                                                                                                                                        |
| `frontend/src/mocks/data.ts`                                                            | **KEEP**                             | Dataset coerente, usado de forma centralizada (só via `shinaia.ts`, nunca importado direto pelas telas) — bom fallback de demo/dev mesmo depois de ligar `USE_LIVE`.                                                                                                                                                                                                                                                 |
| `frontend/src/lib/supabase.ts`                                                          | **KEEP**                             | Client Supabase real, PKCE, storage seguro nativo (`expo-secure-store`) — mesmo padrão de segurança já usado no `apps/mobile` real.                                                                                                                                                                                                                                                                                  |
| `frontend/src/context/auth.tsx`                                                         | **KEEP**                             | OAuth real (Google/Apple via `signInWithOAuth`), nunca decodifica/confia em JWT no client. Modo demo (`signInDemo`) é local, sem rede, sem risco real — mas deve ser **removido ou gated atrás de env var de build** antes de qualquer release (ver Seção 5).                                                                                                                                                        |
| `frontend/app/auth/callback.tsx`, `frontend/src/utils/storage/*`                        | **KEEP**                             | Callback delega inteiramente ao SDK Supabase; storage tem separação clara entre KV geral (AsyncStorage) e KV seguro (`expo-secure-store`), com comentário explícito instruindo a usar o seguro para tokens.                                                                                                                                                                                                          |
| Telas (`(tabs)/*.tsx`, `module/*.tsx`, `index.tsx`)                                     | **KEEP/ADAPT**                       | Todas roteiam através de `shinaia.*()` de forma limpa — nenhuma tela precisa mudar quando os paths forem corrigidos. Única exceção:                                                                                                                                                                                                                                                                                  |
| `frontend/app/asset/[id].tsx` — timeline de manutenção                                  | **REPLACE** (esse trecho específico) | Array hardcoded inline (`{/* Maintenance timeline (mock) */}`) em vez de vir de `shinaia`/mock centralizado — precisa de um endpoint real de histórico de manutenção (não existe hoje no backend real; é um gap genuíno, documentar) ou, no mínimo, mover para `mocks/data.ts` por consistência.                                                                                                                     |
| `frontend/app.json` — identidade do app (bundle id, scheme, nome)                       | **REPLACE**                          | `com.emergent.carrentpro.x6dznq` é um placeholder do Emergent, inutilizável em produção. `scheme: "frontend"` colide trivialmente com qualquer outro app Expo no scheme default. Precisa de identidade oficial Shinã antes de qualquer build de release — decisão de produto pendente sobre se este é um terceiro app (staff/frota) distinto do `apps/mobile` (cliente) ou se deveria ser reconciliado/fundido nele. |
| `frontend/package.json` (deps)                                                          | **KEEP**, com uma poda               | Stack moderna (Expo 54, RN 0.81, React 19) e compatível com o resto do monorepo. `react-native-dotenv` está presente mas não é usado (o client usa `process.env.EXPO_PUBLIC_*` nativo do Expo) — remover na limpeza.                                                                                                                                                                                                 |
| `frontend/scripts/cmd-guard*`                                                           | **DELETE**                           | Tooling de instalação do próprio Emergent (guarda de comandos permitidos), não específico do produto.                                                                                                                                                                                                                                                                                                                |
| `memory/PRD.md`                                                                         | **MERGE** (como documentação)        | Honesto, explica a decisão arquitetural real ("sem backend Emergent para dados") e lista pendências reais — vale preservar como doc de design mesmo que o código seja reestruturado; não precisa virar código.                                                                                                                                                                                                       |
| `README.md`, `test_result.md`                                                           | **DELETE**                           | Boilerplate vazio do template do Emergent, sem conteúdo real preenchido.                                                                                                                                                                                                                                                                                                                                             |

---

## 3. Análise de Auth

**Veredito: real, correto, sem confiança client-side em claims.**

- Client Supabase real (`@supabase/supabase-js`), `flowType: 'pkce'`, `autoRefreshToken: true`,
  `persistSession: true` — mesmos princípios do `apps/mobile` real.
- Storage de sessão: **seguro no nativo** (`expo-secure-store`, backed por Keychain/Keystore); no
  web, delega ao comportamento padrão do supabase-js (localStorage) — trade-off documentado e
  necessário para o `code_verifier` do PKCE sobreviver ao redirect de página inteira no web.
- Login Google/Apple via `supabase.auth.signInWithOAuth()` direto — nunca via o backend Python morto
  (que tinha sua própria rota `/api/auth/google-session` trocando um `session_id` com um proxy hospedado
  pelo Emergent — **essa rota nunca é chamada pelo frontend atual**, mas é um lembrete de por que o
  backend Python precisa ser deletado, não só ignorado: se algum dia for religado por engano, reintroduz
  um fluxo de auth paralelo e uma dependência de um domínio de terceiros não controlado pela Shinã).
- Nenhuma decodificação manual de JWT no client — só leitura de `session.user`/`user_metadata` como
  devolvidos pelo SDK.
- **Ponto de atenção real**: existe um "modo demo" (`signInDemo()`) que não faz nenhuma chamada de rede
  — grava uma flag local e usa um usuário hardcoded. Hoje é o único caminho funcional (porque as chaves
  reais do Supabase ainda não foram fornecidas, per o PRD). Isso é aceitável em desenvolvimento, mas
  **precisa ser removido ou gated atrás de uma env var só-debug antes de qualquer build de release** —
  mesmo padrão de disciplina já exigido para o `EXPO_PUBLIC_DEV_ACCESS_TOKEN` do `apps/mobile` real (ver
  `docs/mobile/MOBILE_RELEASE_CHECKLIST.md`, Wave 4 Phase D).
- Colisão de conta (mesmo e-mail, providers diferentes): **não testado neste branch**, mesmo gap já
  documentado no checklist de release do `apps/mobile` real — depende de configuração do painel
  Supabase, não do código do app.

---

## 4. Análise de API Layer

**Veredito: arquitetura correta (fetch real com Bearer token + fallback tipado), mas 100% dos paths
precisam de correção antes de `USE_LIVE=1` ser seguro para ligar.**

- Único ponto de entrada HTTP: `get<T>(path, mock)` em `shinaia.ts` — nunca há chamada de rede
  espalhada pelas telas.
- Bearer token é sempre `supabase.auth.getSession().access_token` — o mesmo JWT que
  `requireMobileContext()` no backend real decodifica via `decodeSessionClaims()`. Estruturalmente
  compatível, zero trabalho de auth necessário além de apontar para o host certo.
- **Nenhum dos 10 paths de dado (fora `/mobile/bootstrap`) bate com a convenção real `/api/mobile/*`**
  — são paths "achatados" inventados (`/operations/overview`, `/assets`, `/tracking/positions`, etc.),
  sem o prefixo `/api` nem sempre o prefixo `/mobile`. Ver Migration Map (Seção 1) para o mapeamento
  completo.
- **Falha silenciosa por design**: qualquer erro de rede, 404, ou resposta não-OK cai automaticamente
  para o mock, sem nunca propagar o erro pra tela. Isso é uma escolha de UX defensável para uma demo,
  mas é um **risco real de integridade de produto** se `USE_LIVE=1` for ligado em produção com paths
  ainda errados: o app pareceria "funcionando" (mostrando dados) mas estaria silenciosamente servindo
  mock em vez de dado real, sem nenhum log/telemetria indicando isso ao time. Antes de ligar
  `USE_LIVE` em qualquer ambiente que não seja dev local, recomenda-se **instrumentar `source: 'mock'`
  vs `'live'` num crash/analytics reporter real (Sentry, já usado no `apps/web`)** — o campo já existe
  no retorno de `get()`, só não é usado por ninguém ainda.
- Nenhum endpoint de mutação (POST/PATCH) existe neste client — é 100% leitura, consistente com o que
  o backend real oferece por enquanto para a maioria destes domínios.

---

## 5. Análise de Mocks

**Veredito: mocks são reais, centralizados, e ativamente em uso — não scaffolding morto.**

- `frontend/src/mocks/data.ts` é importado por exatamente um arquivo (`shinaia.ts`) e devolvido sempre
  que `USE_LIVE` está desligado (hoje, sempre) ou quando a chamada live falha.
- Nenhuma tela importa `mocks/data` diretamente — a injeção é 100% centralizada, o que significa que
  ligar dados reais é uma mudança de configuração (`USE_LIVE=1` + `EXPO_PUBLIC_SHINAIA_API_URL` +
  corrigir os paths), não uma reescrita de tela por tela.
- Única exceção real: `frontend/app/asset/[id].tsx` tem uma timeline de manutenção **hardcoded inline**
  (fora do arquivo de mocks) — inconsistência pequena, fácil de corrigir movendo para `mocks/data.ts` ou
  esperando um endpoint real de histórico de manutenção (que não existe hoje — gap genuíno).
- Dataset em si (`MOCK`) é coerente e em português, plausível como demo — 8 ativos, 6 operadores, 6
  clientes, 8 contratos, 4 documentos, 4 notificações — nenhum dado sensível real, tudo fictício.

---

## 6. Análise de Backend Paralelo

**Veredito: existe um backend paralelo no repositório, mas está morto — não é chamado por nada no
fluxo ativo. Risco é de reativação acidental, não de uso presente.**

- `backend/server.py` é um FastAPI real e funcional (761 linhas), com seu próprio MongoDB, seu próprio
  JWT (HS256, `PyJWT`, segredo em env var), seu próprio hashing de senha (bcrypt), e até sua própria
  integração Stripe de checkout — um sistema de auth/billing/contrato **completo e paralelo** ao que
  já existe no `apps/web` real.
- **Isso violaria diretamente o princípio central de todas as Waves anteriores** ("toda regra sensível
  permanece server-side [no Shinã real]", "não implementar backend paralelo") — mas, criticamente,
  **nada no frontend atual o chama**. O histórico de commits confirma que ele foi criado na primeira
  iteração ("MVP de Gestão de Aluguel de Carros"), e a segunda iteração ("nova arquitetura") o abandonou
  deliberadamente em favor de apontar para a API real da Shinã.
- Os testes (`backend/tests/test_backend_api.py`) rodam contra
  `https://carrent-pro-10.preview.emergentagent.com` — um host de preview do próprio Emergent, nunca
  um domínio Shinã — confirmando que esse backend nunca foi pensado para produção Shinã, é
  literalmente sandbox do Emergent.
- **Recomendação**: deletar `backend/` e `.emergent/` por completo antes de qualquer merge — mantê-los
  no repositório, mesmo inertes, é uma superfície de confusão (alguém pode achar que é infraestrutura
  real) e um risco de reativação acidental (alguém rodar `uvicorn server:app` localmente sem saber que
  ele não representa a arquitetura real).

---

## 7. Análise de Segurança

| Achado                                                                                                                      | Severidade                           | Nota                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Python morto expõe seu próprio ciclo de auth/JWT/senha, paralelo ao real                                            | **MÉDIO** (mitigado por estar morto) | Risco é de reativação acidental, não de exploração ativa hoje. Ação: deletar, não só ignorar.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Rota morta `/api/auth/google-session` troca sessão com `demobackend.emergentagent.com` (domínio de terceiro, não Shinã)     | **MÉDIO** (mitigado por estar morto) | Se o backend Python fosse religado, dados de sessão trafegariam por um host que a Shinã não controla. Reforça a recomendação de DELETE, não ADAPT.                                                                                                                                                                                                                                                                                                                                                |
| `requirements.txt` do backend morto inclui SDKs de IA/mídia não utilizados (`openai`, `google-generativeai`, `boto3`, etc.) | **BAIXO**                            | Superfície de dependência desnecessária caso alguém rode esse backend por engano; some junto com o DELETE.                                                                                                                                                                                                                                                                                                                                                                                        |
| Falha silenciosa (mock fallback) sem instrumentação de `source: live\|mock`                                                 | **MÉDIO**                            | Não é uma vulnerabilidade de acesso, mas é um risco de integridade: dados fictícios podem ser confundidos com reais em produção sem nenhum sinal visível. Corrigir antes de `USE_LIVE=1` em qualquer build não-dev.                                                                                                                                                                                                                                                                               |
| Modo demo (`signInDemo`) bypassa autenticação real sem rede                                                                 | **BAIXO enquanto `USE_LIVE=0`**      | Como todo dado nesse caminho é mock, não há exposição de dado real. Mas se alguém ligar `USE_LIVE=1` num build com o botão de demo ainda visível, uma sessão demo (sem token real) faria chamadas `fetch` sem `Authorization` — o backend real corretamente devolveria 401 via `requireMobileContext()` (nenhum vazamento), mas a UX ficaria quebrada de forma confusa. Gated atrás de flag de build antes do release, mesmo padrão já exigido para o `EXPO_PUBLIC_DEV_ACCESS_TOKEN` do app real. |
| `.emergent/cron/*` — scripts de webhook/cron do Emergent presentes no branch                                                | **BAIXO**                            | Não roda automaticamente fora do ambiente do Emergent; risco é só de confusão/poluição do repositório. Remove junto com `.emergent/`.                                                                                                                                                                                                                                                                                                                                                             |
| Nenhum secret de servidor (service role, Stripe secret, senha de DB) encontrado no client                                   | ✅ limpo                             | Único par de chaves são `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, ambas públicas por design (mesmo padrão do `apps/mobile` real).                                                                                                                                                                                                                                                                                                                                               |
| Bundle identifier / package Android são placeholders do Emergent (`com.emergent.carrentpro.x6dznq`)                         | **BAIXO, mas bloqueador de release** | Não é uma vulnerabilidade, mas torna o app inutilizável para publicação em loja sem correção — mesma categoria de bloqueador já registrada para o `apps/mobile` real no `MOBILE_RELEASE_CHECKLIST.md`.                                                                                                                                                                                                                                                                                            |
| Storage de sessão nativo usa `expo-secure-store` (Keychain/Keystore)                                                        | ✅ correto                           | Mesmo padrão de segurança do `apps/mobile` real.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Nenhuma URL hardcoded de localhost/HTTP em texto plano no client                                                            | ✅ limpo                             | Toda configuração de host vem de `EXPO_PUBLIC_*` env vars.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## Resumo executivo

- **Não há backend paralelo em uso** — existe um morto (`backend/`), classificado **DELETE**.
- **Não há vazamento de dado real nem credencial de servidor no client.**
- **Auth é real e correta** (Supabase PKCE), com um modo demo que precisa ser gated antes de release.
- **A API layer está arquiteturalmente pronta para ligar em dados reais** — só precisa de correção de
  paths (Migration Map, Seção 1) e reconciliação de shape/nomenclatura (`clients` → `organizations`,
  `financial/overview` → `billing/summary`, etc.), não uma reescrita.
- **Gaps genuínos identificados** (não inventar, decisão de produto pendente): endpoint bulk de
  posições de tracking, endpoint de documentos cross-contrato ("inbox" unificado), endpoint de
  histórico de manutenção de ativo.
- **Este app é uma persona diferente** do `apps/mobile` real (staff/gestor de frota "Shinã I.A." vs.
  cliente final "Shinã Cliente") — decisão de produto pendente sobre se vira um terceiro app oficial
  ou se é fundido/reconciliado com o app existente antes de M22.

---

## Human Decision After M21

Registrado no gate M22 (2026-08-17). Ver [ADR_UNIFIED_MOBILE_APP.md](../adr/ADR_UNIFIED_MOBILE_APP.md)
para o raciocínio completo.

```
M21: PASSED

PRODUCT DECISION:
UNIFIED SHINÃ MOBILE APPLICATION

Emergent frontend:
PRIMARY VISUAL FOUNDATION

Existing apps/mobile:
FUNCTIONAL FLOW SOURCE / SELECTIVE MERGE

Emergent Python backend:
DELETE

.emergent scaffolding:
DELETE

Mocks:
DEV/TEST ONLY

Production mock fallback:
PROHIBITED

M22:
GO
```

_Fim do relatório M21. Nenhum código foi alterado nesta milestone. Nenhum merge foi realizado ainda
— a execução do merge/integração acontece em M22, sob a decisão registrada acima._
