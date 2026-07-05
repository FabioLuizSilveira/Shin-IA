# 18 — Accessibility & Motion Performance

> Shinã Flow Design System™ · Wave 2 · LUMEN
> Beleza nunca custa acesso nem performance. Todo movimento do doc 11 tem uma
> forma acessível e um orçamento de performance. Isto é norma, não sugestão.

---

## 1. Reduced Motion

`@media (prefers-reduced-motion: reduce)` é obrigatório em todo componente
animado. Regras de degradação:

| Animação normal                               | Versão reduzida                                              |
| --------------------------------------------- | ------------------------------------------------------------ |
| Slide / translate                             | Fade instantâneo ou 100 ms, sem deslocamento                 |
| Scale (entrada)                               | Sem escala; só opacidade                                     |
| Streaming (IA)                                | Texto aparece em blocos, sem por-palavra; sem caret pulsante |
| Neural / Aurora / Particles / loops ambientes | **Estáticos** (frame único representativo)                   |
| Shimmer / Flow Loader                         | Fade estático suave (pulso lento de opacidade)               |
| Parallax / Magnetic / Float                   | Desligados                                                   |
| Metric Counter / Chart Grow                   | Valor/gráfico final direto, sem interpolação                 |

Nenhuma informação existe **apenas** no movimento: estado, progresso e
resultado sempre têm forma estática equivalente (texto, ícone, cor).

## 2. WCAG (alvo AA, mirando AAA em texto)

- **Contraste**: corpo ≥ 4.5:1; display/ícones ≥ 3:1 (doc 04 §10).
- **Cor não-única**: todo significado por cor tem rótulo ou ícone junto
  (semânticas, gráficos, status).
- **Flash**: nada pisca acima de 3×/s (evita gatilho fotossensível) — regra que
  já bane spinners piscantes e glows estroboscópicos.
- **Alvos de toque**: ≥ 44×44 px em mobile; ≥ 40 px de altura em desktop.
- **Zoom**: layout íntegro até 200% de zoom sem perda de conteúdo.
- **Texto**: redimensionável; nada crítico em imagem de texto.

## 3. ARIA e semântica

- Elementos nativos primeiro (`<button>`, `<a>`, `<label>`); ARIA só quando
  não há equivalente nativo.
- Estados dinâmicos anunciados: `aria-busy` (loading), `aria-live="polite"`
  para Streaming/Toast, `aria-live="assertive"` só para erros críticos.
- Diálogos: `role=dialog` + `aria-modal` + foco preso + retorno ao gatilho.
- IA: o estado atual (Thinking/Generating/Error) é exposto a leitores de tela
  em texto, não só em animação (doc 12).
- Ícones funcionais têm `aria-label`; decorativos, `aria-hidden`.

## 4. Teclado

- **Tudo** operável por teclado; ordem de tab lógica e previsível.
- Command Palette (`⌘K`) e navegação por setas em listas/menus.
- Focus Ring sempre visível (doc 11); nunca `outline: none` sem substituto.
- `Esc` fecha overlays; `Enter`/`Space` ativam; atalhos documentados e
  desligáveis.
- Skip-link "pular para o conteúdo" em páginas com navegação longa.

## 5. Motion Fallback e camadas

- Animação é progressiva: sem JS/reduced-motion, a UI é totalmente funcional e
  agradável, apenas mais quieta.
- Estados essenciais (loading, erro, sucesso) nunca dependem de bibliotecas de
  animação para existir.

## 6. Performance de motion

### Orçamento

- **60 fps** é o piso para qualquer animação de interface; nada abaixo de
  50 fps sustentado passa no gate.
- Animações compostas só em `transform` e `opacity` (GPU); `filter: blur`
  animado apenas pontual e curto (doc 11 §4).
- **Sem layout thrash**: nunca animar `width/height/top/left`.

### GPU e camadas

- Promover a camada (`will-change`/`transform: translateZ(0)`) apenas durante
  a animação; remover ao terminar (evita explosão de memória de camadas).
- Loops ambientes (Aurora/Mesh/Particles): baixa taxa de mudança, elementos
  poucos e grandes desfocados — custo quase nulo.

### Lazy / on-demand

- Efeitos de fundo e ilustrações animadas só iniciam quando **visíveis**
  (IntersectionObserver) e pausam fora do viewport ou com aba em background.
- Partículas/mesh só em telas de marketing; nunca carregadas no bundle de
  produto/dashboard.
- Respeitar `Save-Data` e conexões lentas: degradar para estático.

### Performance budget (Wave 3 herda)

- Efeito de fundo não pode custar > ~1 ms/frame no dispositivo-alvo médio.
- Bundle de motion (biblioteca + efeitos) isolado e code-split por rota.
- Medir em dispositivo modesto, não só no desktop do designer.

## 7. Checklist de acessibilidade + motion (gate)

- [ ] `prefers-reduced-motion` implementado e testado?
- [ ] Nenhuma informação vive só no movimento?
- [ ] Contrastes AA verificados nos fundos `#0F172A` e claro?
- [ ] Cor nunca é o único canal?
- [ ] Nada pisca > 3×/s?
- [ ] 100% operável por teclado, com foco visível?
- [ ] Estados de IA/loading anunciados a leitores de tela?
- [ ] 60 fps no dispositivo médio; só transform/opacity?
- [ ] Efeitos de fundo lazy, pausáveis e fora do bundle de produto?
- [ ] Alvos de toque ≥ 44 px?

Um **NÃO** reprova o componente, independentemente da beleza visual.
