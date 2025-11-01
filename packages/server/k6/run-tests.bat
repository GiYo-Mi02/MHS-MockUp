@echo off
REM K6 Load Testing Runner for MakatiReport
REM This script helps you run different K6 test scenarios easily

echo ============================================
echo   MakatiReport K6 Load Testing Suite
echo ============================================
echo.

REM Check if K6 is installed
where k6 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: K6 is not installed!
    echo.
    echo Please install K6 first:
    echo   Option 1: choco install k6
    echo   Option 2: winget install k6
    echo   Option 3: Download from https://dl.k6.io/msi/k6-latest-amd64.msi
    echo.
    pause
    exit /b 1
)

echo K6 is installed: 
k6 version
echo.

echo Select a test to run:
echo.
echo   1. Smoke Test (1 min, 1-5 users)
echo   2. Load Test (5 min, up to 100 users)
echo   3. Stress Test (10 min, up to 500 users)
echo   4. Spike Test (sudden surge simulation)
echo   5. Soak Test (30 min endurance)
echo   6. API Comprehensive Test (3 min, all endpoints)
echo   7. Run All Tests (Sequential)
echo   8. Exit
echo.

set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto smoke
if "%choice%"=="2" goto load
if "%choice%"=="3" goto stress
if "%choice%"=="4" goto spike
if "%choice%"=="5" goto soak
if "%choice%"=="6" goto api
if "%choice%"=="7" goto all
if "%choice%"=="8" goto end

echo Invalid choice!
pause
exit /b 1

:smoke
echo.
echo Running Smoke Test...
echo This will verify basic functionality with minimal load.
echo.
k6 run k6\smoke-test.js
goto result

:load
echo.
echo Running Load Test...
echo This simulates normal daily usage with up to 100 concurrent users.
echo Duration: 5 minutes
echo.
k6 run k6\load-test.js
goto result

:stress
echo.
echo WARNING: Stress Test will push your system to its limits!
echo This may cause temporary performance issues.
echo.
set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" goto end
echo.
echo Running Stress Test...
echo This will test up to 500 concurrent users.
echo Duration: 10 minutes
echo.
k6 run k6\stress-test.js
goto result

:spike
echo.
echo Running Spike Test...
echo This simulates sudden traffic surges.
echo Duration: 4 minutes
echo.
k6 run k6\spike-test.js
goto result

:soak
echo.
echo Running Soak Test...
echo This will test system stability over 30 minutes.
echo.
set /p duration="Enter duration (default: 30m, press Enter to use default): "
if "%duration%"=="" set duration=30m
echo Running soak test for %duration%...
echo.
k6 run -e DURATION=%duration% k6\soak-test.js
goto result

:api
echo.
echo Running API Comprehensive Test...
echo This tests all major endpoints with realistic flows.
echo Duration: 3 minutes
echo.
k6 run k6\api-test.js
goto result

:all
echo.
echo Running ALL tests sequentially...
echo This will take approximately 30-40 minutes.
echo.
set /p confirm="Continue? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo [1/6] Running Smoke Test...
k6 run k6\smoke-test.js

echo.
echo [2/6] Running API Test...
k6 run k6\api-test.js

echo.
echo [3/6] Running Load Test...
k6 run k6\load-test.js

echo.
echo [4/6] Running Spike Test...
k6 run k6\spike-test.js

echo.
echo [5/6] Running Stress Test...
k6 run k6\stress-test.js

echo.
echo [6/6] Running Soak Test (10 min)...
k6 run -e DURATION=10m k6\soak-test.js

echo.
echo ============================================
echo   All Tests Completed!
echo ============================================
goto end

:result
echo.
echo ============================================
echo   Test Completed!
echo ============================================
echo.
echo Next steps:
echo   - Review the results above
echo   - Check server logs for any errors
echo   - Monitor database performance
echo   - Optimize bottlenecks if needed
echo.
goto menu_again

:menu_again
echo.
set /p again="Run another test? (Y/N): "
if /i "%again%"=="Y" (
    cls
    goto :eof
    call %0
)

:end
echo.
echo Thank you for testing MakatiReport!
echo.
pause
