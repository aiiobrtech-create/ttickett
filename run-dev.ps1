# Garante npm no PATH (terminal do Cursor às vezes não herda o PATH do Node).
$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) {
  $env:Path = "$nodeDir;$env:Path"
}
Set-Location $PSScriptRoot
$npmCmd = Join-Path $nodeDir "npm.cmd"
if (-not (Test-Path $npmCmd)) {
  Write-Host "npm.cmd nao encontrado em $nodeDir" -ForegroundColor Red
  exit 1
}
# npm.cmd evita npm.ps1 (bloqueado por ExecutionPolicy em alguns PCs)
& $npmCmd run dev
