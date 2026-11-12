@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto noNode
node scripts\reset-admin.js
goto end
:noNode
echo Node.js belum tersedia. Instal Node.js dahulu.
:end
pause
