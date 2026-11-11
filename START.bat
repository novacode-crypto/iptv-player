@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title NEXA IPTV PLAYER
set "PORT=45873"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%"

echo ============================================================
echo   NEXA IPTV PLAYER v1.0
echo ============================================================

echo [INFO] Iniciando el servidor local en %URL% ...
echo [INFO] El navegador se abrira automaticamente cuando el motor este listo.
echo [INFO] Para detener NEXA IPTV PLAYER pulsa CTRL+C (responde S si se te pregunta) o cierra esta ventana.
echo.

rem Espera a /api/health y abre el navegador (proceso auxiliar que termina solo).
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -UseBasicParsing '%URL%/api/health' -TimeoutSec 2; if($r.StatusCode -eq 200){Start-Process '%URL%'; break}}catch{Start-Sleep -Milliseconds 700}}"

rem El servidor se ejecuta en esta misma consola: CTRL+C lo detiene junto a sus procesos FFmpeg.
node "node_modules\next\dist\bin\next" start -H %HOST% -p %PORT%

echo.
echo [INFO] NEXA IPTV PLAYER se ha detenido.
pause
exit /b 0