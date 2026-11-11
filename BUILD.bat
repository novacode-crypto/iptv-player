@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title NEXA IPTV PLAYER :: BUILD

echo ================================================================
echo   NEXA IPTV PLAYER :: COMPILACION DE PRODUCCION
echo ================================================================
echo.

if not exist "node_modules" (
    echo [ERROR] No existen dependencias. Ejecuta INSTALL.bat primero.
    pause
    exit /b 1
)

if exist "tsconfig.json" (
    echo [1/2] Verificando tipos TypeScript...
    call npx tsc --noEmit
    if errorlevel 1 (
        echo [ERROR] Errores de TypeScript. Corrigelos antes de compilar.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Sin tsconfig.json, se omite la verificacion de tipos.
)

echo.
echo [2/2] Compilando con Vite...
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion de Vite.
    pause
    exit /b 1
)

echo.
echo [OK] Compilacion finalizada. Salida en .\dist\
echo.
pause
endlocal
exit /b 0