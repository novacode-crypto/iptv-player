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
echo.

REM --- 0) Comprobar Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo Descargalo desde https://nodejs.org/ y vuelve a intentarlo.
    pause
    exit /b 1
)

REM --- 1) Instalar dependencias si falta node_modules ---
if not exist "node_modules" (
    echo [INFO] Instalando dependencias ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo npm install.
        pause
        exit /b 1
    )
    echo.
)

REM --- 2) Compilar si falta dist\index.html ---
if not exist "dist\index.html" (
    echo [INFO] Compilando proyecto ^(npm run build^)...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Fallo npm run build.
        pause
        exit /b 1
    )
    echo.
)

REM --- 3) Avisar si el puerto esta ocupado ---
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [AVISO] El puerto %PORT% parece estar en uso.
    echo Cierralo antes de continuar o cambia PORT en este archivo.
    pause
    exit /b 1
)

echo [INFO] Iniciando servidor local en %URL% ...
echo [INFO] El navegador se abrira automaticamente cuando este listo.
echo [INFO] Para detener NEXA IPTV PLAYER pulsa CTRL+C o cierra esta ventana.
echo.

REM --- 4) Abrir navegador cuando el puerto responda ---
start "" /min powershell -NoProfile -WindowStyle Hidden -Command ^
"for($i=0;$i -lt 120;$i++){try{$c=New-Object Net.Sockets.TcpClient; $c.Connect('%HOST%',%PORT%); $c.Close(); Start-Process '%URL%'; break}catch{Start-Sleep -Milliseconds 500}}"

set "NODE_OPTIONS=--no-deprecation"
call npm run preview -- --host %HOST% --port %PORT% --strictPort

REM --- 5) Servir el build con Vite en modo preview ---
call npm run preview -- --host %HOST% --port %PORT% --strictPort

echo.
echo [INFO] NEXA IPTV PLAYER se ha detenido.
pause
exit /b 0