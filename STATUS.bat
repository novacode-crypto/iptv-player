@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title NEXA IPTV PLAYER :: STATUS
set "PORT=45873"
set "HOST=127.0.0.1"

echo ================================================================
echo   NEXA IPTV PLAYER :: ESTADO
echo ================================================================
echo.

where node >nul 2>nul && (echo Node.js: & node -v) || echo Node.js: NO INSTALADO
where npm  >nul 2>nul && (echo npm:     & call npm -v) || echo npm: NO DISPONIBLE
echo.

if exist "node_modules"    (echo node_modules:    OK)          else (echo node_modules:    FALTA - ejecuta INSTALL.bat)
if exist "dist\index.html" (echo dist\index.html: OK)          else (echo dist\index.html: FALTA - ejecuta BUILD.bat)
if exist ".env"            (echo .env:            OK)          else (echo .env:            no presente)
echo.

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Servidor: ARRANCADO en http://%HOST%:%PORT%
) else (
    echo Servidor: DETENIDO
)
echo.
pause
endlocal
exit /b 0