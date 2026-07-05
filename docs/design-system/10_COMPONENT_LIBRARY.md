# 10 — Component Library

> Shinã Flow Design System™ · Wave 2 · LUMEN
> Especificação. Nenhum componente é implementado nesta Wave; a Wave 3
> constrói a partir daqui. Todos compartilham a mesma linguagem (docs 04–09)
> e o mesmo motion (doc 11).

---

## Como ler este documento

Cada componente segue o mesmo cabeçalho de 9 campos:
**Objetivo · Anatomia · Estados · Uso correto · Uso incorreto ·
Responsividade · Motion · Accessibility · Exemplo.**

Tokens citados (`surface.glass`, `space-4`, `motion.base`…) vêm dos docs
04–06, 09 e 11. Onde um componente já existe em produção (ex.: `card-glass`,
`MktShell`), a especificação descreve o alvo canônico — a Wave 3 alinha o
código existente a ela.

Convenções globais que valem para **todos**:

- Superfície padrão: `surface.glass` + `border.default`, `radius-lg`.
- Foco de teclado: `Focus Ring` (doc 11) em `border.focus`, sempre visível.
- Cor de acento herda o produto ativo (`platform` azul / `mkt` índigo).
- Alturas de toque ≥ 40 px; alvo mínimo 44×44 px em mobile.
- Texto segue a escala do doc 05; nunca hex/px cru (doc 09 §6).

---

## Grupo A — Ações

### Button

- **Objetivo**: disparar a ação primária ou secundária de um contexto.
- **Anatomia**: container (`radius-md`, padding `space-3`/`space-6`) · label
  (Button 14/600) · ícone opcional `icon-sm` à esquerda.
- **Variantes**: `primary` (fundo primária, texto branco), `secondary`
  (borda `border.default`, fundo transparente), `ghost` (sem borda),
  `danger` (borda/texto danger), `gradient` (gradiente de marca — só CTA hero).
- **Estados**: default · hover (primária-500 ou `surface.glassHover`) ·
  pressed (primária-700, scale .99) · focus (ring) · loading (label some,
  `NeuralLoader` inline) · disabled (60% opacity, sem cursor).
- **Uso correto**: 1 primário por dobra; verbo no label ("Gerar anúncio").
- **Uso incorreto**: dois primários lado a lado; label genérico ("OK");
  gradiente fora de hero.
- **Responsividade**: full-width abaixo de `sm` quando é ação de formulário.
- **Motion**: hover `fast`; pressed `instant` scale; loading via Morph.
- **Accessibility**: `<button>`; estado loading com `aria-busy`; foco visível.
- **Exemplo**: "Gerar anúncio" (primary) + "Cancelar" (ghost).

### Icon Button

- **Objetivo**: ação sem texto quando o ícone é inequívoco.
- **Anatomia**: quadrado 36–40 px, ícone `icon-md` `currentColor`, `radius-md`.
- **Estados**: como Button; hover pinta ícone (white/primária-400).
- **Uso incorreto**: ações ambíguas sem tooltip; agrupar > 4 seguidos.
- **Accessibility**: `aria-label` obrigatório; Tooltip complementar.

### Ghost Button

- **Objetivo**: ação terciária que não compete com nada.
- **Anatomia**: só label + hover sutil (`surface.glassHover`).
- **Uso correto**: "Cancelar", "Ver tudo", navegação leve.

### Floating Button (FAB / Dock action)

- **Objetivo**: ação global persistente (ex.: abrir AI Console).
- **Anatomia**: pill ou círculo com gradiente de marca + glow-sombra
  (`shadow-glow-*`), fixo (`z-raised`), canto inferior direito.
- **Motion**: entra com Dock; Hover Lift; nunca pisca.
- **Uso incorreto**: mais de 1 por tela; cobrir conteúdo em mobile.

---

## Grupo B — Entrada

### Input

- **Objetivo**: capturar texto curto.
- **Anatomia**: Label (12/500) acima · campo (`radius-md`, `surface.glass`,
  `border.default`, padding `space-3`) · hint/erro (Small) abaixo · ícone
  opcional.
- **Estados**: default · hover (`border.strong`) · focus (ring primária) ·
  filled · error (borda/texto danger + mensagem que diz como corrigir) ·
  disabled.
- **Uso incorreto**: placeholder como label; erro genérico.
- **Motion**: foco `fast`; erro transita cor em `fast`, sem shake (doc 11).
- **Accessibility**: `<label for>`; `aria-invalid`+`aria-describedby` no erro.

### Textarea

- Igual ao Input; auto-grow até um teto, depois rola; contador opcional em
  Caption.

### Command Input

- **Objetivo**: entrada de linguagem natural para a IA/Command Palette.
- **Anatomia**: campo largo com ícone `Sparkles`/`Search` à esquerda, atalho
  (`⌘K`) à direita em `kbd` style, sem borda pesada.
- **Motion**: caret de gradiente; ao enviar, transita para estado Thinking
  (doc 12).

### Search

- **Objetivo**: filtrar/localizar.
- **Anatomia**: Input com ícone `Search`, limpar (`X`) quando preenchido,
  resultados em Popover ou lista abaixo.
- **Motion**: resultados por crossfade `fast`; nunca piscar a lista.

### Dropdown / Select

- **Objetivo**: escolher entre opções conhecidas.
- **Anatomia**: trigger (como Input) + Popover de opções · item com check
  quando selecionado.
- **Motion**: abre com Scale a partir do trigger (`fast`).
- **Accessibility**: `role=listbox`/`option`; navegação por setas; typeahead.
- **Uso incorreto**: > 8 opções sem busca (usar Command Input).

---

## Grupo C — Sobreposição

### Popover

- Contêiner glass flutuante (`z-dropdown`, `shadow-md`) ancorado a um gatilho;
  Scale a partir da origem; fecha por clique fora/Esc.

### Tooltip

- Micro-rótulo (Small) em `surface.raised`, delay 300 ms, fade+translate 4 px;
  nunca contém ação; some sem animação perceptível.

### Toast

- **Objetivo**: feedback efêmero não bloqueante.
- **Anatomia**: ícone semântico + mensagem (o que houve + próximo passo) +
  ação opcional (Undo) + fechar. Empilha no canto superior direito
  (`z-toast`).
- **Motion**: entra da borda (slide 12 px + spring), auto-dismiss 5 s
  (pausa no hover), sai fade ×0.7.
- **Uso incorreto**: erro crítico em toast (usar Dialog); toast permanente.

### Dialog (Modal)

- **Objetivo**: decisão que exige atenção total.
- **Anatomia**: scrim (`surface.overlay`) + painel glass centralizado
  (`radius-xl`, `max-w-lg`) · título H4 · corpo · rodapé com ações (primária à
  direita).
- **Motion**: scrim fade `base` + painel Scale; Esc/scrim fecham (exceto
  destrutivo).
- **Accessibility**: foco preso, retorna ao gatilho ao fechar; `role=dialog`
  `aria-modal`.

### Drawer

- Painel lateral (direita padrão) para detalhe/edição sem perder contexto;
  translateX da borda em `slow` com spring pesado; largura 420–560 px, full em
  mobile.

---

## Grupo D — Navegação e estrutura

### Sidebar / Floating Sidebar

- **Objetivo**: navegação primária do produto.
- **Anatomia**: header com logo (doc 02) · grupos de itens (ícone `icon-md` +
  label) · rodapé (usuário/sair). Item ativo: fundo `primária/15`, texto
  primária-400. **Floating** = destacada do fundo com glass + `radius-xl` e
  margem, "flutuando" sobre o ambiente.
- **Responsividade**: colapsa em drawer overlay < `md`.
- **Motion**: item ativo transita fundo em `fast`; abertura mobile = Drawer.

### Navbar / Floating Navbar

- Barra superior fixa (`z-header`), fundo `slate-950/80` + blur. **Floating**:
  pílula central destacada em landing. Contém título/breadcrumb à esquerda,
  ações/perfil à direita.

### Tabs

- Trilha de abas com indicador que **desliza** (shared layout) entre elas
  (`base`); conteúdo troca por crossfade `fast`. Sublinhado primária, não caixa.

### Breadcrumb

- Caminho em Small/gray-400, separador `chevron` `icon-xs`; último item em
  branco, não clicável.

### Workspace Switcher / Tenant Switcher

- **Objetivo**: trocar de contexto (workspace) ou de tenant (admin).
- **Anatomia**: trigger com avatar/inicial + nome + chevron; Popover com busca
  (Command Input), lista com check no atual, ação "criar/gerenciar".
- **Motion**: Workspace/Tenant Switch (doc 11) — a cor de acento do produto
  transita em `slow`; conteúdo faz crossfade.
- **Accessibility**: anuncia o contexto atual; troca confirma via toast.

### Floating Dock / Quick Actions

- Barra flutuante de atalhos (criar, buscar, IA), inferior-central, glass +
  `radius-full`; ícones com Hover Lift e Magnetic sutil; abre com Dock.

---

## Grupo E — Dados

### Table

- **Objetivo**: listas tabulares legíveis.
- **Anatomia**: header (Overline/Label, gray-400) · linhas separadas por
  `border.subtle` (sem zebra) · densidade confortável (linha ≥ 44 px) ·
  ações no hover da linha (`⋯`). `tabular-nums` em números.
- **Estados**: hover linha (`surface.glassHover`) · selecionada (ring/checkbox)
  · vazia (empty state que ensina) · carregando (Skeleton de linhas).
- **Uso incorreto**: zebra stripes; bordas 3D; mais de 7 colunas sem priorizar.
- **Responsividade**: < `md` colapsa para cards de 1 coluna (label:valor).

### Data Grid

- Table + recursos avançados: colunas fixas, ordenação (indicador animado),
  seleção em massa, paginação/scroll virtual (mantém 60 fps com 10k linhas).
- **Motion**: Chart Stream para linhas que chegam ao vivo.

### Charts / Analytics Widgets

- Sequência categórica do doc 04 §7; grid lines em `border.subtle`; sem fundo.
- **Motion**: Chart Grow na entrada; Metric Counter nos rótulos-chave; Chart
  Stream em dados vivos.
- **Accessibility**: alternativa em tabela; nunca só cor (padrão/rótulo).

### Metric Card

- **Objetivo**: um KPI, uma leitura instantânea.
- **Anatomia**: tile de ícone (doc 07 §6) · rótulo Small/gray-400 · valor
  H2/`font-black`/tabular-nums · delta opcional (▲/▼ semântico) · clicável
  para detalhe.
- **Motion**: Metric Counter no valor; Hover Lift; ring âmbar se exige ação.

### Progress

- Linear (barra `radius-full`, trilho `border.subtle`, preenchimento
  primária/gradiente) e circular. Indeterminado usa **Flow Loader**, nunca
  spinner. IA usa fluxo contínuo, não percentual falso (doc 12/14).

### Timeline

- Trilho vertical com nós (dot 8 px semântico) e conteúdo à direita; entradas
  revelam com Slide stagger; usado em audit trail e atividade.

### Kanban

- Colunas (glass) com cards arrastáveis; drag levanta (scale 1.02 + sombra),
  drop faz Dock; coluna destino ilumina borda. Usado em campanhas/pipeline.

### Calendar

- Grade mensal glass; dia com eventos mostra dots semânticos; hoje com ring
  primária; navegação de mês por crossfade. Usado em calendário editorial.

### Avatar

- Círculo com imagem ou iniciais sobre tile gradiente determinístico por id;
  tamanhos xs/sm/md/lg; status dot opcional.

### Badge

- Pill (`radius-full`, Small/500). Semântica = fundo translúcido + texto tom
  400 (doc 04 §3). Neutro = `surface.glass`. Nunca sólido saturado.

---

## Grupo F — Cards de produto

Todos herdam o card glass base; variam pelo conteúdo e pelo acento do produto.

### AI Card / Insight Card

- Insight gerado por IA: tile `Sparkles` · título · corpo (pode ser Streaming)
  · fonte dos dados · ação sugerida. Estado "gerando" usa AIStreaming (doc 12).

### Marketplace Card

- Item vendável: preview (imagem/gradiente) · nome · autor · preço/badge ·
  rating · CTA. Hover Lift; 1 CTA.

### Campaign Card

- Campanha: nome · plataforma (ícone) · status (Badge) · métrica-chave ·
  ação de estratégia. Ring âmbar quando pendente de aprovação.

### Prompt Card

- Prompt reutilizável: título · categoria · variáveis (`{{var}}` em Code) ·
  contador de uso · favoritar (doc 13). Compacto, denso.

---

## Grupo G — Superfícies de IA e criação (visão geral; detalhe nos docs 12/16)

### AI Console / AI Chat

- Painel conversacional (drawer ou página): histórico, Command Input,
  mensagens com Streaming, estados vivos (doc 12), ações sobre a resposta
  (copiar, refazer, aprovar). Nunca "Loading…".

### Command Palette / Spotlight Search

- Busca global `⌘K`: Spotlight (doc 11), Command Input, resultados agrupados
  com stagger, navegação total por teclado, ações e navegação num só lugar.

### Creative Studio

- Área de criação de criativos: canvas central + painéis laterais (marca,
  camadas, propriedades); zoom/pan; seleção com handles; tudo glass sobre
  ambiente escuro.

### Automation Builder / Automation Canvas

- Editor node-based de fluxos: nós (glass) conectados por Flow Lines animadas;
  arrastar cria conexão com preview; execução ilumina o caminho
  (Neural Connections).

### Campaign Builder

- Wizard multi-step (Tabs/stepper com indicador deslizante) que termina em
  rascunho para aprovação (invariante draft-first).

### Analytics Panel

- Composição de Analytics Widgets + filtros; layout responsivo 4→2→1;
  Dashboard Reveal na entrada.

---

## Consistência entre componentes (regras de fechamento)

1. Mesma família de raio, sombra, borda e motion em todos.
2. Um único padrão de foco, hover e disabled em todo o sistema.
3. Acento sempre do produto ativo; semântica só com significado.
4. Todo componente tem empty, loading e error especificados — nenhum estado
   "esquecido".
5. Nada evoca ERP/admin/template (doc 08 §12) — se evocar, não entra.
