# 15 — Illustration System

> Shinã Flow Design System™ · Wave 2 · LUMEN
> Ilustração Shinã é abstrata, luminosa e em movimento. Representa **fluxo,
> energia e inteligência** — nunca figuras.

---

## 1. Proibições absolutas

Nunca ilustrar com:

- Robôs, androides, mascotes.
- Cérebros, neurônios realistas, cabeças humanas.
- Humanos futuristas, mãos tocando telas, "operários do futuro".
- Circuitos clichê, placas-mãe, chips, matrix/código verde.
- Ícones 3D genéricos de marketplace (blobs roxos, foguetes, engrenagens).

Se a ilustração "explica IA mostrando um robô", está errada.

## 2. Vocabulário permitido

A linguagem é construída a partir destes elementos:

| Elemento                   | Forma                                   | Representa                     |
| -------------------------- | --------------------------------------- | ------------------------------ |
| **Fluxo**                  | Linhas curvas contínuas, correntes      | operações em movimento         |
| **Energia**                | Glow, luz emanando                      | inteligência ativa             |
| **Conexões**               | Nós ligados por arestas                 | integração, dados relacionados |
| **Rede neural (abstrata)** | Constelação de pontos e linhas          | IA pensando                    |
| **Dados**                  | Partículas, pontos, feixes              | informação em trânsito         |
| **Órbitas**                | Elementos girando em torno de um centro | ecossistema, plataforma        |
| **Curvas / malhas / mesh** | Superfícies gradientes deformáveis      | profundidade, calma            |
| **Aurora**                 | Manchas de luz em movimento lento       | atmosfera premium              |
| **Gradientes**             | Transições de cor da marca              | identidade                     |
| **Linhas**                 | Traços finos, precisos, animáveis       | precisão, engenharia           |

## 3. Regras de estilo

- **Traço**: fino (1–2 px em viewBox de 24–48), consistente com a iconografia
  (doc 07). Nada encorpado ou "cartoon".
- **Cor**: paleta da marca (doc 04). Gradientes oficiais; glow para luz.
  Fundo sempre escuro (`#0F172A`/`#020617`).
- **Luz**: emana de dentro dos elementos (doc 08 §2), nunca sombra externa.
- **Composição**: assimetria equilibrada; muito espaço negativo; um ponto
  focal luminoso.
- **Profundidade**: por camadas de opacidade e blur, não por perspectiva 3D.
- **Movimento**: ilustrações-chave são animáveis (Flow Lines, Orbit,
  Particles, Aurora — doc 11); versão estática sempre disponível como
  fallback e para `prefers-reduced-motion`.

## 4. Famílias de ilustração

1. **Flow** — correntes de linhas que atravessam a composição.
   Uso: heros, "operações em movimento", vazios de fluxo/pipeline.
2. **Neural** — constelação de nós e conexões pulsantes.
   Uso: tudo relacionado a IA (mas sempre abstrato).
3. **Orbit** — centro luminoso (a plataforma) com elementos orbitando.
   Uso: ecossistema, marketplace, "um lugar para tudo".
4. **Mesh/Aurora** — superfícies e manchas de luz.
   Uso: fundos de seção, atmosfera, estados calmos.
5. **Particle Field** — campo de pontos derivando.
   Uso: dados, escala, "milhões de operações".

## 5. Empty states (uso principal)

Todo empty state usa uma ilustração pequena da família apropriada + a regra do
doc 03 P9 (o que é · por que importa · primeiro passo):

- Lista vazia de campanhas → Flow pequeno + "Nenhuma campanha ainda" + CTA.
- Sem insights → Neural em repouso + "Gere seu primeiro insight".
- Swipe file vazio → Particle field esparso + "Salve anúncios vencedores".

A ilustração é discreta (≤ 96 px de altura), nunca domina o card.

## 6. Spot illustrations e heros

- **Spot** (pequena, decorativa): um único elemento da família, monocromático
  com um acento.
- **Hero** (marketing): composição maior, Aurora + Flow/Orbit, com o glow
  ancorando o título; nunca sobre o texto (doc 08 §7).

## 7. Consistência e produção

- Todas as ilustrações vivem em SVG (animáveis, escaláveis, leves).
- Mesmo sistema de grade e traço da iconografia — um observador não distingue
  onde termina o ícone e começa a ilustração.
- Biblioteca versionada (Wave 3+): cada ilustração tem variante estática e
  animada, clara e escura.
- Proibido stock art, 3D renders, gradientes fora da marca, drop shadows.
