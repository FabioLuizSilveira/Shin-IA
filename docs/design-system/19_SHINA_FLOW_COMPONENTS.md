# 19 — Shinã Flow Components

> Shinã Flow Design System™ · Wave 2 · LUMEN
> Especificação oficial dos componentes nomeados do sistema. **Contrato para a
> Wave 3** — nenhum é implementado agora. Cada um consome tokens (doc 09),
> motion (doc 11), IA (doc 12) e acessibilidade (doc 18). Alvo de pacote:
> `@shina/flow` (React) + `@shina/flow-tokens`.

---

## Como ler

Cada componente: **Papel · Props principais · Composição · Motion ·
Acessibilidade · Notas.** Props são o contrato de API alvo; a Wave 3 pode
refinar nomes, não a semântica.

Convenções: todos aceitam `product?: "platform" | "mkt"` (default: contexto);
`className`; e respeitam `prefers-reduced-motion` automaticamente.

---

## Camada 1 — Atmosfera (fundos e ilustração)

### `<FlowBackground/>`

- **Papel**: fundo ambiente base para telas de produto (doc 16 Dashboard/Flow).
- **Props**: `variant?: "dashboard" | "flow" | "aurora"`, `intensity?: 0–1`,
  `glow?: boolean`.
- **Composição**: base escura + no máximo um efeito; monta os demais
  backgrounds abaixo conforme `variant`.
- **Motion**: loops ambientes, lazy + pausável (doc 18).
- **A11y**: `aria-hidden`; estático em reduced-motion.
- **Notas**: nunca sob tabelas densas; um por viewport.

### `<AuroraMesh/>`

- **Papel**: Aurora + Mesh combinados para heros/splash (doc 16).
- **Props**: `colors?: ["from","to"]` (default: gradiente do produto),
  `speed?`, `blur?`.
- **Motion**: glows transladam (ambient 10–14 s) + vértices derivam ±2%.
- **Notas**: marketing/login apenas.

### `<FlowLines/>`

- **Papel**: linhas de fluxo animadas (SVG) para hero e automação.
- **Props**: `count?` (≤ 5), `opacity?` (≤ 0.08), `speed?`.
- **Motion**: dash-offset (Flow Lines, doc 11).

### `<NeuralParticles/>`

- **Papel**: campo de nós/partículas para IA e escala (doc 15 Neural/Particle).
- **Props**: `nodes?` (≤ 20), `connections?: boolean`, `mode?: "idle" |
"thinking"`.
- **Motion**: Orbit/Particles em idle; Neural Connections em thinking.
- **Notas**: em produto, só dentro de superfícies de IA — nunca fundo geral.

---

## Camada 2 — Superfícies e ações

### `<GlassCard/>`

- **Papel**: superfície padrão de conteúdo (doc 08 §4).
- **Props**: `elevation?: 1 | 2`, `interactive?: boolean`, `ring?:
"none" | "warning" | "success" | "accent"`, `as?`.
- **Composição**: `surface.glass` + `border.default` + `radius-lg`.
- **Motion**: Glass Transition ao entrar; Hover Lift se `interactive`.
- **A11y**: se clicável, vira `<button>`/`<a>` com foco visível.

### `<GlowButton/>`

- **Papel**: CTA de destaque com sombra-glow da marca.
- **Props**: `variant?: "primary" | "gradient"`, `loading?`, `icon?`,
  `size?`.
- **Composição**: Button (doc 10) + `shadow-glow-*`.
- **Motion**: Hover Lift + glow intensifica (fast); `loading` = NeuralLoader
  inline; Magnetic opcional só em hero.
- **A11y**: `<button>`, `aria-busy` em loading.
- **Notas**: 1 por dobra; glow só aqui e em FAB.

---

## Camada 3 — Métricas e dados

### `<MetricCard/>`

- **Papel**: um KPI legível de relance (doc 10 Metric Card).
- **Props**: `label`, `value`, `delta?`, `icon`, `href?`, `state?:
"idle" | "loading" | "attention"`.
- **Composição**: tile de ícone + label + `<MetricCounter/>` + delta semântico.
- **Motion**: Metric Loader → Metric Counter; ring âmbar se `attention`.

### `<MetricCounter/>`

- **Papel**: número que interpola até o valor (tabular-nums).
- **Props**: `value`, `format?`, `duration?` (default slow), `from?`.
- **Motion**: interpola do valor anterior (não de zero em revisita); direto em
  reduced-motion.

### `<AnalyticsPanel/>`

- **Papel**: composição de widgets analíticos + filtros (doc 10).
- **Props**: `widgets`, `range`, `loading?`.
- **Motion**: Dashboard Reveal; Chart Grow/Stream nos gráficos.
- **A11y**: cada gráfico tem alternativa em tabela.

---

## Camada 4 — Inteligência

### `<InsightCard/>`

- **Papel**: insight de IA com fonte e ação (doc 10 AI Card).
- **Props**: `title`, `content | stream`, `source`, `action?`, `state`
  (máquina do doc 12).
- **Motion**: AIStreaming no conteúdo; Success ao concluir.

### `<AIThinking/>`

- **Papel**: representação do estado Thinking/Planning (doc 12).
- **Props**: `label?`, `substate?: "thinking" | "searching" | "connecting"
| "planning"`, `onCancel?`.
- **Composição**: NeuralParticles(mode="thinking") + Glow Pulse + texto honesto.
- **A11y**: `aria-live="polite"` anuncia o estado; botão Cancelar.

### `<AIStreaming/>`

- **Papel**: saída de texto por palavra com caret de gradiente (doc 12).
- **Props**: `tokens | text`, `onDone?`, `autoscroll?`.
- **Motion**: Streaming; ações da resposta esmaecidas até `onDone`.
- **A11y**: região `aria-live`; reduced-motion = blocos sem caret.

### `<ThinkingIndicator/>`

- **Papel**: versão compacta inline de AIThinking (dentro de botões/linhas).
- **Props**: `substate?`, `size?`.

### `<NeuralLoader/>`

- **Papel**: loader oficial de IA (doc 14).
- **Props**: `nodes?`, `label?`.
- **Notas**: substitui qualquer spinner em contexto de IA.

---

## Camada 5 — Navegação e contexto

### `<FloatingSidebar/>`

- **Papel**: navegação primária destacada (glass flutuante, doc 10).
- **Props**: `items`, `active`, `header`, `footer`, `collapsed?`.
- **Motion**: item ativo transita fundo (fast); mobile abre como Drawer.
- **A11y**: `<nav>`, estado atual com `aria-current`.

### `<FloatingNavbar/>`

- **Papel**: barra superior/pílula flutuante (doc 10 Navbar).
- **Props**: `left` (título/breadcrumb), `right` (ações/perfil), `floating?`.

### `<WorkspaceSwitcher/>` · `<TenantSwitcher/>`

- **Papel**: trocar workspace / tenant (doc 10).
- **Props**: `current`, `items`, `onSwitch`, `searchable?` (default true).
- **Motion**: Workspace/Tenant Switch — acento do produto transita em slow;
  crossfade do conteúdo; confirma via Toast.
- **A11y**: anuncia o contexto atual e a troca.

---

## Camada 6 — Comando e criação

### `<CommandPalette/>`

- **Papel**: busca/ação global `⌘K` (doc 10/11 Spotlight).
- **Props**: `groups`, `onSelect`, `placeholder?`, `hotkey?` (default ⌘K).
- **Composição**: Spotlight + Command Input + resultados agrupados (stagger).
- **Motion**: Spotlight; resultados por crossfade.
- **A11y**: `role=dialog`; navegação total por teclado; foco preso.

### `<PromptCanvas/>`

- **Papel**: editor de prompts com variáveis e preview (doc 10 Prompt Card +
  edição).
- **Props**: `template`, `variables`, `onRun`, `onSave`.
- **Composição**: editor com `{{var}}` em Code + painel de variáveis + botão
  Run que dispara a máquina de IA.

### `<CreativeStudio/>`

- **Papel**: canvas de criação de criativos (doc 10).
- **Props**: `document`, `brandKit`, `tools`, `onExport`.
- **Composição**: canvas central + painéis (marca/camadas/propriedades);
  zoom/pan; seleção com handles.
- **Motion**: seleção/handles com fast; export via Publishing/Background Loader.

### `<AutomationCanvas/>`

- **Papel**: editor node-based de fluxos (doc 10 Automation Builder).
- **Props**: `nodes`, `edges`, `onChange`, `onRun`.
- **Composição**: nós glass + Flow Lines animadas; arrastar cria conexão com
  preview; execução ilumina o caminho (Neural Connections).
- **A11y**: alternativa em lista de passos; operável por teclado.

### `<CampaignBuilder/>`

- **Papel**: wizard de campanha que termina em rascunho (draft-first).
- **Props**: `steps`, `brandKit`, `onSubmitDraft`.
- **Composição**: stepper com indicador deslizante (Tabs) → revisão → cria
  **draft** (nunca publica direto; ver Marketing IA safety layer).

### `<MarketplaceCard/>`

- **Papel**: item vendável (template/prompt/agente) (doc 10).
- **Props**: `title`, `author`, `price`, `rating`, `preview`, `onOpen`.
- **Motion**: Hover Lift; 1 CTA.

---

## Regras de fechamento (todos os componentes)

1. Mesma linguagem visual (docs 04–08) e motion (doc 11) — indistinguíveis
   como família.
2. Todo componente define **empty, loading e error** (docs 12/14); nenhum
   estado esquecido.
3. IA sempre via a máquina de estados do doc 12 — nunca spinner/"Loading…".
4. Acento = produto ativo; semântica só com significado.
5. Acessibilidade e performance do doc 18 são pré-condição de merge, não
   melhoria futura.
6. Nada evoca ERP/admin/template (doc 08 §12).

Este documento + docs 10–18 são suficientes para a Wave 3 reconstruir qualquer
tela da Shinã (landing plataforma, landing MKT, Studio, Admin, Tenant,
Marketplace) sem depender de exemplos visuais.
