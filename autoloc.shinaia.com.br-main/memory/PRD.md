# Shinã — Landing Page (PRD)

## Original Problem Statement
Landing page sedutora, moderna, com visual tecnológico para a **Shinã**, plataforma/app de aluguel de carros (gestão do locador + acesso do locatário). Alta conversão, storytelling (Problema → Promessa → Solução → Como funciona → Benefícios → Diferenciais → Provas → Objeções → Oferta → CTA), prova visual/social, CTAs contextualizados, identidade de marca própria, performance + mobile first + SEO, e mensuração (CTA clicks, scroll depth, formulário).

## User Choices
- Integrar com o login/plataforma existente da Shinã (NÃO criar novo backend de auth). CTA "Entrar" → login existente; "Começar agora"/"Criar conta" → fluxo de signup da plataforma.
- Bilíngue PT/EN (toggle).
- Estilo visual à escolha do agente → Dark tech futurista (azul elétrico + violeta plasma, near-black), coerente com o logo.
- Prova social com placeholders realistas.

## Architecture
- **Frontend**: React 19 + Tailwind, framer-motion (reveals/parallax/masked hero), lenis (smooth scroll), react-fast-marquee, react-countup. SPA em `/` (`src/pages/Landing.jsx`).
- **Backend**: FastAPI + MongoDB. Endpoints de captura de lead e analytics (mensuração), sem autenticação própria.
- **i18n**: contexto simples PT/EN (`src/context/LangContext.jsx`, `src/i18n/translations.js`).
- **Integração de auth**: apenas links de saída para a plataforma existente (`src/lib/config.js` → `PLATFORM.login/signup/demo`). **URLs são placeholders** a serem substituídos.

## Implemented (2026-06)
- Hero cinético com reveal mascarado linha-a-linha + parallax 3D do carro + stats.
- Manifesto (capítulos numerados 01→03: Problema→Promessa→Solução).
- Como funciona (4 passos) · Benefícios (bento grid, resultados) · Diferenciais (marquee editorial + IA).
- Demonstração do produto (tabs Locador/Locatário + fotografia tratada).
- Prova social (counters animados + depoimentos) · FAQ (objeções) · Planos (Pro em destaque, tracing glow).
- CTA final + Footer. Nav glass com toggle PT/EN, "Entrar" e "Começar agora".
- Modal de captura de lead → salva em MongoDB (`/api/leads`) e redireciona ao signup da plataforma.
- Mensuração: `/api/events` (page_view, cta_click, form_started/completed, scroll_depth, language_toggle, product_tab, faq_open) + `/api/analytics/summary`.
- SEO: meta tags PT/EN, Open Graph, JSON-LD (SoftwareApplication), lang, fontes Unbounded/Outfit, lazy loading de imagens.

## Backend API
- `POST /api/leads` · `GET /api/leads` · `POST /api/events` · `GET /api/analytics/summary`

## Backlog
- P0: Substituir URLs placeholder da plataforma em `src/lib/config.js`.
- P1: A/B testing de headline/CTA; painel admin de leads/analytics.
- P2: Vídeo/loop no hero; integração real com CRM/e-mail; testes automatizados.
