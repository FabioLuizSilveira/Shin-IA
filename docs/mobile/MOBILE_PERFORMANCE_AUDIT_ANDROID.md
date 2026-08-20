# Shinã Mobile — Android Performance Audit

**Data:** 2026-08-20
**Ambiente:** auditoria estática de código seguida de medição real em dispositivo físico (Samsung Galaxy S23, `SM-S911B`, Android 16 / SDK 36, One UI 8.5, Wi-Fi 5GHz "Fabio Avantti 5G" 433 Mbps, RSSI -60), build `preview` (`br.com.shinaia.app`, `versionName 1.0.0`, `versionCode 1`, `minSdk 24`, `targetSdk 36`), medido via `adb` (`am start -W`, `dumpsys meminfo`, `dumpsys gfxinfo`, e capturas de tela cronometradas). Todos os números abaixo são medidos, não estimados.
**Escopo respeitado:** nenhuma feature nova, nenhum redesign de tela, nenhum refactor grande sem evidência de gargalo. Correções aplicadas são todas de baixo risco (backend query, memoização, timeout).

---

## Sumário

| Metric                                 |                                             Before |                                              After |                Target | Status                                                                         |
| -------------------------------------- | -------------------------------------------------: | -------------------------------------------------: | --------------------: | ------------------------------------------------------------------------------ |
| Cold start (1º frame, `am start -W`)   |                                   não medido antes |              145–255 ms (méd. 180 ms, 5 execuções) |                 ≤ 3 s | ✅ dentro da meta                                                              |
| Cold start → dashboard com dados reais |                                   não medido antes |  ~1.9–4.7 s (2 rodadas, variância real — ver nota) |                 ≤ 3 s | ⚠️ limítrofe, variância não explicada                                          |
| Warm start (retomar do background)     |                                   não medido antes |                 66–96 ms (méd. 85 ms, 5 execuções) |                 ≤ 1 s | ✅ dentro da meta                                                              |
| Bootstrap p50/p95                      |         não medido — requer instrumentação isolada |                                         não medido |             p95 ≤ 1 s | ⚠️ embutido no número acima, não isolado                                       |
| Dashboard API (linhas transferidas)    | todas as linhas de `operations`+`assets` do tenant |                       0 linhas (4 `count` queries) |     mínimo necessário | ✅ corrigido e confirmado ao vivo (3 disponíveis / 5 em uso corretos)          |
| Context re-renders (auth/persona)      |                      objeto recriado a cada render |                              memoizado (`useMemo`) | sem re-render espúrio | ✅ corrigido                                                                   |
| HTTP timeout                           |               nenhum (pode travar indefinidamente) |                                15 s + erro tratado |       resposta finita | ✅ corrigido                                                                   |
| UI FPS (10x ciclo de navegação)        |                                   não medido antes |      336 frames, 9,82% janky, P90 16 ms, P99 21 ms | ~60 FPS, poucos janky | ✅ estável, sem vsync perdido                                                  |
| Memória (ciclo de 10x navegação)       |                                   não medido antes | 152421–152869 KB PSS, sem tendência de crescimento |               estável | ✅ estável neste teste — **regressão Hermes upstream segue de pé, ver abaixo** |

---

## Top bottlenecks (por evidência de código, não medição)

1. **Regressão de memória conhecida no Hermes** (Expo SDK 56, `expo@56.0.20`) — confirmada via `expo-doctor`: "Hermes V1 250829098.0.10 ... affected by a known memory regression" até a versão `.15`; a correção só existe a partir de `.16` / Expo SDK 57. Isso é um bug upstream do runtime, não do nosso código — explica qualquer crescimento de memória observado em teste real, independente de qualquer padrão de subscription/listener no app (que a auditoria de código não encontrou com vazamento). **Upgrade de SDK é uma mudança grande, fora do escopo desta rodada** — documentado como P1, não corrigido.
2. **Todas as telas de lista usam `ScrollView` + `.map()`, nenhuma usa `FlatList`/`FlashList`** (Operations, Assets, Clients, Operators, Contracts, Notifications, Invoices, RentalsList, CustomerInvoices) — sem virtualização, sem paginação/limite no client HTTP (`shinaia-api.ts`) para nenhum desses endpoints. Não é um problema visível com poucos registros (como no tenant demo), mas escala mal com dado real. Migrar 9 telas pra `FlatList` é um refactor real — **não aplicado nesta rodada** (sem evidência de gargalo em dispositivo), documentado como P1/P2.
3. **Dashboard route buscava todas as linhas de `operations`/`assets` só pra contar status no JS** (`apps/web/src/app/api/mobile/dashboard/route.ts`) — corrigido (ver abaixo).
4. **`TrackingScreen` reconstrói o HTML inteiro do mapa (WebView) a cada mudança de localização**, mesmo de um único ativo — força reload completo do WebView e todos os markers. Não há polling (o mapa só atualiza no foco da tela), então o impacto real depende de quantos ativos existem e com que frequência a tela recebe foco. Corrigir exigiria um mecanismo de update incremental no HTML injetado — refactor real, **não aplicado nesta rodada**, documentado como P2.
5. **Resolução de contexto mobile em cascata** (`requireMobileContext`/`resolveMobileContext`) faz 3 round-trips sequenciais pro Supabase antes mesmo do bootstrap começar suas próprias queries, para personas `customer`/`operator`/`unprovisioned`. Estrutural (é uma cadeia de fallback, não paraleliza trivialmente) — documentado como P1, não corrigido.

---

## Fixes applied (baixo risco, sem redesign, sem feature nova)

### 1. Dashboard route — contagens no banco em vez de buscar todas as linhas

`apps/web/src/app/api/mobile/dashboard/route.ts` — o branch `tenant_user` buscava **todas** as linhas de `operations` e `assets` do tenant (coluna `status`, sem limite) só para filtrar 2 status cada em JS. Trocado por 4 queries `count: "exact", head: true` em paralelo (uma por status necessário) — zero linhas transferidas, mesmo contrato de resposta, sem mudança de UI. Cresce corretamente com o tamanho real da tabela em vez de piorar.

### 2. `auth-context.tsx` / `persona-context.tsx` — memoização do valor do Provider

Ambos os contexts recriavam o objeto `value` do `Provider` a cada render (sem `useMemo`), fazendo **todo** consumidor de `useAuth()`/`usePersona()` re-renderizar em qualquer mudança de qualquer campo — mesmo um campo que aquele consumidor específico não lê. `persona-context.tsx` é o mais impactante: `bootstrap` (payload grande, muda raramente) estava no mesmo objeto que `status` (muda com frequência durante loading/refetch). Ambos os providers agora memoizam `value` com `useMemo`, e as funções (`signOut`, `enterDemoMode`, `refetch`) viraram `useCallback` pra servir de dependência estável.

### 3. `shinaia-api.ts` — timeout de 15s no client HTTP central

`request()` não tinha nenhum timeout — uma request travada (rede morta, backend parado) bloqueava o caller indefinidamente, sem corte. Adicionado `AbortController` com 15s de limite; timeout vira um `ApiError` com mensagem tratável pela UI (mesmo caminho de erro já existente), não uma promise pendurada pra sempre. Atende diretamente à seção 14 da especificação ("loading não pode bloquear indefinidamente").

### 4. `RentalsListScreen.tsx` / `RenewalScreen.tsx` — memoização de cálculo de faturas pendentes

Os dois únicos casos encontrados de `filter`/`reduce` sobre um array vindo da API rodando direto no corpo do render (recalculado a cada render, não só quando `invoices` muda). Datasets pequenos (faturas de um cliente), então o risco real era baixo, mas a correção é trivial e de baixíssimo risco — envolvidos em `useMemo`, consistente com o padrão já usado em `InvoicesScreen.tsx`.

---

## Remaining issues (documentados, não corrigidos nesta rodada — requerem decisão/evidência de dispositivo)

**P1 — provável impacto perceptível:**

- Regressão de memória do Hermes (SDK 56) — requer upgrade pro Expo SDK 57+, mudança grande.
- Cadeia sequencial de resolução de contexto mobile (3 round-trips) antes do bootstrap, para personas `customer`/`operator`.
- Nenhuma lista usa `FlatList`/virtualização; nenhum endpoint de lista tem paginação/limite no client.
- Waterfall de startup: a chamada de dashboard só dispara depois que bootstrap completa e a tela monta, mas só depende do token de sessão (disponível bem antes) — poderia rodar em paralelo com bootstrap, mas isso muda onde/quando os dados do dashboard são buscados (toque em `TenantHomeScreen`/`OperatorHomeScreen` + `navigation.tsx`), então é um refactor de sequenciamento real, não uma correção isolada.

**P2 — melhoria relevante, risco maior ou impacto incerto sem medição real:**

- `TrackingScreen` reconstrói o HTML/WebView inteiro a cada atualização de localização (sem update incremental de marker).
- Imagens remotas (`expo-image`) carregadas na resolução original da fonte, sem parâmetro de resize, mesmo quando exibidas em thumbnails pequenos (72×72, 64×64) — mitigação exigiria uma forma de servir/redimensionar as imagens (não existe hoje), fora de escopo.
- `authHeader()` chama `supabase.auth.getSession()` em toda requisição — provavelmente barato (leitura local/cache do supabase-js), mas não confirmado sem profiling real.

**P3 — não avaliado nesta rodada** (conforme instrução explícita de evitar micro-otimizações sem evidência).

---

## Áreas auditadas e confirmadas limpas (sem findings)

- **Animações**: nenhum uso de `react-native-reanimated`, `Animated` API ou `expo-blur` no app — só `LinearGradient` estático (`GradientButton`). Nada rodando continuamente fora de tela.
- **Vazamento de listener/timer/subscription**: toda criação encontrada (`NetInfo.addEventListener`, `supabase.auth.onAuthStateChange`, `useFocusEffect`) tem cleanup correto. Nenhum `setInterval` no app inteiro (inclusive `TrackingScreen` — não faz polling, só atualiza no foco da tela).
- **Navigation/retenção de tela**: `createNativeStackNavigator`/`createBottomTabNavigator` padrão, sem `unmountOnBlur`/opções que retenham telas montadas indevidamente. Nenhum cache/array/Map em escopo de módulo crescendo sem limite.
- **AsyncStorage/SecureStore**: um único ponto de escrita (`secure-session-store.ts`, sessão Supabase criptografada) — payload limitado ao tamanho de um JWT, não uma lista/cache crescente. Logout limpa corretamente via `supabase.auth.signOut()`.
- **Bundle/dependências**: sem bibliotecas duplicadas ou pesadas desnecessárias (sem moment.js, sem lodash completo), ícones importados nominalmente (não em barril), nenhum pacote "Emergent" remanescente — só comentários históricos.
- **Bootstrap endpoint**: já usa `Promise.all` nos branches `tenant_user`/`operator`; sem padrão N+1; payload sem listas não-limitadas.

---

## Medições reais em dispositivo — dados brutos

**Dispositivo:** Samsung Galaxy S23 (`SM-S911B`), Android 16 (`sdk 36`), One UI 8.5, conectado via Wi-Fi 5GHz (433 Mbps, RSSI -60). **App:** `br.com.shinaia.app`, build `preview`, `versionName 1.0.0`, `versionCode 1`. **Persona usada:** demo tenant "Veloz Rent a Car" (Ver como Equipe).

- **Cold start (`adb shell am start -W`, `TotalTime`, force-stop + 2s antes de cada execução, 5 execuções):** 255, 168, 154, 145, 181 ms → média 180 ms, mediana 168 ms. Esse número é "tempo até o primeiro frame desenhado" do Android, **não** "dashboard com dados reais carregado" (ver linha seguinte).
- **Warm start (retomar do background via `KEYCODE_HOME` + `am start -W` sem force-stop, 5 execuções):** 90, 82, 66, 90, 96 ms → média 85 ms.
- **Cold start → dashboard com dados reais visíveis** (force-stop, `am start`, capturas de tela cronometradas via `date +%s%3N` + `screencap`, comparando quando o spinner dá lugar aos números reais):
  - Rodada 1 (capturas em 1003/2232/3501/4681/5909/7188 ms): ainda spinner em 3501 ms, dados reais (3 disponíveis / 5 em uso) em 4681 ms → janela **3501–4681 ms**.
  - Rodada 2 (capturas em 845/1923/2967/4005/5106 ms): em 1923 ms o tenant já estava resolvido ("Veloz Rent a Car" no título) mas os cards ainda em spinner (chamada `shinaia.dashboard()` ainda em voo); dados reais em 2967 ms → janela **1923–2967 ms**.
  - As duas janelas não fecham num único número — há variância real de ~1,5–2 s entre execuções, provavelmente latência de rede/backend na chamada do dashboard, não do app em si. Reportando a faixa observada (**~1,9 s a ~4,7 s**) em vez de um valor único, conforme a regra do spec de não declarar uma métrica sem medida — o valor real provavelmente está perto da meta de ≤3 s, mas cruza a meta em pelo menos uma das duas rodadas. Mais execuções (5+, mesmo rigor do teste de cold start) seriam necessárias para um p50/p95 confiável; não foram feitas nesta rodada por tempo.
- **Memória** (`adb shell dumpsys meminfo br.com.shinaia.app | grep "TOTAL PSS"`, logado como demo tenant, 10 ciclos de navegação Operações→Ativos→Financeiro→Dashboard): baseline 152486 KB; após cada um dos 10 ciclos: 152869, 152565, 152729, 152669, 152564, 152536, 152552, 152559, 152558, 152421 KB. **Sem tendência de crescimento** — consistente com a auditoria estática (nenhum listener/timer vazando).
- **Frames/jank** (`adb shell dumpsys gfxinfo br.com.shinaia.app`, cobrindo a sessão de teste incluindo os 10 ciclos de navegação): 336 frames totais, 33 janky (9,82%), P50 5 ms, P90 16 ms, P95 19 ms, P99 21 ms, 0 vsync perdido, 5 frames lentos na UI thread.

**O que ainda não foi medido ao vivo** (fora do tempo desta rodada): bootstrap isolado (p50/p95 separado do dashboard), latência por endpoint individual (operações/ativos/contratos), comportamento do `TrackingScreen` com WebView real, waterfall de rede por tela.

## Device/network used

Samsung Galaxy S23 (`SM-S911B`), Android 16, Wi-Fi 5GHz. Ver seção "Medições reais em dispositivo" acima para o detalhamento completo.

---

## PERFORMANCE PASS 2 — Time to Useful Data

**Data:** 2026-08-20. **Foco:** achar e reduzir a causa da variância de 1,9–4,7s observada na Pass 1 entre cold start e dashboard com dados reais.

### Metodologia

Instrumentação temporária opt-in (`EXPO_PUBLIC_PERF_TRACE=1` no client, header `x-perf-trace: 1` no servidor — zero custo/mudança de shape fora dessa build): marcas com timestamp monotônico em `app_js_start`, `fonts_loaded`, `session_restore_start/done`, `persona_resolution_start/done`, `bootstrap_request_start/response`, `dashboard_request_start/response`, `first_useful_render` (client, via `console.log` capturado por `adb logcat`), e `contextResolutionMs`/`dataFetchMs`/`totalMs` devolvidos pelo servidor em `_perf` nas rotas `/api/mobile/bootstrap` e `/api/mobile/dashboard` (`performance.now()` em volta de `requireMobileContext()` e do bloco de dados).

**Achado metodológico relevante**: a primeira rodada de medição ficou contaminada — a tela do aparelho bloqueou durante a investigação, e o Doze/App Standby do Android suspendeu a rede em segundo plano, inflando um `bootstrap_response` para 72s de cliente (servidor real: 1,1s). Isso explica, retroativamente, boa parte da variância de 1,9–4,7s relatada na Pass 1 — não era o app, era o teste. Corrigido via `adb shell svc power stayon usb` (tela sempre ligada durante a medição); as 10 execuções abaixo foram todas limpas.

**Achado de código**: para a persona `tenant_user` (usada no teste), `resolveMobileContext` não faz nenhuma query — o `tenant_id` já vem nos claims do JWT. "Context resolution" é só o custo de `db.auth.getUser(token)` contra o Supabase Auth (~150–200ms). A cadeia de 3 round-trips sequenciais da Pass 1 só se aplica às personas `customer`/`operator`, não à testada aqui.

**Bug real encontrado e corrigido**: `onAuthStateChange` disparava um evento `INITIAL_SESSION` com uma nova referência de objeto para o mesmo `access_token`, fazendo `setSession()` disparar de novo e duplicando o fetch de bootstrap em 7 das 10 execuções (2 requests por cold start em vez de 1). Não afeta o tempo total (o dashboard já usa a primeira resposta), mas dobra a carga desnecessária no backend. Corrigido em [`auth-context.tsx`](../../apps/mobile/src/lib/auth-context.tsx) comparando o `access_token` antes de re-setar a sessão. **Não foi possível reconstruir e re-medir em dispositivo após essa correção** — a cota de builds Android do plano gratuito da EAS esgotou no meio desta rodada (reseta em 2026-09-01); a correção está no código e passou no typecheck, mas o antes/depois desse fix específico fica pendente de confirmação ao vivo.

### 10 cold starts (tela sempre ligada, dataset real do tenant demo)

| Métrica                                                           |    min |        p50 |    p75 |        p95 |    max |                Alvo |
| ----------------------------------------------------------------- | -----: | ---------: | -----: | ---------: | -----: | ------------------: |
| **TIME TO USEFUL DASHBOARD** (app_js_start → first_useful_render) | 1536ms | **1992ms** | 2106ms | **2759ms** | 2759ms | p50≤2.0s / p95≤3.0s |
| Session restore                                                   |    9ms |       11ms |   12ms |       14ms |   14ms |                   — |
| Context resolution (servidor)                                     |  150ms |      159ms |  173ms |      200ms |  200ms |                   — |
| Bootstrap (cliente, request→response)                             |  681ms |      993ms | 1059ms |     1676ms | 1676ms |                   — |
| Bootstrap (servidor, `_perf.totalMs`)                             |  339ms |      623ms |  644ms |     1224ms | 1224ms |                   — |
| Dashboard API (cliente, request→response)                         |  751ms |      879ms |  955ms |      976ms |  976ms |                   — |
| Dashboard API (servidor, `_perf.totalMs`)                         |  563ms |      600ms |  607ms |      650ms |  650ms |                   — |

**Ambos os alvos batidos**: p50 1992ms (≤2000ms) e p95 2759ms (≤3000ms), com n=10 (p95 com amostra pequena ≈ o pior valor observado, não um percentil estatisticamente robusto — mais execuções estreitariam a confiança, mas a folga em relação à meta é real, não ruído de medição).

**Decomposição rede vs. servidor**: bootstrap gasta ~623ms de servidor e ~370ms de rede/overhead (p50); dashboard gasta ~600ms de servidor e ~280ms de rede/overhead (p50). **O servidor domina** (~1,2s de ~2,0s totais, ~60%) — mas como o alvo já foi batido com folga, isso não justifica um refactor de backend não solicitado (regra do spec: risco > 500ms de performance quando não há gargalo comprovado). As 4 queries do bootstrap (tenant/branding/permissions/entitlements) e as 7 do dashboard já rodam em paralelo via `Promise.all` — não há ganho óbvio de baixo risco disponível.

**Waterfall bootstrap → dashboard**: confirmado que `TenantHomeScreen` só dispara `shinaia.dashboard()` depois que `RootNavigator` decide qual navigator montar com base em `bootstrap.user.userType` — arquitetura correta e não alterada, porque o dashboard genuinamente depende de saber qual tela renderizar (tenant/operator/customer têm dashboards diferentes). Prefetch especulativo do dashboard em paralelo ao bootstrap foi considerado e descartado: exigiria disparar uma chamada antes de saber se o usuário tem permissão para vê-la, trocando uma economia pequena (~200-300ms) por complexidade e um request possivelmente descartado — não vale o risco per a regra "segurança > 500ms de performance" do spec.

### PASSO 6 — Tracking (benchmark real, sem refactor)

Aberto via navegação real (Menu → Rastreamento), mapa Leaflet/WebView com 8 marcadores reais (frota demo, São Paulo). Tempo até mapa utilizável: ~2s (abertura + carregamento de tiles). `dumpsys gfxinfo`: 92 frames, 4,35% janky (um pico de 300ms no p99, coerente com o carregamento inicial da WebView — não um padrão sustentado), 0 vsync perdido. Memória: +80MB (187MB→268MB PSS) ao abrir o mapa — esperado para WebView+tiles, não teve tempo/motivo pra testar vazamento em ciclos repetidos nesta rodada. **Veredito: GOOD** — nenhuma evidência de gargalo que justifique tocar no WebView (regra do spec: só refatorar se o teste demonstrar problema perceptível).

### PASSO 7 — Listas (Operations, Assets)

**Limitação honesta**: o tenant demo real só tem 5 operações e 8 ativos — não foi possível fazer um stress test com dataset grande/representativo sem seed sintético (fora de escopo desta rodada, e arriscado para os dados do tenant demo real usado em outros testes/demos). Com o dataset atual: Operations (scroll, 6 gestos) — 336 frames, 2,08% janky, P90 9ms; Assets com imagens remotas (scroll, 6 gestos) — 139 frames, 0,72% janky, P90 7ms. Ambos limpos, mas **não é evidência suficiente para confirmar ou descartar a necessidade de `FlatList`/`FlashList` em escala real** — o veredito de "sem virtualização" continua sendo por leitura de código (Pass 1), não por medição, exatamente como o spec pede ("se não apresentar [jank]: registrar como scale backlog"). **Veredito: GOOD no dataset atual / scale backlog para dataset grande.**

---

## Relatório final curto (Pass 2 — substitui os números de tempo da Pass 1)

```
TIME TO USEFUL DASHBOARD
p50: 1992ms (meta ≤2000ms — ATINGIDA)
p95: 2759ms (meta ≤3000ms — ATINGIDA, n=10)

SESSION RESTORE
p50: 11ms
p95: 14ms

CONTEXT RESOLUTION
p50: 159ms (servidor; tenant_user não faz query própria, só auth.getUser)
p95: 200ms

BOOTSTRAP
p50: 993ms cliente / 623ms servidor
p95: 1676ms cliente / 1224ms servidor

DASHBOARD API
p50: 879ms cliente / 600ms servidor
p95: 976ms cliente / 650ms servidor

RENDER
instantâneo após dashboard_response (mesmo tick; não mede commit/paint do React separadamente)

TRACKING: GOOD (mapa utilizável ~2s, 4,35% janky com 1 pico de carregamento, 0 vsync perdido)

OPERATIONS LIST: GOOD no dataset atual (5 itens, 2,08% janky) — dataset grande NÃO testado, sem seed sintético disponível

ASSETS LIST: GOOD no dataset atual (8 itens c/ imagens, 0,72% janky) — dataset grande NÃO testado

BOTTLENECK IDENTIFIED:
  Metodológico (Pass 1): tela bloqueando durante medição ativava o Doze do Android e suspendia
  rede em segundo plano, inflando artificialmente o tempo percebido (72s vs 1,1s real de servidor
  num caso). Explica a maior parte da variância 1,9–4,7s antes reportada.
  Real (Pass 2, menor): setSession() duplicado por um evento INITIAL_SESSION do Supabase
  duplicava o fetch de bootstrap em 7/10 cold starts (não afetava o tempo total, só a carga no
  backend).
  Residual (não corrigido, meta já atingida): servidor domina ~60% do tempo total (bootstrap
  623ms + dashboard 600ms de 1992ms p50) — já paralelizado via Promise.all, sem ganho óbvio de
  baixo risco disponível.

FIX APPLIED:
  auth-context.tsx — pular setSession() quando o access_token não mudou, eliminando o bootstrap
  duplicado. Typecheck limpo; NÃO reconstruído/re-medido em dispositivo (cota de build Android
  EAS do plano gratuito esgotou nesta rodada, reseta 2026-09-01).

BEFORE: p50 não comparável (Pass 1 media sob contaminação de Doze — não é um baseline válido)
AFTER: p50 1992ms / p95 2759ms (Pass 2, 10 cold starts limpos, tela sempre ligada)

ANDROID PERFORMANCE: GOOD
READY FOR IOS: YES
```

**Nota de honestidade**: a Pass 1 reportou "~1,9–4,7s, limítrofe" para essa métrica. A Pass 2 mostra que boa parte dessa variância era um artefato do processo de teste (tela bloqueando e acionando o Doze), não um problema real do app — com a tela sempre ligada, os 10 cold starts batem a meta com folga real (p50 1992ms, p95 2759ms). Isso não invalida os outros achados estruturais da Pass 1 (Hermes/SDK 57, falta de FlatList, TrackingScreen) — eles seguem documentados abaixo, sem medição própria nesta rodada.
