@echo off
REM Quick Setup and First Test for K6
REM This script will guide you through your first load test

echo.
echo ====================================================
echo   MakatiReport K6 Load Testing - Quick Setup
echo ====================================================
echo.

REM Step 1: Check if K6 is installed
echo [Step 1/4] Checking if K6 is installed...
where k6 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ K6 is already installed!
    k6 version
    goto step2
) else (
    echo ✗ K6 is not installed yet.
    echo.
    echo Please install K6 using one of these methods:
    echo.
    echo   Method 1 (Chocolatey):
    echo   ------------------------
    echo   choco install k6
    echo.
    echo   Method 2 (Winget):
    echo   -------------------
    echo   winget install k6
    echo.
    echo   Method 3 (Direct Download):
    echo   ----------------------------
    echo   Download from: https://dl.k6.io/msi/k6-latest-amd64.msi
    echo.
    echo After installing K6, run this script again.
    echo.
    pause
    exit /b 1
)

:step2
echo.
echo [Step 2/4] Checking if server is running...
echo.

REM Check if port 4000 is listening
netstat -ano | findstr :4000 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Server is running on port 4000
    goto step3
) else (
    echo ✗ Server is not running on port 4000
    echo.
    echo Please start your server first:
    echo.
    echo   1. Open a NEW terminal window
    echo   2. Navigate to: packages\server
    echo   3. Run: npm run dev
    echo.
    echo Keep that terminal open and run this script again.
    echo.
    pause
    exit /b 1
)

:step3
echo.
echo [Step 3/4] Quick health check...
echo.
curl -s http://localhost:4000/api/health >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Server is responding to requests
) else (
    echo ⚠ Could not reach server health endpoint
    echo   Continuing anyway...
)

:step4
echo.
echo [Step 4/4] Ready to run your first load test!
echo.
echo ====================================================
echo.
echo Your system is ready! Here's what happens next:
echo.
echo   • We'll run a SMOKE TEST (1 minute)
echo   • This tests basic functionality with 1-5 users
echo   • You'll see real-time results
echo   • Perfect for verifying everything works
echo.
echo ====================================================
echo.
set /p ready="Ready to start? (Y/N): "
if /i not "%ready%"=="Y" goto cancel

echo.
echo Starting smoke test in 3 seconds...
timeout /t 3 /nobreak >nul

echo.
echo ====================================================
echo   RUNNING SMOKE TEST
echo ====================================================
echo.

REM Run the smoke test
k6 run smoke-test.js

echo.
echo ====================================================
echo   SMOKE TEST COMPLETED!
echo ====================================================
echo.
echo What the results mean:
echo   ✓ checks 100%% = All tests passed
echo   ✓ p(95) ^< 500ms = 95%% of requests were fast
echo   ✓ errors 0%% = No failed requests
echo.
echo Next steps:
echo   1. Run more comprehensive tests with: run-tests.bat
echo   2. Read the docs: QUICKSTART.md or README.md
echo   3. Check OVERVIEW.md for complete guide
echo.
echo Available test commands:
echo   npm run test:smoke  - Quick verification
echo   npm run test:load   - Normal daily load
echo   npm run test:stress - Find your limits
echo   npm run test:spike  - Sudden surge test
echo   npm run test:soak   - Long-term stability
echo   npm run test:api    - All endpoints
echo.
goto end

:cancel
echo.
echo Test cancelled. You can run tests anytime with:
echo   • run-tests.bat (interactive menu)
echo   • npm run test:smoke
echo.

:end
pause
