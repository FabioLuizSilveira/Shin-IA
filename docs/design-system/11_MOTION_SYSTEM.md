# 11 — Motion System

> Shinã Flow Design System™ · Wave 2 · LUMEN
> O coração da Shinã. Movimento não é decoração: é a personalidade
> "Operações Inteligentes em Movimento" tornada física.

---

## 1. Motion Principles

1. **Causalidade** — todo movimento nasce de algo: um clique, um dado que
   chegou, um estado que mudou. Nada se move "porque sim".
2. **Continuidade** — elementos não teleportam; transformam-se. O olho nunca
   perde o fio.
3. **Física de água, não de mola de desenho** — a Shinã se move como corrente:
   acelera suave, desacelera longa, sem quicar.
4. **Calma sob carga** — quanto mais crítico o momento, mais contido o
   movimento. Erros não tremem; aprovações não explodem confete.
5. **Custo zero de espera** — animação nunca adiciona latência percebida.
   Se o dado está pronto, a animação corre em paralelo, nunca na frente.

## 2. Física

| Parâmetro          | Valor Shinã                                         | Significado                          |
| ------------------ | --------------------------------------------------- | ------------------------------------ |
| Massa              | Leve (1) para UI; média (1.4) para painéis          | Painéis "pesam" mais que botões      |
| Rigidez (spring)   | 260                                                 | Resposta firme sem oscilação visível |
| Amortecimento      | 28–34                                               | Sobrepasso imperceptível (≤ 2%)      |
| Velocidade inicial | 0, exceto gestos (herda a velocidade do dedo/mouse) |                                      |
| Overshoot          | Proibido acima de 2% de escala; nunca em opacidade  |                                      |

Traduzido para springs (Framer Motion): `{ stiffness: 260, damping: 30,
mass: 1 }` como padrão; `{ stiffness: 210, damping: 34, mass: 1.4 }` para
drawers e modais.

## 3. Duração e easing

| Token            | Duração | Uso                                  |
| ---------------- | ------- | ------------------------------------ |
| `motion.instant` | 100 ms  | Feedback de clique, toggle           |
| `motion.fast`    | 150 ms  | Hover, cor, foco                     |
| `motion.base`    | 250 ms  | Padrão: expandir, revelar, trocar    |
| `motion.slow`    | 400 ms  | Estrutural: modal, drawer, página    |
| `motion.ambient` | 3–8 s   | Atmosfera: aurora, glow pulse (loop) |

| Easing              | Curva                            | Uso                                      |
| ------------------- | -------------------------------- | ---------------------------------------- |
| `ease.out` (padrão) | `cubic-bezier(0.16, 1, 0.3, 1)`  | Entradas — chega rápido, assenta devagar |
| `ease.inOut`        | `cubic-bezier(0.65, 0, 0.35, 1)` | Morphs e trocas de posição               |
| `ease.in`           | `cubic-bezier(0.7, 0, 0.84, 0)`  | Saídas — só para elementos que somem     |
| `ease.linear`       | linear                           | Apenas loops ambientes e streaming       |

Regras: aceleração pertence às saídas, desaceleração às entradas. Elementos
que saem são sempre mais rápidos (×0.7) que os que entram.

## 4. Propriedades animáveis

**Permitidas** (compostas na GPU): `transform` (translate/scale/rotate),
`opacity`, `filter: blur` (com parcimônia).

**Controladas**: `background-color`/`border-color` apenas em `motion.fast`.

**Proibidas**: `width/height/top/left` em animação contínua (usar transform),
`box-shadow` animada frame a frame (usar opacidade de pseudo-elemento).

| Propriedade    | Faixa permitida                                                |
| -------------- | -------------------------------------------------------------- |
| Opacity        | 0 → 1; nunca flutuar entre valores intermediários em loop      |
| Scale          | Entradas 0.98 → 1; hover 1 → 1.01; nunca > 1.04                |
| Translate      | Entradas ≤ 12 px; parallax ≤ 24 px                             |
| Rotation       | Apenas ícones funcionais (chevron 180°, loader) — nunca layout |
| Blur           | 0 → 8 px em transições glass; nunca animar blur em loop        |
| Depth/parallax | 2 camadas máx.; razão 0.85/1.0; só em marketing                |

## 5. Shared layout e transições

- **Shared element**: ao expandir card → detalhe, o card é o mesmo elemento
  (layoutId compartilhado); título e tile viajam, o resto faz fade.
- **Regra de origem**: tudo entra a partir do seu gatilho (menu nasce do
  botão; drawer nasce da borda; tooltip nasce do alvo).
- **Coreografia**: stagger de listas = 20 ms/item, teto de 8 itens animados
  (o resto aparece junto). Página inteira nunca "cai em cascata".
- **Interrupção**: toda animação é interrompível; nova intenção do usuário
  cancela a anterior sem esperar.

## 6. Catálogo oficial de animações

Formato: **nome — receita (props · duração · easing) — onde usar**.

### Fundamentos

- **Fade** — opacity 0→1 · base · ease.out — conteúdo secundário.
- **Slide** — translateY 8px→0 + fade · base · ease.out — cards, seções.
- **Scale** — scale .98→1 + fade · base · ease.out — modais, popovers.
- **Reveal** — clip-path inset 0 100% 0 0→0 · slow · ease.inOut — títulos hero.
- **Grow/Expand** — height auto via spring + fade do conteúdo · base — acordeões, painéis de estratégia.
- **Collapse** — inverso do expand a ×0.7 da duração.
- **Morph** — shared layout entre estados do mesmo objeto · base · ease.inOut — card→detalhe, botão→barra de progresso.

### Assinaturas Shinã

- **Streaming** — texto surge por palavra (fade 80 ms/palavra, sem slide) com caret de gradiente pulsando — respostas de IA.
- **Dock** — item ancora com scale 1.02→1 + sombra sobe um nível · fast — arrastar-e-soltar concluído.
- **Spotlight** — overlay escurece (fade slow) enquanto palette desce 12 px com scale .98→1 · base — Command Palette.
- **Magnetic** — CTA hero desloca até 4 px em direção ao cursor (spring leve) — apenas marketing, 1 elemento por página.
- **Orbit** — pontos de luz orbitam lentamente um centro (ambient 8 s, linear) — ilustrações e loaders neurais.
- **Hover Lift** — translateY −2px + borda strong · fast — cards clicáveis.
- **Glass Transition** — blur 0→8 px + fundo 0→4% · base — superfícies glass entrando.
- **Card Float** — translateY ±3 px em loop ambient 6 s — apenas ilustração de marketing, nunca dados.
- **Section Reveal** — slide + fade por seção ao entrar no viewport (uma vez, threshold 30%) — landing.
- **Animated Gradient** — background-position em loop ambient 8 s — apenas texto display hero.
- **Aurora** — 2–3 glows radiais transladando lentamente (ambient 10–14 s, linear, opacidade fixa) — fundos (doc 16).
- **Flow Lines** — traços SVG com dash-offset animado (ambient 6 s) — ilustrações de fluxo.
- **Neural Connections** — nós fixos, arestas com pulso de opacidade sequencial — estado Thinking da IA.
- **Particles** — ≤ 20 partículas, deriva lenta, sem interação — hero de marketing somente.
- **Glow Pulse** — opacidade do glow 8%→12%→8% · ambient 4 s — indica IA viva (doc 12).
- **Focus Ring** — ring 0→40% em fast — foco de teclado.

### Componentes e dados

- **Command Palette** — Spotlight + stagger 20 ms dos resultados.
- **Metric Counter** — número interpola do valor anterior ao novo em slow com tabular-nums; nunca de zero em revisita.
- **Chart Grow** — barras crescem da base (base · ease.out, stagger 20 ms); linhas desenham via dash-offset em slow.
- **Chart Stream** — dados novos entram pela direita com translate, eixo desliza — dashboards vivos.
- **Background Mesh** — vértices do gradient mesh derivam ±2% em ambient 12 s — hero apenas.
- **Dashboard Reveal** — KPIs: fade+slide stagger 20 ms (teto 8); gráficos iniciam Chart Grow após 100 ms.
- **Page Transition** — saída fade ×0.7 → entrada slide 8 px; conteúdo persistente (shell) não pisca.
- **Workspace/Tenant Switch** — conteúdo faz crossfade base enquanto o switcher assenta com Dock; identidade (cor do produto) transita em slow.
- **Notification/Toast** — entra da borda superior direita com slide 12 px + spring; sai com fade ×0.7; empilha com stagger.
- **Modal** — scrim fade base + painel Scale; saída inversa ×0.7.
- **Drawer** — translateX da borda em slow com spring pesado; scrim fade.
- **Tooltip** — fade + translate 4 px · fast; delay de 300 ms; sem animação de saída perceptível.
- **Search** — resultados substituem com crossfade fast; nunca "piscar" lista inteira.

### Estados de processo (IA — detalhados no doc 12)

- **Loading** — ver doc 14 (nunca spinner tradicional).
- **Thinking** — Neural Connections + Glow Pulse.
- **Generating** — Streaming + barra de fluxo contínua (não percentual).
- **Reviewing** — varredura de highlight percorrendo o conteúdo (slow, 1 passada).
- **Publishing** — Morph do botão → pill de progresso → check.
- **Success** — check desenhado por stroke (base) + glow verde 1 pulso.
- **Error** — borda e texto transitam para danger em fast; sem shake.

## 7. Regras de transição (resumo normativo)

1. Entradas: ease.out. Saídas: ease.in a ×0.7. Morphs: ease.inOut.
2. Nada acima de 400 ms fora de loops ambientes.
3. Stagger 20 ms, teto 8 elementos.
4. Um elemento Magnetic/Float por viewport, só em marketing.
5. Loops ambientes nunca em áreas de leitura de dados.
6. Tudo interrompível; tudo respeita `prefers-reduced-motion` (doc 18).
