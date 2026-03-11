@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  PC Dashboard - Windows Setup & Launch Script v3
::  Place in pc-dashboard\ root folder and double-click.
::  Log: pc-dashboard\setup_log.txt
:: ============================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "LOG=%ROOT%setup_log.txt"
set "VENV=%BACKEND%\.venv"

echo PC Dashboard Setup Log > "%LOG%"
echo Run Date: %DATE% %TIME% >> "%LOG%"
echo Root Dir: %ROOT% >> "%LOG%"
echo. >> "%LOG%"

echo.
echo  ==========================================
echo   PC Dashboard - Auto Setup ^& Launch v3
echo  ==========================================
echo.
echo  Log: %LOG%
echo.


:: ─────────────────────────────────────────────
:: STEP 1: Check Python
:: Use 'where' - reliable, not affected by output redirect
:: ─────────────────────────────────────────────
echo [1/8] Checking Python...
echo [STEP 1] Checking Python... >> "%LOG%"

where python >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Python not found in PATH. >> "%LOG%"
    echo   Fix: https://www.python.org/downloads/ >> "%LOG%"
    echo   Check "Add Python to PATH" during install. >> "%LOG%"
    echo  [ERROR] Python not found. Download from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during install.
    pause & exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do (
    set PYVER=%%v
    echo   OK: %%v >> "%LOG%"
)
echo   OK: !PYVER!


:: ─────────────────────────────────────────────
:: STEP 2: Check Node.js
:: ─────────────────────────────────────────────
echo [2/8] Checking Node.js...
echo. >> "%LOG%"
echo [STEP 2] Checking Node.js... >> "%LOG%"

where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js not found in PATH. >> "%LOG%"
    echo   Fix: https://nodejs.org/ - download LTS version. >> "%LOG%"
    echo   Restart this script after installing. >> "%LOG%"
    echo  [ERROR] Node.js not found. Downloading page...
    start https://nodejs.org/
    pause & exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>^&1') do (
    set NODEVER=%%v
    echo   OK Node: %%v >> "%LOG%"
)
for /f "tokens=*" %%v in ('npm --version 2^>^&1') do (
    set NPMVER=%%v
    echo   OK npm:  %%v >> "%LOG%"
)
echo   OK Node: !NODEVER!
echo   OK npm:  !NPMVER!


:: ─────────────────────────────────────────────
:: STEP 3: Create .env if missing
:: ─────────────────────────────────────────────
echo [3/8] Checking .env file...
echo. >> "%LOG%"
echo [STEP 3] Checking .env... >> "%LOG%"

if not exist "%BACKEND%\.env" (
    if not exist "%BACKEND%\.env.example" (
        echo [ERROR] backend\.env.example not found. >> "%LOG%"
        echo   Is setup.bat in the pc-dashboard\ root? >> "%LOG%"
        echo  [ERROR] .env.example missing. Is setup.bat in pc-dashboard\ root folder?
        pause & exit /b 1
    )
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo   Created .env from .env.example >> "%LOG%"
    echo   Created .env - opening in Notepad...
    echo.
    echo  Edit DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID, save, then
    echo  come back here and press any key to continue.
    echo  (You can leave them blank for now to skip Discord)
    echo.
    start /wait notepad "%BACKEND%\.env"
) else (
    echo   .env already exists. >> "%LOG%"
    echo   .env OK.
)


:: ─────────────────────────────────────────────
:: STEP 4: Create Python venv
:: ─────────────────────────────────────────────
echo [4/8] Creating Python virtual environment...
echo. >> "%LOG%"
echo [STEP 4] Creating venv at %VENV% >> "%LOG%"

if not exist "%VENV%\Scripts\python.exe" (
    python -m venv "%VENV%" >> "%LOG%" 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] venv creation failed. >> "%LOG%"
        echo  [ERROR] venv failed. Check setup_log.txt
        pause & exit /b 1
    )
    echo   Venv created OK. >> "%LOG%"
    echo   Venv created.
) else (
    echo   Venv already exists. >> "%LOG%"
    echo   Venv exists.
)


:: ─────────────────────────────────────────────
:: STEP 5: Upgrade pip
:: ─────────────────────────────────────────────
echo [5/8] Upgrading pip...
echo. >> "%LOG%"
echo [STEP 5] Upgrading pip... >> "%LOG%"

"%VENV%\Scripts\python.exe" -m pip install --upgrade pip >> "%LOG%" 2>&1
echo   pip upgraded. >> "%LOG%"
echo   pip upgraded.


:: ─────────────────────────────────────────────
:: STEP 6: Install Python packages
::  All have pre-built Python 3.13 Windows wheels.
::  No Rust or C compiler required.
:: ─────────────────────────────────────────────
echo [6/8] Installing Python packages (may take ~1 min)...
echo. >> "%LOG%"
echo [STEP 6] pip install packages... >> "%LOG%"

"%VENV%\Scripts\pip.exe" install ^
    fastapi==0.111.0 ^
    "uvicorn[standard]==0.30.1" ^
    websockets==12.0 ^
    psutil==5.9.8 ^
    mss==9.0.1 ^
    Pillow==11.1.0 ^
    pygetwindow==0.0.9 ^
    "discord.py==2.3.2" ^
    python-dotenv==1.0.1 ^
    aiohttp==3.11.12 ^
    pydantic==2.10.6 ^
    pydantic-settings==2.7.0 ^
    numpy==2.2.3 >> "%LOG%" 2>&1

if !ERRORLEVEL! neq 0 (
    echo [ERROR] A Python package failed to install. >> "%LOG%"
    echo   Check the lines above for which one failed. >> "%LOG%"
    echo  [ERROR] Package install failed. Paste setup_log.txt for help.
    pause & exit /b 1
)

echo   All Python packages installed OK. >> "%LOG%"
echo   All Python packages installed.


:: ─────────────────────────────────────────────
:: STEP 7: npm install
:: ─────────────────────────────────────────────
echo [7/8] Installing frontend npm packages...
echo. >> "%LOG%"
echo [STEP 7] npm install... >> "%LOG%"

if not exist "%FRONTEND%\package.json" (
    echo [ERROR] frontend\package.json not found. >> "%LOG%"
    echo  [ERROR] frontend\package.json missing. Is setup.bat in the right folder?
    pause & exit /b 1
)

pushd "%FRONTEND%"
call npm install >> "%LOG%" 2>&1
if !ERRORLEVEL! neq 0 (
    echo [ERROR] npm install failed. >> "%LOG%"
    echo  [ERROR] npm install failed. Check setup_log.txt
    popd & pause & exit /b 1
)
popd

echo   npm install OK. >> "%LOG%"
echo   npm install done.


:: ─────────────────────────────────────────────
:: STEP 8: Launch
:: ─────────────────────────────────────────────
echo [8/8] Launching servers...
echo. >> "%LOG%"
echo [STEP 8] Launching... >> "%LOG%"

start "PC Dashboard - Backend" cmd /k "title PC Dashboard - Backend && cd /d "%BACKEND%" && "%VENV%\Scripts\python.exe" main.py"
timeout /t 4 /nobreak > nul

start "PC Dashboard - Frontend" cmd /k "title PC Dashboard - Frontend && cd /d "%FRONTEND%" && npm run dev"
timeout /t 6 /nobreak > nul

start http://localhost:3000

echo SETUP COMPLETE >> "%LOG%"
echo Backend:  http://localhost:8000 >> "%LOG%"
echo Frontend: http://localhost:3000 >> "%LOG%"

echo.
echo  ==========================================
echo   Done! Dashboard should open in browser.
echo.
echo   Backend  -^> http://localhost:8000
echo   Frontend -^> http://localhost:3000
echo.
echo   If browser shows error, wait 10s + refresh.
echo   Vite needs a moment on first launch.
echo  ==========================================
echo.
pause
exit /b 0
