@echo off
REM Supabase Migration Quick Start Script
REM This script helps you get started with the migration process

echo.
echo ========================================
echo   MakatiReport - Supabase Migration
echo ========================================
echo.

echo This script will help you migrate from MySQL to Supabase.
echo.
echo Prerequisites:
echo   - Supabase account created
echo   - MySQL database backed up
echo   - Node.js installed
echo.

pause

echo.
echo Step 1: Installing dependencies...
echo ================================
cd packages\server
call npm install @supabase/supabase-js
if errorlevel 1 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo ✅ Dependencies installed!

echo.
echo Step 2: Checking for .env file...
echo ================================
if exist .env (
    echo ✅ .env file exists
    echo.
    echo ⚠️  IMPORTANT: You need to add these variables to your .env file:
    echo.
    echo SUPABASE_URL=https://xxxxx.supabase.co
    echo SUPABASE_ANON_KEY=your-anon-key-here
    echo SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
    echo.
    echo You can find these in your Supabase project:
    echo Project Settings ^> API
    echo.
) else (
    echo Creating .env from template...
    copy .env.supabase.example .env
    echo ✅ .env file created! Please edit it with your Supabase credentials.
)

echo.
echo Step 3: Exporting MySQL data...
echo ================================
echo.
echo Please run this command manually:
echo   mysqldump -u root -p --no-create-info --skip-triggers makati_report ^> packages\server\scripts\data_export.sql
echo.
echo Then press any key to continue...
pause >nul

if exist scripts\data_export.sql (
    echo ✅ MySQL data exported!
    
    echo.
    echo Step 4: Converting data to PostgreSQL format...
    echo ================================================
    node scripts\migrate-data.js
    if errorlevel 1 (
        echo ERROR: Failed to convert data!
        pause
        exit /b 1
    )
    echo ✅ Data converted!
) else (
    echo ⚠️  Warning: data_export.sql not found. You'll need to do this manually.
)

echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo.
echo 1. Go to your Supabase project SQL Editor
echo    https://supabase.com/dashboard/project/YOUR_PROJECT/sql
echo.
echo 2. Run these migration files in order:
echo    a) packages\server\supabase\migrations\20240101000000_initial_schema.sql
echo    b) packages\server\supabase\migrations\20240101000001_rls_policies.sql
echo    c) packages\server\scripts\data_export_postgres.sql (if you have data)
echo.
echo 3. Update your .env file with Supabase credentials
echo.
echo 4. Test the migration:
echo    npm run dev
echo.
echo 5. Run K6 tests to verify performance:
echo    cd k6
echo    k6 run smoke-test.js
echo.
echo For detailed instructions, see: MIGRATION-STEPS.md
echo.
echo ========================================
echo.

pause
