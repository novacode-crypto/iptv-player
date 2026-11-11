@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================================
echo   NEXA IPTV PLAYER :: REINICIO
echo ================================================================
call "%~dp0STOP.bat" /quiet
timeout /t 2 /nobreak >nul
call "%~dp0START.bat"
endlocal
exit /b 0