param([int]$Port = 3000)

$pids = @()
Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.OwningProcess -and $pids -notcontains $_.OwningProcess) {
    $pids += $_.OwningProcess
  }
}

if ($pids.Count -eq 0) {
  Write-Host "[TTICKETT] Porta $Port livre (nada em LISTEN)."
  exit 0
}

foreach ($procId in $pids) {
  try {
    $p = Get-Process -Id $procId -ErrorAction Stop
    Write-Host "[TTICKETT] Encerrando PID $procId ($($p.ProcessName)) que usava a porta $Port"
    Stop-Process -Id $procId -Force
  } catch {
    Write-Warning "Nao foi possivel encerrar PID ${procId}: $_"
  }
}

Start-Sleep -Milliseconds 800
Write-Host "[TTICKETT] Porta $Port liberada."
