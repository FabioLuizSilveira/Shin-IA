# PRD — Shinã I.A. (Gestão de Aluguel de Carros)

## Problem Statement
Plataforma de gestão de aluguel de carros. App único que serve o **locador** (gerenciar locação: prazo do contrato, pagamentos, contrato entre as partes) e o **locatário** (visão completa dos carros locados, status, plano de manutenção, monitoramento, marketplace).

## User Choices
- Ambos os perfis (locador + locatário)
- Autenticação: email/senha + JWT (Google auth Emergent scaffolded)
- Pagamentos: Stripe (checkout)
- Extras: contratos digitais + PDF + assinatura digital, notificações de vencimento, manutenção programada, GPS/monitoramento, chat locador↔locatário, marketplace

## Architecture
- **Backend**: FastAPI + MongoDB (motor). JWT Bearer auth, bcrypt. Routes prefixed `/api`.
- **Frontend**: Expo Router (file-based), role-based tab trees `(locador)` e `(locatario)`, shared detail routes `vehicle/[id]` e `contract/[id]`.
- **Theme**: Moss Green (#4A5D23), iOS-native clean, sem azul/roxo.

## User Personas
1. **Locador (Carlos)** — dono da frota; cadastra veículos, cria contratos, agenda manutenções, acompanha pagamentos/receita.
2. **Locatário (Ana)** — aluga veículos; explora marketplace, vê carros alugados, status, manutenções, paga e assina contratos.

## Core Requirements (static)
- Auth dois perfis; RBAC (locador cria veículos/contratos/manutenções).
- Gestão de frota, contratos com ciclo de vida (pending→active via assinatura de ambos), pagamentos, manutenção, chat, monitoramento GPS.

## Implemented (2026-06-15)
- ✅ Auth email/senha + JWT (register/login/me), demo login
- ✅ Locador: dashboard com métricas (receita, frota, contratos, manutenções), frota CRUD (add via modal), contratos (criar + listar)
- ✅ Locatário: marketplace com busca, meus alugados, contratos
- ✅ Veículo: detalhe + specs + manutenção (agendar/concluir) + GPS (última posição, simulado)
- ✅ Contrato: detalhe com abas Resumo/Pagamentos/Manutenção/Chat; assinatura digital (ambas as partes → ativa); PDF backend (reportlab); registro de pagamento (PIX/manual/Stripe checkout)
- ✅ Chat com polling; endpoints de mensagens com controle de acesso
- ✅ Seed data (4 veículos, 1 contrato, pagamentos, manutenção)
- ✅ Backend testado: 31/31 pytest PASS

## Backlog / Remaining
- **P0**: Configurar STRIPE_SECRET_KEY para checkout real; download/visualização in-app do PDF (hoje mostra endpoint via Alert)
- **P1**: Google Auth (Emergent) fluxo na UI; notificações de vencimento (contrato/pagamento/manutenção); GPS real (telemetria/expo-location para posição do dispositivo)
- **P2**: mapa react-native-maps (build nativo), edição/exclusão de veículos na UI, encerramento de contrato, upload de fotos (Object Storage)

## Next Tasks
- Integrar chave Stripe e testar pagamento ponta-a-ponta
- Assinatura por desenho (canvas) e download do PDF
- Notificações de vencimento
