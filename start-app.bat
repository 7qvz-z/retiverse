@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org からインストールしてください。
  pause
  exit /b 1
)

REM 応答しない古いサーバーを落とす
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

start "retiverse-dev" cmd /k "npm run dev"

powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200){ $ok=$true; break } } catch {} Start-Sleep -Seconds 1 }; if($ok){ Start-Process 'http://127.0.0.1:3000/'; exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo 起動に失敗しました。開いている「retiverse-dev」ウィンドウのエラーを確認してください。
  pause
)
