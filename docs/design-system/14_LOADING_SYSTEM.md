# 14 — Loading System

> Shinã Flow Design System™ · Wave 2 · LUMEN
> **Spinner tradicional é proibido em toda a Shinã.** Esperar deve parecer
> preparo, não travamento. Sempre que possível: mostrar estrutura (Skeleton),
> não vazio.

---

## Princípios

1. **Estrutura antes de conteúdo** — Skeleton que prevê o layout final.
2. **Fluxo, não giro** — movimento contínuo em uma direção (fluir), nunca um
   círculo rodando sem fim.
3. **Honestidade** — sem porcentagem falsa; ou fluxo indeterminado, ou tempo
   real.
4. **Calma** — loaders são discretos, monocromáticos com um toque de acento,
   nunca festivos.
5. **Rápido percebido** — Skeleton aparece em < 100 ms; se a espera for < 300
   ms, não mostrar loader nenhum (evita flash).

---

## Catálogo

Formato: **objetivo · aparência · motion · onde.**

### Skeleton (padrão universal)

- **Objetivo**: prever o layout enquanto os dados chegam.
- **Aparência**: blocos `surface.glass` no formato do conteúdo real
  (linhas de texto, cards, células).
- **Motion**: shimmer — gradiente de luz translada da esquerda para a direita,
  `ambient` 1.5 s, opacidade baixa. Nunca pulsa piscando.
- **Onde**: tabelas, listas, cards, detalhes, dashboards.

### Flow Loader

- **Objetivo**: progresso indeterminado (upload, ação curta).
- **Aparência**: barra fina `radius-full`; um segmento de gradiente de marca
  flui ao longo do trilho.
- **Motion**: segmento translada continuamente `linear`; sem começo/fim
  aparentes.
- **Onde**: uploads, botões em ação, topo de página em navegação.

### Neural Loader

- **Objetivo**: IA processando (Thinking).
- **Aparência**: 3–7 nós com arestas; luz percorre as conexões em sequência.
- **Motion**: Neural Connections + Glow Pulse (doc 11/12).
- **Onde**: qualquer estado Thinking/Planning da IA.

### Streaming Loader

- **Objetivo**: saída de IA sendo gerada.
- **Aparência**: caret de gradiente + palavras surgindo.
- **Motion**: Streaming (doc 11).
- **Onde**: respostas, insights, copy.

### Aurora Loader

- **Objetivo**: carregamento de tela cheia (boot de app, transição pesada).
- **Aparência**: fundo Aurora (doc 16) suave + logo/monograma com Glow Pulse.
- **Motion**: glows transladando lentamente; monograma respira.
- **Onde**: splash inicial, troca de workspace/tenant.

### Pulse Loader

- **Objetivo**: placeholder mínimo de um único elemento pequeno.
- **Aparência**: bloco glass com opacidade oscilando suavemente.
- **Motion**: opacidade 4%→7%→4% `ambient` 1.5 s.
- **Onde**: avatar, badge, valor isolado (quando Skeleton é exagero).

### Connection Loader

- **Objetivo**: estabelecendo integração externa (Meta, Google, MCP).
- **Aparência**: dois nós (origem/destino) e uma Flow Line os ligando.
- **Motion**: linha "preenche" da origem ao destino; ao conectar, ambos
  acendem (Success).
- **Onde**: OAuth de integrações, handshake de MCP.

### Thinking Loader

- Alias de Neural Loader com texto honesto ao lado (doc 12). Usado quando há
  espaço para a copy do estado.

### Background Loader

- **Objetivo**: trabalho assíncrono em segundo plano (jobs, exportação).
- **Aparência**: chip discreto com Flow Loader mini + rótulo ("Exportando…").
- **Motion**: fluxo mini; ao concluir, vira Success + Toast.
- **Onde**: exportações, geração em lote, sincronização.

### Metric Loader

- **Objetivo**: KPIs carregando.
- **Aparência**: Skeleton do número (bloco do tamanho do valor) + rótulo já
  visível.
- **Motion**: shimmer; ao chegar o dado, **Metric Counter** anima até o valor.
- **Onde**: Metric Cards, dashboards.

### Chart Loader

- **Objetivo**: gráfico carregando.
- **Aparência**: eixos e grid em `border.subtle` já desenhados; área de dados
  em Skeleton.
- **Motion**: shimmer na área; ao chegar, **Chart Grow**.
- **Onde**: analytics.

### Gallery Loader

- **Objetivo**: grade de mídias (criativos, swipe file).
- **Aparência**: grade de tiles glass no aspect ratio final.
- **Motion**: shimmer; imagens entram com Scale + fade, stagger 20 ms.
- **Onde**: Ad Library, Creative Studio, marketplace.

### Marketplace Loader

- Gallery Loader + linhas de metadados (nome/preço) em Skeleton.

### AI Loader

- Termo guarda-chuva: em qualquer contexto de IA, use Neural (thinking) →
  Streaming (output), nunca Flow/spinner. Ver doc 12.

---

## Regras de escolha (decisão rápida)

| Situação              | Loader                     |
| --------------------- | -------------------------- |
| Lista/tabela/detalhe  | Skeleton                   |
| KPI                   | Metric Loader              |
| Gráfico               | Chart Loader               |
| Grade de mídia        | Gallery/Marketplace Loader |
| Ação curta/upload     | Flow Loader                |
| IA pensando           | Neural Loader              |
| IA escrevendo         | Streaming Loader           |
| Integração conectando | Connection Loader          |
| Tela cheia/boot       | Aurora Loader              |
| Job em background     | Background Loader          |

Nunca: círculo girando, três bolinhas genéricas, "Loading…", barra com % falsa.
Sempre: `prefers-reduced-motion` reduz shimmer/fluxo a um fade estático suave
(doc 18).
