# Libera a porta 3000 e sobe o TTICKETT (Express + Vite).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) {
  $env:Path = "$nodeDir;$env:Path"
}

& "$PSScriptRoot\free-port-3000.ps1" -Port 3000

$npmCmd = Join-Path $nodeDir "npm.cmd"
if (-not (Test-Path $npmCmd)) {
  Write-Error "npm.cmd nao encontrado em $nodeDir"
  exit 1
}

Write-Host "[TTICKETT] Iniciando servidor (npm.cmd)..."
& $npmCmd run dev
