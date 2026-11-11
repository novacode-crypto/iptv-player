@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if /i not "%~1"=="/quiet" (
    echo ================================================================
    echo   NEXA IPTV PLAYER :: DETENCION
    echo ================================================================
)
set "PORT=45873"

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo [INFO] Deteniendo PID %%P en puerto %PORT%...
    taskkill /PID %%P /F /T >nul 2>nul
)

if not defined FOUND (
    if /i not "%~1"=="/quiet" echo [INFO] No hay proceso escuchando en el puerto %PORT%.
) else (
    if /i not "%~1"=="/quiet" echo [OK] Proceso detenido.
)

if /i not "%~1"=="/quiet" timeout /t 2 /nobreak >nul
endlocal
exit /b 0