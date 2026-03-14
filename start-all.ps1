# ============================================================
# start-all.ps1 — Inicialização completa do Sistema NFSe
# Garante que o PATH do sistema seja carregado antes de iniciar
# ============================================================

# Refresca PATH do sistema (Machine + User) — necessário no Windows
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path    = "$machinePath;$userPath"

$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sistema NFSe — Inicializando servicos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Para instâncias anteriores (evita conflito de porta)
$oldNode = Get-Process -Name "node" -ErrorAction SilentlyContinue |
  Where-Object {
    (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine -like "*backend-municipio*"
  }
if ($oldNode) {
    Write-Host "Encerrando instancia anterior do backend..." -ForegroundColor Yellow
    $oldNode | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Inicia o backend (ele mesmo sobe o servico de IA automaticamente)
Write-Host "Iniciando backend Node.js na porta 3099..." -ForegroundColor Green
Set-Location $ROOT
node src/backend-municipio.js
