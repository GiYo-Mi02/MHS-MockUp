@echo off
REM Performance Monitoring Helper
REM Run this alongside K6 tests to monitor server health

echo ============================================
echo   MakatiReport Performance Monitor
echo ============================================
echo.
echo Starting monitoring... Press Ctrl+C to stop
echo.

:monitor
cls
echo ============================================
echo   System Resources - %TIME%
echo ============================================
echo.

REM Get Node.js process info
echo Node.js Processes:
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE 2>nul
echo.

REM Show network stats
echo Network Connections (Port 4000):
netstat -ano | findstr :4000 2>nul
echo.

REM Count active connections
for /f "tokens=*" %%a in ('netstat -ano ^| findstr :4000 ^| find /c /v ""') do set connections=%%a
echo Active connections to port 4000: %connections%
echo.

echo ============================================
echo Monitoring... (refreshes every 5 seconds)
echo Press Ctrl+C to stop
echo ============================================

timeout /t 5 /nobreak >nul
goto monitor
