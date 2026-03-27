@echo off
title TTICKETT - localhost:3000
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo [TTICKETT] Liberando porta 3000...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\free-port-3000.ps1" -Port 3000

echo [TTICKETT] Iniciando servidor (use Ctrl+C para parar)...
call npm.cmd run dev
pause
