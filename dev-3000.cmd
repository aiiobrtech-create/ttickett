@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\free-port-3000.ps1" -Port 3000
call npm.cmd run dev
