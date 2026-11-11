@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title NEXA IPTV PLAYER :: DIAGNOSTICS
set "PORT=45873"
set "HOST=127.0.0.1"

echo ================================================================
echo   NEXA IPTV PLAYER :: DIAGNOSTICO TECNICO
echo ================================================================
echo [DIR]   %CD%
echo [FECHA] %DATE% %TIME%
echo.

echo --- RUNTIME ---
where node >nul 2>nul && (node -v) || echo Node.js: NO INSTALADO
where npm  >nul 2>nul && (call npm -v) || echo npm: NO DISPONIBLE
echo.

echo --- ARCHIVOS DEL PROYECTO ---
if exist "package.json"    (echo package.json:    OK) else (echo package.json:    FALTA)
if exist "vite.config.ts"  (echo vite.config.ts:  OK) else if exist "vite.config.js" (echo vite.config.js:  OK) else (echo vite.config:     NO ENCONTRADO)
if exist "tsconfig.json"   (echo tsconfig.json:   OK) else (echo tsconfig.json:   FALTA)
if exist "node_modules"    (echo node_modules:    OK) else (echo node_modules:    FALTA)
if exist "dist\index.html" (echo dist\index.html: OK) else (echo dist\index.html: FALTA)
if exist ".env"            (echo .env:            OK) else if exist ".env.example" (echo .env:            FALTA, hay .env.example) else (echo .env:            no presente)
echo.

echo --- PUERTO %PORT% ---
netstat -ano | findstr ":%PORT%" | findstr "LISTENING"
if errorlevel 1 echo Puerto %PORT%: LIBRE
echo.

echo --- DEPENDENCIAS DE PRIMER NIVEL ---
call npm ls --depth=0 2>nul
echo.

pause
endlocal
exit /b 0