@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or newer from https://nodejs.org first.
  pause
  exit /b 1
)
call npm.cmd ci
if errorlevel 1 goto :failed
for %%M in (opus-mt-de-en opus-mt-ru-en opus-mt-mul-en) do (
  node.exe scripts\setup-translation.mjs %%M
  if errorlevel 1 goto :failed
)
echo Ready. Run START-WINDOWS.cmd.
pause
exit /b 0
:failed
echo Setup failed. Check your connection and free disk space, then retry.
pause
exit /b 1
