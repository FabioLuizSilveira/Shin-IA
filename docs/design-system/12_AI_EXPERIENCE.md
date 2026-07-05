# 12 — AI Experience

> Shinã Flow Design System™ · Wave 2 · LUMEN
> A IA da Shinã nunca fica parada e nunca usa "Loading…", spinner ou barra
> comum. Ela parece **viva, pensante e sob controle** — nunca um truque.

---

## 1. Princípios da presença de IA

1. **Viva, não barulhenta** — respira (Glow Pulse), não pisca.
2. **Transparente** — sempre mostra o que está fazendo em linguagem humana
   ("Analisando 30 dias de dados", não "Processando…").
3. **Interrompível** — todo estado tem "Cancelar"; a IA nunca sequestra o
   usuário.
4. **Honesta** — nunca finge progresso (sem barra percentual falsa); mostra
   fluxo real ou tempo decorrido.
5. **Com fonte e ação** — todo resultado diz de onde veio e o que fazer com
   ele.

## 2. Assinatura visual da IA

- **Cor**: acento do produto (índigo no MKT, azul na plataforma) + `MKT Glow`
  como luz.
- **Forma**: nós e conexões (rede neural abstrata), nunca cérebro/robô
  (doc 15).
- **Respiração**: Glow Pulse 4 s é a batida-base presente em todos os estados
  ativos.
- **Caret**: cursor de gradiente pulsante durante geração de texto.

## 3. Máquina de estados

Fluxo canônico:

```
Idle → Listening → Thinking → (Searching | Connecting | Planning)
     → Generating → Streaming → Reviewing → Finished
       ↳ Cancelled / Error a qualquer momento
```

Cada estado abaixo define: **Motion · Glow · Ícone · Texto · Micro-interação ·
Tempo · Feedback.**

### Idle

- **Motion**: estático com Glow Pulse muito sutil (opacidade 6–8%).
- **Glow**: mínimo, ambiente.
- **Ícone**: `Sparkles` estável.
- **Texto**: convite ("Pergunte ou descreva o que precisa").
- **Micro**: hover no campo intensifica o glow levemente.
- **Tempo**: indefinido.
- **Feedback**: pronta, sem pressa.

### Listening (recebendo input)

- **Motion**: caret de gradiente ativo; leve pulso ao ritmo da digitação.
- **Ícone**: `Sparkles` com brilho aumentado.
- **Texto**: espelha contexto ("Entendi. Enter para gerar").
- **Tempo**: enquanto o usuário digita.

### Thinking

- **Motion**: **Neural Connections** — nós fixos, arestas pulsando em
  sequência; Glow Pulse na batida base.
- **Ícone**: constelação de nós (não spinner).
- **Texto**: verbo honesto ("Pensando…", "Analisando sua marca").
- **Micro**: "Cancelar" aparece após 400 ms.
- **Tempo**: até primeiro token; se > 8 s, texto evolui ("Ainda pensando —
  tarefa complexa").
- **Feedback**: cadência calma; nunca acelera artificialmente.

### Searching / Connecting / Planning (sub-estados de Thinking)

- **Searching**: nós se acendem em varredura (busca em dados/Ad Library).
  Texto: "Buscando anúncios de concorrentes".
- **Connecting**: Flow Lines ligam dois nós (integrações/MCP).
  Texto: "Conectando à conta Meta".
- **Planning**: nós se organizam em sequência (estratégia).
  Texto: "Montando a estratégia".

### Generating

- **Motion**: linha de fluxo contínua (não percentual) + Glow Pulse mais vivo.
- **Ícone**: `Wand2` com brilho de fluxo.
- **Texto**: "Gerando…" ou específico ("Criando 3 variações").
- **Tempo**: até começar o stream.

### Streaming (saída de texto)

- **Motion**: **Streaming** — texto surge por palavra (fade 80 ms/palavra),
  caret de gradiente; conteúdo pode auto-rolar suavemente.
- **Micro**: botões de ação (copiar/refazer) esmaecidos até concluir.
- **Feedback**: sensação de pensamento sendo escrito, não de arquivo baixando.

### Reviewing (validação / safety)

- **Motion**: **Reviewing** — highlight varre o conteúdo uma vez (slow).
- **Texto**: "Revisando antes de sugerir" / "Validando orçamento".
- **Enterprise**: liga-se ao draft-first — deixa claro que nada será
  publicado sem aprovação humana.

### Finished

- **Motion**: Glow assenta ao nível Idle; **Success** (check por stroke +
  1 pulso verde) se houve entrega.
- **Ícone**: `Sparkles` calmo ou check.
- **Texto**: resultado + fonte + ação sugerida.
- **Micro**: ações totalmente ativas.

### Cancelled

- **Motion**: fluxo desacelera e fade ×0.7; glow volta a Idle.
- **Texto**: "Cancelado. O que já veio está aqui" (preserva parcial quando útil).

### Error

- **Motion**: transição de cor para danger em `fast`, **sem shake**; glow
  esmaece.
- **Ícone**: `AlertTriangle`.
- **Texto**: o que houve **+ como resolver** ("Chave de IA ausente — configure
  em Configurações") + "Tentar novamente".
- **Feedback**: digno, nunca alarmista.

## 4. Proibições absolutas

- "Loading…", "Please wait", spinner circular clássico, `...` piscando.
- Barra de progresso com porcentagem inventada.
- Emojis de robô/cérebro; mascotes; "digitando" estilo chat trivial com três
  bolinhas genéricas (o Streaming da Shinã é por palavra, com caret de marca).
- Travar a UI: todo estado de IA é não-bloqueante e cancelável.

## 5. Copy dos estados (tom)

- Verbos no gerúndio, honestos e específicos.
- Primeira pessoa comedida quando fizer sentido ("Encontrei 12 anúncios").
- Nunca prometer o que não vai cumprir; nunca esconder erro atrás de genérico.

## 6. Componentes relacionados

`<AIThinking/>`, `<AIStreaming/>`, `<ThinkingIndicator/>`, `<InsightCard/>`,
`<NeuralLoader/>` (docs 10 e 19). Todos consomem esta máquina de estados —
um único cérebro visual para toda IA da Shinã.
