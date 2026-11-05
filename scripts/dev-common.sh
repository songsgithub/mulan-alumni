#!/usr/bin/env bash
# 开发服务器的公共逻辑：识别端口占用 + 接管旧实例。
#
# 由 scripts/dev-run.sh（唯一的开发入口）引用。
#
# ⚠️ 为什么要有它（2026-10-30，用户反馈「每次都启动不起」）：
#   端口 3000 上先跑着一个实例时，后来的人执行 `npm run dev` 会遇到两件事：
#     1. Next 16 检测到已有 dev server → 换到 3001 起 → 接着报
#        “Another next dev server is already running.” 然后退出；
#     2. 于是看起来就是「系统起不来」，其实服务一直好好地跑在 3000 上。
#   现在统一成**后启动的接管先启动的**：
#     - 端口上是**本项目**的旧实例 → 先停掉它，我们接管 3000；
#     - 端口上是**别的程序** → 才报错退出，并说清是谁占着。
#   这样不管谁先谁后起，3000 上永远只有**一个**本项目的开发服务器。

DEV_PORT="${DEV_PORT:-3000}"
DEV_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 监听 DEV_PORT 的进程 PID 列表（ss 优先，其次 lsof）
dev_port_pids() {
  local pids=""
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null \
      | awk -v p=":${DEV_PORT}\$" '$4 ~ p {print}' \
      | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)"
  fi
  if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti:"${DEV_PORT}" 2>/dev/null | sort -u)"
  fi
  printf '%s' "$pids" | tr '\n' ' '
}

# 这个 PID 是不是本项目的开发服务器（next dev / next-server）
#
# ⚠️ 只对**还活着**的进程调用：进程已经退出时 ps 读不到命令行，会返回「不是本项目」，
#    而接管逻辑会把「不是本项目」当成「别的程序占着端口」直接报错退出——
#    实际上那只是个刚死透的进程，端口马上就空出来了。分清这两件事很重要。
dev_is_project_server() {
  local pid="$1" cmd cwd
  cmd="$(ps -o args= -p "$pid" 2>/dev/null || true)"
  [ -z "$cmd" ] && return 1
  case "$cmd" in
    *next-server* | *next*dev*) ;;
    *) return 1 ;;
  esac
  case "$cmd" in
    *"$DEV_ROOT"*) return 0 ;;
  esac
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  [ "$cwd" = "$DEV_ROOT" ] && return 0
  return 1
}

# 这个 PID 还在吗（还占着 socket 吗）
dev_pid_alive() {
  local pid="$1"
  [ -n "$pid" ] || return 1
  [ -d "/proc/$pid" ] || return 1
  # 僵尸进程已经释放了 socket，不算还占着
  case "$(ps -o stat= -p "$pid" 2>/dev/null | tr -d ' ')" in
    Z* | "") return 1 ;;
  esac
  return 0
}

# 本进程自己的祖先链（自己 → 父 → 祖 … → 1）：这些绝不能被接管逻辑杀掉
#
# ⚠️ 用 BASHPID 而不是 $$：在命令替换 `$(...)` 里 $$ 仍是**父 shell** 的 PID，
# 而真正跑着的是子 shell（BASHPID）。用 $$ 会漏掉子 shell 本身，
# 接管逻辑会把自己正在跑的那个子 shell 当成「别的实例」杀掉。
dev_ancestors() {
  local pid="${BASHPID:-$$}"
  while [ -n "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "1" ]; do
    printf '%s ' "$pid"
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  done
}

# 这个 PID 是不是「另一个正在跑的 dev-run.sh 守护实例」。
#
# ⚠️ 不能只靠 pgrep -f 'dev-run.sh'：
#   1. 命令行里**提到**这个路径的进程（编辑器、grep、别的脚本）会被误认；
#   2. `$(...)` 里的子 shell 继承父进程的命令行，同样会被误认。
# 所以改成逐个读 /proc/<pid>/cmdline，要求：
#   - 可执行文件是 bash / sh（脚本是 bash 执行的）；
#   - 参数里**有一个词**正好是脚本路径
#     （`sh -c "bash scripts/dev-run.sh"` 这种把路径包在 -c 字符串里的形式也算）；
#   - 工作目录是项目根（跑本项目脚本的进程一定在项目根里）。
dev_is_supervisor() {
  local pid="$1" arg token argv0 cwd found=0
  [ -r "/proc/$pid/cmdline" ] || return 1
  # 工作目录必须是项目根：别把别的项目的同名脚本算进来
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  [ "$cwd" = "$DEV_ROOT" ] || return 1
  # 第一个参数（可执行文件）要是 bash / sh
  argv0="$(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null | sed -n '1p')"
  case "$(basename "$argv0" 2>/dev/null)" in
    bash | sh | dash) ;;
    *) return 1 ;;
  esac
  # 其余参数里必须有一个词正好是脚本路径
  # （`sh -c "bash scripts/dev-run.sh"` 把路径包在 -c 字符串里的形式也要认出来）
  while IFS= read -r arg; do
    for token in $arg; do
      case "$token" in
        scripts/dev-run.sh | */scripts/dev-run.sh | scripts/dev-watch.sh | */scripts/dev-watch.sh)
          found=1
          break
          ;;
      esac
    done
    [ "$found" -eq 1 ] && break
  done < <(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null)
  [ "$found" -eq 1 ]
}

# 本项目还在跑的**守护实例**——接管前要先停它，否则它会把服务再拉起来，
# 跟新实例抢 3000 端口。
#
# ⚠️ 现在 `npm run dev` 自己就是守护实例（崩了自动拉起），所以这里必须能认出
# 「另一个正在跑的 dev-run.sh」，否则两个守护实例会互相把对方的 next dev 杀掉、
# 无限重启。scripts/dev-watch.sh 是 2026-11-01 合并前的旧脚本，机器上还可能留着
# 没退干净的进程，一并认掉。
dev_supervisor_pids() {
  local pid ancestors
  ancestors=" $(dev_ancestors) "
  for pid in $(pgrep -x bash 2>/dev/null; pgrep -x sh 2>/dev/null); do
    case "$ancestors" in
      *" $pid "*) continue ;;
    esac
    dev_is_supervisor "$pid" && printf '%s ' "$pid"
  done
}

# 接管 3000：停掉本项目的旧实例，等端口空出来，清掉死进程留下的锁
#
# ⚠️ Turbopack 缓存什么时候清（2026-11-02 实测后改）：
#   原来**每次接管都** `rm -rf .next/dev/cache`（181MB），代价是每次 `npm run dev`
#   首屏都要从头编译：实测首页 9.4s（编译 5.2s + 应用初始化 4.1s）；
#   保留缓存时同一台机器首页只要 4.0s。
#   缓存是内容寻址的，**干净退出**留下的缓存是完整的，保留它没有坏处；
#   只有被 SIGKILL 硬杀（可能编译到一半，缓存是半成品）才必须清，
#   否则会出现「module factory is not available」或热更新不生效。
#   → 判定标准：旧实例收到 TERM 后**自己退了**（端口自己空出来）= 干净，保留缓存；
#     没退、我们只能硬杀 = 不干净，清缓存。
#     崩掉自动重拉那条路径（dev-run.sh）显式要求清（DEV_WIPE_CACHE=1）。
#   万一还是撞上「module factory is not available」：`npm run dev:clean`。
dev_takeover() {
  local pids pid old="" foreign="" supervisors="" i ancestors hard_killed=0

  ancestors=" $(dev_ancestors) "

  pids="$(dev_port_pids)"
  for pid in $pids; do
    case "$ancestors" in
      *" $pid "*) continue ;;
    esac
    # ⚠️ 先看进程**还活着吗**：ss 报出来的 PID 可能已经死透了（socket 正在释放）。
    #    这种不算「别的程序占着端口」——它马上就空了，误判会让接管直接失败退出。
    dev_pid_alive "$pid" || continue
    if dev_is_project_server "$pid"; then
      old="$old $pid"
    else
      foreign="$foreign $pid"
    fi
  done

  if [ -n "$foreign" ]; then
    echo "[dev] 端口 ${DEV_PORT} 被别的程序占着（PID:${foreign}），不是本项目的服务器。"
    echo "     把它停掉再来：kill ${foreign}"
    return 1
  fi

  # 先停守护实例：它会守着旧实例，等下又把它拉起来（还会跟新实例抢端口）
  supervisors="$(dev_supervisor_pids)"
  for pid in $supervisors; do
    echo "[dev] 停掉旧的守护实例（PID:$pid）"
    kill -TERM "$pid" 2>/dev/null || true
  done
  # 等守护实例退干净（最多 3 秒）：别死等固定秒数
  for i in $(seq 1 6); do
    [ -z "$(dev_supervisor_pids)" ] && break
    sleep 0.5
  done
  # ⚠️ 还没退干净就**硬杀**：守护实例的崩溃重拉逻辑会在 next dev 意外退出时
  #    再起一个 next dev —— 它要是活下来，就会跟我们抢 3000，新实例起不来。
  #    这就是「看着像起不来」的真凶之一，不能省这一步。
  for pid in $supervisors; do
    if dev_pid_alive "$pid"; then
      echo "[dev] 硬杀不肯退出的守护实例（PID:$pid）"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  # TERM 旧实例，然后**轮询**等端口空出来（最多 10 秒），不再死等 2+1 秒
  for pid in $old; do
    echo "[dev] 停掉占用 ${DEV_PORT} 的旧实例（PID:$pid）"
    kill -TERM "$pid" 2>/dev/null || true
  done
  for i in $(seq 1 20); do
    [ -z "$(dev_port_pids)" ] && break
    sleep 0.5
  done
  # 还没退干净 → 硬杀，并且这次的缓存不可信
  for pid in $old; do
    if dev_pid_alive "$pid"; then
      kill -KILL "$pid" 2>/dev/null || true
      hard_killed=1
    fi
  done
  # 再等端口空出来
  for i in $(seq 1 20); do
    [ -z "$(dev_port_pids)" ] && break
    sleep 0.5
  done
  if [ -n "$(dev_port_pids)" ]; then
    echo "[dev] 端口 ${DEV_PORT} 仍被占用，接管失败。"
    return 1
  fi

  # 清掉死进程留下的锁：否则 Next 会以为「还有一个 server 在跑」
  local lock="$DEV_ROOT/.next/dev/lock" lockpid
  if [ -f "$lock" ]; then
    lockpid="$(sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$lock" 2>/dev/null || true)"
    if [ -n "$lockpid" ] && ! kill -0 "$lockpid" 2>/dev/null; then
      rm -f "$lock"
    fi
  fi

  # Turbopack 的持久缓存：只有「不干净」的时候才清（见上面的说明）
  if [ "$hard_killed" -eq 1 ] || [ "${DEV_WIPE_CACHE:-0}" = "1" ]; then
    rm -rf "$DEV_ROOT/.next/dev/cache"
    echo "[dev] 已清 Turbopack 缓存（旧实例异常退出，缓存可能是半成品）"
  elif [ -n "$old" ]; then
    echo "[dev] 旧实例正常退出，保留 Turbopack 缓存（首屏省下几秒重编译）"
  fi
  return 0
}

# 预热：next dev 起来之后，在后台悄悄把 Payload 与数据库连接初始化掉，
# 顺带把公众站首页也提前编译好。
#
# 为什么（2026-11-02 实测）：Payload 第一次被用到时要初始化
# （连 Postgres、加载 17 个集合、建索引），实测约 3 秒，
# 而这 3 秒**算在第一个访问的页面头上**——用户点开首页就得多等 3 秒。
# 提前在后台打一发 /api/health（只 `select 1`，不写库、不发邮件、无副作用），
# 这 3 秒就挪到了后台；再打一发公众站首页，把那条路由也提前编译好。
# 用户真正打开页面时通常已经热好了。
#
# ⚠️ 必须带 CMS 域的 Host 头：/api/health 只在工作台域 / CMS 域放行，
#    公众域访问它是 404（见 src/proxy.ts 的 isPublicApi）。
dev_warmup() {
  local cms i
  cms="${CMS_HOST:-admin.localhost}"
  cms="${cms%%,*}"
  # ① 先初始化 Payload（只 select 1，不写库、无副作用）
  for i in $(seq 1 60); do
    sleep 0.5
    curl -fsS --max-time 15 -o /dev/null \
      -H "Host: ${cms}:${DEV_PORT}" "http://127.0.0.1:${DEV_PORT}/api/health" 2>/dev/null && break
  done
  # ② 再把公众站首页提前编译好（最常打开的那条路由）
  for i in $(seq 1 60); do
    sleep 0.5
    curl -fsS --max-time 30 -o /dev/null \
      -H "Host: localhost:${DEV_PORT}" "http://127.0.0.1:${DEV_PORT}/" 2>/dev/null && return 0
  done
  return 1
}

# 启动时打印访问地址（含 WSL IP 备用地址）。
# ⚠️ WSL 的 localhost 端口转发是 Windows 那边的服务，偶尔会失效：
#   WSL 里 curl 127.0.0.1:3000 正常、Windows 浏览器却「无法访问」——
#   这时用下面的 IP 地址先进去，或在 Windows 执行 `wsl --shutdown` 后重新启动本脚本。
dev_print_urls() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo ""
  echo "[dev] 公众站    http://localhost:${DEV_PORT}"
  echo "[dev] 工作台    http://connect.localhost:${DEV_PORT}"
  echo "[dev] CMS 后台  http://admin.localhost:${DEV_PORT}"
  if [ -n "$ip" ]; then
    echo "[dev] Windows 打不开 localhost 时用：http://${ip}:${DEV_PORT}"
    echo "      （WSL 端口转发失效；恢复：在 Windows 执行 wsl --shutdown，再重新启动本脚本）"
  fi
  echo ""
}
