# Shinã Mobile — Android Performance Audit

**Data:** 2026-08-20
**Ambiente:** auditoria estática de código (sem Android físico/emulado disponível neste ambiente — não é um benchmark ao vivo). Nenhum número de tempo (ms, FPS, p50/p95, curva de memória) foi medido; onde a especificação pedia uma métrica ao vivo, a tabela abaixo marca `não medido — requer dispositivo` em vez de estimar.
**Escopo respeitado:** nenhuma feature nova, nenhum redesign de tela, nenhum refactor grande sem evidência de gargalo. Correções aplicadas são todas de baixo risco (backend query, memoização, timeout).

---

## Sumário

| Metric                              |                                             Before |                        After |                Target | Status                                                  |
| ----------------------------------- | -------------------------------------------------: | ---------------------------: | --------------------: | ------------------------------------------------------- |
| Cold start                          |                    não medido — requer dispositivo |                   não medido |                 ≤ 3 s | ⚠️ requer dispositivo                                   |
| Warm start                          |                    não medido — requer dispositivo |                   não medido |                 ≤ 1 s | ⚠️ requer dispositivo                                   |
| Bootstrap p50/p95                   |                    não medido — requer dispositivo |                   não medido |             p95 ≤ 1 s | ⚠️ requer dispositivo                                   |
| Dashboard API (linhas transferidas) | todas as linhas de `operations`+`assets` do tenant | 0 linhas (4 `count` queries) |     mínimo necessário | ✅ corrigido (código)                                   |
| Context re-renders (auth/persona)   |                      objeto recriado a cada render |        memoizado (`useMemo`) | sem re-render espúrio | ✅ corrigido                                            |
| HTTP timeout                        |               nenhum (pode travar indefinidamente) |          15 s + erro tratado |       resposta finita | ✅ corrigido                                            |
| UI FPS                              |                    não medido — requer dispositivo |                   não medido |               ~60 FPS | ⚠️ requer dispositivo                                   |
| Memória (ciclo de 10x navegação)    |                    não medido — requer dispositivo |                   não medido |               estável | ⚠️ requer dispositivo — **ver regressão Hermes abaixo** |

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

## Device/network used

Nenhum — auditoria estática de código, sem Android físico/emulado disponível neste ambiente. Todas as métricas de tempo/FPS/memória na tabela acima requerem uma rodada de medição real (build release/preview em aparelho Android intermediário) antes de poder confirmar "antes/depois" de verdade, conforme a seção 17 da especificação ("não declarar melhoria sem medida").
