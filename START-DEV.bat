@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title NEXA IPTV PLAYER (DEV)
set "PORT=45873"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%"
set "NODE_NO_WARNINGS=1"

where node >nul 2>nul || (echo [ERROR] Node.js no instalado. & pause & exit /b 1)
if not exist "node_modules" (call npm install || (pause & exit /b 1))

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (call "%~dp0STOP.bat" /quiet & timeout /t 2 /nobreak >nul)

start "" /min powershell -NoProfile -WindowStyle Hidden -Command ^
"for($i=0;$i -lt 120;$i++){try{$c=New-Object Net.Sockets.TcpClient; $c.Connect('%HOST%',%PORT%); $c.Close(); Start-Process '%URL%'; break}catch{Start-Sleep -Milliseconds 500}}"

call npm run dev -- --host %HOST% --port %PORT% --strictPort
pause