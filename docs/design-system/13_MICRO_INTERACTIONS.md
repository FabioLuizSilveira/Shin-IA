# 13 — Micro-interactions

> Shinã Flow Design System™ · Wave 2 · LUMEN
> O toque humano do sistema. Cada micro-interação confirma que a interface
> ouviu — em menos tempo do que a dúvida leva para se formar.

---

## Princípios

1. **Resposta imediata** — feedback visível em ≤ 100 ms do gesto.
2. **Proporcional** — a intensidade combina com a importância (favoritar é
   leve; excluir é sério).
3. **Reversível quando possível** — ações destrutivas oferecem Undo.
4. **Silenciosa por padrão** — nada comemora demais; a exceção é a entrega de
   IA, que ganha 1 pulso.

Formato de cada entrada: **gatilho → resposta (motion · duração) → feedback.**

---

## Navegação e ponteiro

- **Hover** → cor/borda sobem um nível + (em cards) Hover Lift −2 px ·
  `fast`. Feedback: "é clicável".
- **Focus (teclado)** → Focus Ring `border.focus` · `fast`. Sempre visível;
  nunca suprimir outline sem substituto.
- **Click / tap** → scale .99 no pressed · `instant`; solta em `fast`.
  Feedback: "recebido".

## Manipulação direta

- **Drag** → elemento levanta (scale 1.02 + sombra sobe) · `fast`; cursor
  grabbing; itens vizinhos abrem espaço com Slide.
- **Drop** → Dock (assenta scale 1.02→1) na posição final; alvo ilumina borda.
- **Resize** → handles aparecem no hover; dimensão mostrada em Caption
  tabular; grid de snap sutil.

## Ações de item

- **Delete** → confirma (Dialog se irreversível); item sai com fade ×0.7 +
  colapso de altura; Toast com **Undo** (5 s).
- **Archive** → item desliza para fora lateralmente + fade; Toast com Undo.
- **Favorite / Like** → ícone preenche do centro com 1 micro-pulso de escala
  (1→1.15→1) · `fast`; cor vira acento. Sem confete.
- **Publish** → **Publishing** (doc 11): botão faz Morph → pill de progresso →
  Success (check por stroke + 1 pulso). Em contexto de ads, leva ao fluxo de
  aprovação, nunca publica direto.
- **Approval** → botão "Aprovar" → Reviewing curto → Success verde; a linha do
  draft transita de âmbar para verde e sai da fila com Slide.

## Histórico

- **Undo / Redo** → conteúdo reverte com Morph para o estado anterior; Toast
  discreto confirma ("Desfeito").

## Conteúdo e dados

- **Generate** → dispara a máquina de IA (doc 12): Thinking → Streaming.
- **Copy** → ícone troca para check `fast` por 1,5 s + Toast opcional.
- **Paste** → destino pulsa borda uma vez; conteúdo entra com fade.
- **Save** → sem modal: botão mostra Success inline; ou auto-save com selo
  "Salvo" em Caption que aparece/desaparece por fade.
- **Search** → ao digitar, resultados fazem crossfade `fast` (nunca piscam);
  vazio mostra estado que sugere refinamento.
- **Share** → Popover com opções; link copiado dá check + Toast. Ação externa
  (publicar/enviar) sempre confirma antes.
- **Upload** → dropzone ilumina borda no dragover; progresso por **Flow
  Loader** (não %); thumb aparece com Scale ao concluir.
- **Download** → ícone → check `fast`; se demorar, Flow Loader inline.

## IA (resumo — detalhe no doc 12)

- **AI Response** → chega com Streaming, não "aparece pronta"; ações
  esmaecidas até concluir.
- **AI Streaming** → texto por palavra + caret de gradiente; auto-rolagem
  suave.
- **AI Completion** → Glow assenta + Success sutil; ações ativam; fonte e
  sugestão visíveis.

## Regras transversais

- Toda micro-interação respeita `prefers-reduced-motion` (doc 18): vira
  transição de opacidade/cor instantânea, sem translate/scale.
- Nada de bounce/elastic; nada de comemoração em ações rotineiras.
- Feedback tátil (mobile/haptics) só em Publish/Approval/Erro, nível leve.
