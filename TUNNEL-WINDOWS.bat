@echo off
chcp 65001 >nul
cd /d "%~dp0"
title KOSPIN SMS - Cloudflare Tunnel
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-tunnel.ps1"
if errorlevel 1 goto failed
goto end
:failed
echo.
echo Tunnel berhenti atau gagal. Pastikan komputer tetap hidup.
pause
:end
