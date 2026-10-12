@echo off
cd /d C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are
powershell -NoProfile -Command "try { $d = Invoke-RestMethod -TimeoutSec 2 http://127.0.0.1:8026/api/diagnostics; if ($d.app -eq 'RMT FIREAPPS' -and $d.port -eq 8026 -and $d.listeningAddress -eq '0.0.0.0:8026') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo RMT FIREAPPS is already serving the expected LAN build on port 8026.
  exit /b 0
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8026 .*LISTENING"') do (
  echo Port 8026 is occupied by PID %%P, but it is not the expected RMT FIREAPPS LAN server.
  exit /b 1
)
start "RMT Fire Preview Server" /min "C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\work\run-rmt-preview-server.cmd"
