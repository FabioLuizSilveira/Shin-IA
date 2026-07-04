# 16 — Background System

> Shinã Flow Design System™ · Wave 2 · LUMEN
> Fundos criam atmosfera sem competir com o conteúdo. Regra-mãe: **discreto.
> Nunca poluir.** Se você "nota" o fundo antes do conteúdo, ele falhou.

---

## Princípios

1. **Ambiente, não protagonista** — o fundo é a sala; o conteúdo é a conversa.
2. **Um efeito por viewport** — nunca Aurora + Mesh + Particles juntos.
3. **Contraste preservado** — o fundo nunca reduz a legibilidade do texto
   abaixo de 4.5:1.
4. **Barato** — GPU-friendly, sem custo perceptível de performance (doc 18).
5. **Escuro por padrão** — a base é sempre `#0F172A` (app) ou `#020617`
   (marketing); os efeitos somam luz sutil por cima.

---

## Catálogo

Formato: **objetivo · composição · motion · onde · limites.**

### Aurora Background

- **Objetivo**: atmosfera premium, sensação de "vivo e calmo".
- **Composição**: 2–3 glows radiais (cores da marca a 8–12%), muito
  desfocados, sobre base escura.
- **Motion**: glows transladam lentamente (`ambient` 10–14 s, linear); opacidade
  fixa. Estático em reduced-motion.
- **Onde**: heros, splash, login, tela de boas-vindas.
- **Limites**: 1 glow dominante; nunca atrás de tabelas/formulários densos.

### Mesh Background

- **Objetivo**: profundidade suave em seções de marketing.
- **Composição**: gradient mesh (malha de pontos de cor da marca) muito
  suavizado.
- **Motion**: vértices derivam ±2% (`ambient` 12 s) — Background Mesh (doc 11).
- **Onde**: seções de landing, cards hero grandes.
- **Limites**: opacidade baixa; nunca em áreas de leitura de dados.

### Flow Background

- **Objetivo**: reforçar "operações em movimento".
- **Composição**: linhas de fluxo finíssimas atravessando, quase imperceptíveis.
- **Motion**: dash-offset animado (`ambient` 6 s) — Flow Lines.
- **Onde**: hero de plataforma, seções sobre automação/fluxos.
- **Limites**: ≤ 5 linhas; opacidade ≤ 8%.

### Particle Background

- **Objetivo**: sugerir escala e dados.
- **Composição**: campo esparso de pontos (≤ 20 visíveis).
- **Motion**: deriva lenta, sem interação (Particles, doc 11).
- **Onde**: hero de marketing, seções "escala/números".
- **Limites**: marketing apenas; nunca em produto/dashboard.

### Glass Background

- **Objetivo**: separar camadas dentro do app.
- **Composição**: painel glass (doc 08 §4) sobre a base escura; sem movimento.
- **Onde**: sidebars flutuantes, painéis, modais.
- **Limites**: máximo 2 níveis de glass empilhados.

### Gradient Background

- **Objetivo**: bloco de marca pontual (CTA hero, faixa).
- **Composição**: gradiente oficial da marca (doc 04 §8), estático.
- **Onde**: faixas de CTA, tiles de marca grandes.
- **Limites**: nunca como fundo de tela inteira de app; nunca sob texto de
  corpo longo.

### Noise Background

- **Objetivo**: eliminar banding de gradientes.
- **Composição**: ruído monocromático, opacidade ≤ 3%.
- **Motion**: nenhum.
- **Onde**: por cima de qualquer gradiente grande (marketing).
- **Limites**: invisível a olho consciente; nunca textura perceptível.

### Dashboard Background

- **Objetivo**: base neutra e calma para dados.
- **Composição**: `#0F172A` chapado; no máximo um glow de canto a ≤ 6%.
- **Motion**: nenhum (dados exigem quietude — doc 11 §7).
- **Onde**: todas as telas de produto/dashboard.
- **Limites**: sem mesh, sem particles, sem flow atrás de dados.

### Hero Background

- **Objetivo**: primeira impressão de marketing.
- **Composição**: Aurora + (opcional) Flow ou Mesh + Noise; glow ancora o
  título.
- **Onde**: topo de landing (plataforma e MKT).
- **Limites**: 1 efeito dominante + Noise; elementos flutuantes nunca sobre o
  texto (doc 08 §7).

### Marketplace Background

- **Objetivo**: vitrine convidativa, mas sem roubar cena das cards.
- **Composição**: Dashboard Background + 1 glow de acento superior discreto.
- **Onde**: marketplace de templates/prompts/agentes.

### Landing Background

- **Objetivo**: fio condutor da página inteira.
- **Composição**: base `#020617`; cada seção pode alternar Aurora/Mesh/Flow,
  mas só **um** por seção, com transições suaves entre seções (Section Reveal).
- **Onde**: páginas institucionais e de produto.

---

## Matriz de uso

| Contexto             | Fundo permitido                          |
| -------------------- | ---------------------------------------- |
| Dashboard / produto  | Dashboard Background                     |
| Login / splash       | Aurora                                   |
| Hero de landing      | Hero (Aurora + 1 + Noise)                |
| Seção de landing     | Mesh **ou** Flow **ou** Particle (um só) |
| CTA / faixa de marca | Gradient (+ Noise)                       |
| Painéis / modais     | Glass                                    |
| Marketplace          | Marketplace Background                   |

Regra final: na dúvida, use Dashboard Background (chapado). O fundo mais
elegante da Shinã é, quase sempre, o mais quieto.
