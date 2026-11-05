@echo off
chcp 65001 >nul
title 数字木兰 · WSL 端口转发

REM ============================================================
REM  把 Windows 的 127.0.0.1:3000 转发到 WSL 里的 3000 端口。
REM  为什么需要：WSL2 的 localhostForwarding 在这台机器上没生效，
REM  浏览器访问 localhost / connect.localhost / admin.localhost
REM  会直接 Connection refused。net/netsh 这一层转发是纯 TCP 透传，
REM  不改 Host 头，所以三域分流（proxy.ts）依旧按域名正常工作。
REM
REM  用法：
REM    windows-access.cmd          建立转发（会弹 UAC 申请管理员）
REM    windows-access.cmd remove   撤销转发
REM
REM  注意：WSL 每次重启 IP 可能变，重新跑一次本脚本即可刷新。
REM ============================================================

REM ---------- 1. 提权 ----------
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [1/4] 正在申请管理员权限，请在弹出的窗口里点「是」...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '%~1' -Verb RunAs"
  exit /b
)

REM ---------- 2. 撤销（可选） ----------
if /i "%~1"=="remove" (
  echo [2/4] 正在撤销转发...
  netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1 >nul 2>&1
  echo [3/4] 已撤销。
  echo [4/4] 完成。
  pause
  exit /b
)

REM ---------- 3. 取 WSL 的 IP ----------
set WSL_IP=
for /f "tokens=4" %%a in ('wsl.exe -e sh -c "ip -4 -o addr show eth0"') do set WSL_IP=%%a
if not defined WSL_IP (
  echo [2/4] 取不到 WSL 的 IP。请先在 WSL 里把项目跑起来，或确认 WSL 正在运行。
  pause
  exit /b 1
)
set WSL_IP=%WSL_IP:/=%
echo [2/4] WSL IP = %WSL_IP%

REM ---------- 4. 建立转发 ----------
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1 >nul 2>&1
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=127.0.0.1 connectport=3000 connectaddress=%WSL_IP%
if errorlevel 1 (
  echo [3/4] 转发建立失败，请检查是否有权限或 IP Helper 服务未启动。
  pause
  exit /b 1
)
echo [3/4] 转发已建立：127.0.0.1:3000 -^> %WSL_IP%:3000

REM ---------- 5. 验证 ----------
echo [4/4] 正在验证...
timeout /t 2 >nul
curl -s -o nul -w "    公众站   http://localhost:3000          -> %%{http_code}\n" --max-time 8 http://localhost:3000/
curl -s -o nul -w "    工作台   http://connect.localhost:3000  -> %%{http_code}\n" --max-time 8 http://connect.localhost:3000/
curl -s -o nul -w "    CMS后台 http://admin.localhost:3000   -> %%{http_code}\n" --max-time 8 http://admin.localhost:3000/

echo.
echo ============================================================
echo  可以访问了：
echo    公众站    http://localhost:3000
echo    工作台    http://connect.localhost:3000
echo    CMS后台   http://admin.localhost:3000/admin
echo.
echo  WSL 重启后 IP 可能变，重新运行本脚本刷新即可。
echo ============================================================
pause
