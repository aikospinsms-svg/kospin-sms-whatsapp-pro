@echo off
chcp 65001 >nul
cd /d "%~dp0"
title KOSPIN SMS - Bot WhatsApp Konfirmasi
where node >nul 2>nul
if errorlevel 1 goto noNode
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3002/health' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto already
if exist "node_modules\express\package.json" goto ready
 echo Paket NPM belum ada. Jalankan npm install terlebih dahulu.
 call npm install
 if errorlevel 1 goto failed
:ready
node scripts\fix-libsignal.js
if errorlevel 1 goto failed
node index.js
if errorlevel 1 goto failed
goto end
:already
echo Bot di port 3002 sudah berjalan. Jangan jalankan bot kedua.
start "" "http://localhost:3002"
goto end
:noNode
echo Node.js belum terpasang. Pasang Node.js 24 LTS dulu.
goto failed
:failed
echo.
echo Bot gagal dijalankan. Baca pesan error di atas.
pause
:end
