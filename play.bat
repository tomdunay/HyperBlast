@echo off
rem HYPERBLAST launcher: starts the dev server and opens the game in your default browser.
title HYPERBLAST server
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org/ and run this again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First run: installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting HYPERBLAST... the game will open in your browser.
echo Close this window to stop the server.
call npx vite --open
pause
