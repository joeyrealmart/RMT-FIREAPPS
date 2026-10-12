@echo off
cd /d C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are
:run
"C:\Users\Joey\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\work\serve-fire-inspection-mvp.mjs" 1>>"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\rmt-fire-local-data\server-out.log" 2>>"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\rmt-fire-local-data\server-err.log"
set "RMT_SERVER_EXIT=%ERRORLEVEL%"
if "%RMT_SERVER_EXIT%"=="98" (
  echo [%DATE% %TIME%] Port 8026 is already in use. Watchdog stopped to avoid a restart loop.>>"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\rmt-fire-local-data\server-err.log"
  exit /b 98
)
echo [%DATE% %TIME%] RMT preview server exited with code %RMT_SERVER_EXIT%. Restarting in 3 seconds.>>"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\rmt-fire-local-data\server-err.log"
timeout /t 3 /nobreak >nul
goto run
