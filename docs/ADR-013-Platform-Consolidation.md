# ADR-013 — Unified Platform + Railway Backend + Mobile Architecture

## Status

Aceito

## Contexto

A Shinã IA concluiu toda a arquitetura da plataforma (M1–M20).
Antes do Go Live, será realizada uma consolidação arquitetural visando simplificar manutenção, deploy, escalabilidade e experiência do usuário.
Esta é uma mudança estrutural que:

- Não altera regras de negócio.
- Não altera engines.
- Não altera domínio de negócio.
- Não altera banco de dados.
- Apenas reorganiza a arquitetura física da plataforma.

## Decisão

Transformar a plataforma em uma arquitetura composta por:

- Um único Frontend Web (Next.js) em `apps/web` (substituindo `admin-web` e `tenant-web`).
- Um Backend independente em `apps/api` (para deploy na Railway).
- Um App Mobile em `apps/mobile` (React Native Expo).
- Supabase como Backend-as-a-Service.

### Domínio Oficial

Utilizaremos exclusivamente o domínio `shinaia.com.br` com a seguinte estrutura:

- `https://app.shinaia.com.br`
- `https://api.shinaia.com.br`
- `https://docs.shinaia.com.br`
  Domínios customizados de tenants continuarão sendo suportados e apontarão para a mesma infraestrutura.

### Arquitetura Web

As rotas serão consolidadas em `apps/web` utilizando Route Groups:

- **Públicas**: `/`, `/login`, `/pricing`, `/about`, `/contact`
- **Platform**: `/platform` e subrotas (dashboard, tenants, billing, support, marketplace, settings)
- **Tenant**: `/tenant` e subrotas (dashboard, assets, contracts, operations, billing, commission, reports, tracking, studio)
- **Customer**: `/customer` e subrotas
- **Operator**: `/operator` e subrotas
- **Studio**: `/studio`
- **Marketplace**: `/marketplace`

Um **Login Inteligente** redirecionará dinamicamente o usuário de acordo com sua _Role_, _Tenant Context_ e _Permissions_.

### Backend Independente (Railway)

O `apps/api` concentrará:

- REST API / GraphQL
- Webhook Receiver
- Notification Dispatcher
- AI Runtime
- Background Jobs / Cron Jobs / Queue Workers
- Integration Runtime (ERP, CRM, Telemetria, etc)

### App Mobile

O `apps/mobile` utilizará Expo e React Native, conectando-se ao mesmo backend e autenticação, com branding carregado dinamicamente.

## Consequências

- Os apps `admin-web` e `tenant-web` passam a ser _deprecated_ e futuramente serão removidos.
- Ganhamos um ponto centralizado de entrada e roteamento na web, facilitando gestão de estados globais e sessão.
- O novo backend permitirá integrar processamentos pesados (AI, relatórios, queues) sem onerar Edge Functions.
- Integrações de sistema com parceiros (SAP, TOTVS, etc) se tornam mais limpas passando pela API Railway.
