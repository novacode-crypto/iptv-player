@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title NEXA IPTV PLAYER :: INSTALL

echo ================================================================
echo   NEXA IPTV PLAYER :: INSTALACION
echo ================================================================
echo [INFO] Directorio: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 goto NODE_MISSING
where npm >nul 2>nul
if errorlevel 1 goto NPM_MISSING

echo [INFO] Node.js: & node -v
echo [INFO] npm:     & call npm -v
echo.

echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 goto NPM_FAILED

echo.
echo [2/2] Preparando configuracion...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] .env creado desde .env.example
    ) else (
        echo [AVISO] No hay .env ni .env.example. Se usaran valores por defecto.
    )
) else (
    echo [INFO] .env ya existe, no se modifica.
)

echo.
echo ================================================================
echo [OK] INSTALACION COMPLETADA
echo ================================================================
echo Siguiente paso: BUILD.bat
echo.
pause
endlocal
exit /b 0

:NODE_MISSING
echo [ERROR] Node.js no esta instalado o no esta en PATH.
echo Instala Node.js 20+ desde https://nodejs.org/
goto FAIL

:NPM_MISSING
echo [ERROR] npm no esta disponible. Reinstala Node.js incluyendo npm.
goto FAIL

:NPM_FAILED
echo [ERROR] Fallo npm install.
goto FAIL

:FAIL
echo.
echo INSTALACION INTERRUMPIDA.
pause
endlocal
exit /b 1