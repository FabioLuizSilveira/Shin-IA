#!/usr/bin/env pwsh
# scripts/start-supabase.ps1
# Inicia o Supabase local (Docker) se ainda não estiver rodando.

$composeFile = Join-Path $PSScriptRoot "..\supabase\docker-compose.yml"

# Verifica serviços em execução
$running = docker compose -f $composeFile ps --services --filter "status=running"
if ($running) {
  Write-Host "Supabase já está rodando."
} else {
  Write-Host "Iniciando Supabase..."
  docker compose -f $composeFile up -d
}
