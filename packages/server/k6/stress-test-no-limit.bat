@echo off
REM Stress Test with Rate Limiting Disabled
REM This script temporarily disables rate limiting for load testing

echo ============================================
echo   MakatiReport Stress Test (No Limits)
echo ============================================
echo.
echo WARNING: This will disable rate limiting!
echo Only use for testing on local/dev environment.
echo.
pause

REM Find K6
set "K6_CMD=k6"
where k6 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\k6\k6.exe" (
        set "K6_CMD=C:\Program Files\k6\k6.exe"
    ) else (
        echo ERROR: K6 not found. Please install K6 first.
        pause
        exit /b 1
    )
)

echo Found K6 at: %K6_CMD%
echo.

REM Set environment variable to disable rate limiting
set DISABLE_RATE_LIMIT=true

echo Starting server with DISABLE_RATE_LIMIT=true...
echo.
echo IMPORTANT: Make sure your server is running with this environment variable!
echo You can start it with:
echo    cd ..\
echo    set DISABLE_RATE_LIMIT=true ^&^& npm run dev
echo.
pause

echo Running stress test...
"%K6_CMD%" run stress-test.js

echo.
echo ============================================
echo   Test Complete!
echo ============================================
echo.
echo REMINDER: Don't forget to restart your server 
echo without DISABLE_RATE_LIMIT for normal operation.
echo.
pause
