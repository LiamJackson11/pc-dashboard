@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  Startup_start.bat
::  Place in C:\pc-dashboard\ and double-click to run.
:: ============================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\.venv\Scripts\python.exe"

echo.
echo  ==========================================
echo   PC Dashboard - Starting Up...
echo  ==========================================
echo.

:: ── Check venv exists ────────────────────────────────────────
if not exist "%VENV%" (
    echo  [ERROR] Virtual environment not found!
    echo.
    echo  You need to run setup.bat first.
    echo.
    pause
    exit /b 1
)

:: ── Check node_modules exists ────────────────────────────────
if not exist "%FRONTEND%\node_modules" (
    echo  [ERROR] Frontend not installed!
    echo.
    echo  You need to run setup.bat first.
    echo.
    pause
    exit /b 1
)

:: ── Kill anything already on port 8000 or 3000 ───────────────
echo  Clearing ports 8000 and 3000 if busy...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo  Ports cleared.
echo.

:: ── Launch Backend ────────────────────────────────────────────
echo  [1/2] Starting Backend on http://localhost:8000 ...
start "PC Dashboard - BACKEND" cmd /k "color 0A && title PC Dashboard - BACKEND && cd /d "%BACKEND%" && "%VENV%" main.py"

:: ── Wait for backend to be ready (poll port 8000) ────────────
echo  Waiting for backend to be ready...
set READY=0
for /l %%i in (1,1,20) do (
    if !READY! equ 0 (
        timeout /t 1 /nobreak >nul
        powershell -Command "try { (New-Object Net.Sockets.TcpClient).Connect('localhost',8000); exit 0 } catch { exit 1 }" >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            set READY=1
            echo  Backend is UP after %%i seconds.
        ) else (
            echo  Still waiting... ^(%%i/20^)
        )
    )
)

if !READY! equ 0 (
    echo.
    echo  [WARNING] Backend did not respond in 20 seconds.
    echo  Check the Backend window for error messages.
    echo  Starting frontend anyway...
    echo.
)

echo.

:: ── Launch Frontend ───────────────────────────────────────────
echo  [2/2] Starting Frontend on http://localhost:3000 ...
start "PC Dashboard - FRONTEND" cmd /k "color 0B && title PC Dashboard - FRONTEND && cd /d "%FRONTEND%" && npm run dev"

:: ── Wait then open browser ────────────────────────────────────
echo  Waiting for frontend to build...
timeout /t 8 /nobreak >nul
start http://localhost:3000

echo.
echo  ==========================================
echo   Done!
echo.
echo   Backend:   http://localhost:8000
echo   Dashboard: http://localhost:3000
echo.
echo   Both server windows are now open.
echo   GREEN window  = Backend  ^(Python^)
echo   CYAN window   = Frontend ^(Vite^)
echo.
echo   To stop everything: close both windows.
echo  ==========================================
echo.
pause
