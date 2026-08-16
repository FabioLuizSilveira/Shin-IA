# PRD — Shinã I.A. (Plataforma de Gestão de Operações & Frota)

## Direção atual (pivot)
App mobile enterprise "Shinã I.A." que integra com o **backend próprio da Shinã** em `https://api.shinaia.com.br`.
Auth via **Supabase client-side** (Google + Apple). Nesta fase, a camada mobile usa **adapters tipados + dados mockados**
(sem backend/DB paralelo no Emergent). Os contratos reais de `/mobile/bootstrap` e módulos serão auditados/fornecidos depois.

## Identidade visual
- Dark-First Utility. Paleta do usuário: Navy Deep #0F172A, Electric Blue #2563EB, Neural Cyan #06B6D4, Growth Violet #7C3AED.
- Tipografia: Space Grotesk (display) + Plus Jakarta Sans (texto), carregadas via expo-font.

## Arquitetura
- **Sem backend Emergent para dados.** `src/api/shinaia.ts` = adapters tipados que chamam api.shinaia.com.br com Bearer = Supabase access_token e caem em mocks (`src/mocks/data.ts`) quando offline.
- **Auth**: `src/lib/supabase.ts` (SecureStore no nativo, storage util no web) + `src/context/auth.tsx` (OAuth Google/Apple + modo demonstração local).
- **Navegação**: 5 bottom tabs — Operações, Ativos, Tracking, Financeiro, Menu. Menu abre módulos: Operadores, Clientes, Contratos, Documentos, Notificações. Rotas de detalhe: `asset/[id]`.

## Personas
- Gestor de Operações (Comandante Shinã) — visão de KPIs, frota, tracking, financeiro e módulos administrativos.

## Implementado (2026-06-16)
- ✅ Login dark (neural bg) com Google + Apple (Supabase) e modo demonstração
- ✅ Operações: hero KPI (saúde da frota) + sparkbar, tiles de contexto, feed de atividade
- ✅ Ativos: busca, chips de filtro (scroll horizontal), health bars, status chips, foto — detalhe do ativo com timeline de manutenção
- ✅ Tracking: mapa dark full-bleed com pins por status + bottom sheet com lista de veículos
- ✅ Financeiro: resultado líquido (violet), receita/despesas, gráfico de barras 6m, breakdown por categoria
- ✅ Menu: perfil + 5 módulos + logout
- ✅ Módulos: Operadores, Clientes, Contratos, Documentos, Notificações (todos com mocks)
- ✅ Camada de dados com fallback live→mock e `source` (Ao vivo/Demonstração)

## Pendências do usuário (bloqueiam produção)
- **Supabase**: fornecer EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY reais + configurar callbacks Google/Apple no Supabase.
- **Contratos da API**: OpenAPI/campos reais de /mobile/bootstrap e módulos (após auditoria) para ajustar os adapters/tipos.
- **Assets de marca**: logo/ícone oficiais (os caminhos enviados não foram anexados).

## Backlog
- P0: ligar Supabase real + mapear tipos live; substituir mocks por dados reais nos adapters.
- P1: mapa nativo (react-native-maps) para tracking real; pull-to-refresh em todos os módulos; push notifications (Emergent) sob pedido.
- P2: criação/edição em módulos (operadores, contratos), upload de documentos (Object Storage), busca global.

## Próximas tarefas
- Receber chaves Supabase e OpenAPI → trocar mocks por live, validar OAuth ponta-a-ponta.
