#!/usr/bin/env pwsh
# scripts/start-supabase.ps1
# Inicia o Supabase local (Docker) se ainda não estiver rodando.

$supabaseDir = Join-Path $PSScriptRoot "..\supabase"

# Verifica se Supabase já está rodando
$running = supabase status -p $supabaseDir 2>$null
if ($LASTEXITCODE -eq 0 -and $running -match "API running at") {
  Write-Host "Supabase já está rodando."
} else {
  Write-Host "Iniciando Supabase..."
  Push-Location $supabaseDir
  supabase start
  Pop-Location
}
