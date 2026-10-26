@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" "scripts\desktop-launcher.mjs"
) else (
  where node.exe >nul 2>nul
  if errorlevel 1 (
    echo Install Node.js 24 or newer from https://nodejs.org and run SETUP-WINDOWS.cmd first.
    pause
    exit /b 1
  )
  node.exe "scripts\desktop-launcher.mjs"
)
if errorlevel 1 pause
