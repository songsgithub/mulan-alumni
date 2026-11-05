#!/usr/bin/env bash
# 开发服务器（npm run dev）——**唯一的**开发入口。
#
# 做三件事：
#   1. 接管端口 3000：端口上已经有**本项目**的旧实例就停掉它（见 scripts/dev-common.sh），
#      不会再出现 EADDRINUSE / "Another next dev server is already running"；
#   2. 跑 next dev；
#   3. 崩了自动拉起：重启前清掉 Turbopack 的过期持久缓存，避免「热更新失效 /
#      module factory is not available」。
#
# ⚠️ 为什么只留这一个入口（2026-11-01）：
#   原来有 scripts/dev-run.sh（一次性）与 scripts/dev-watch.sh（守护）两套入口，
#   两边的「接管」逻辑各写了一份。守护版那份判定端口占用时，只看进程名，
#   崩掉后残留的 next-server 子进程会被误判成「别的程序占着端口」，
#   于是报「端口 3000 被别的程序占着（PID: xxx）」并放弃接管——正是当初
#   「每次都启动不起」的那类毛病。现在只有一份接管逻辑，放在 dev-common.sh。
set -u

cd "$(dirname "$0")/.."
export PATH="$PWD/node_modules/.bin:$PATH"
# Next dev 有个「内存接近阈值就自动重启」的保护，堆给到 4GB 重启频率明显下降
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"

# shellcheck source=scripts/dev-common.sh
source "$PWD/scripts/dev-common.sh"

dev_takeover || exit 1
dev_print_urls

# 接管要花两三秒（停旧实例 + 等端口空出来），先把话说清楚，
# 别让人对着黑屏以为卡住了。
echo "[dev] 启动中（首屏要编译，第一次打开页面会等几秒）…"
echo ""

# next dev 放到后台跑并显式 wait：这样脚本本身还活着，崩了才能拉起来
# （exec 会把脚本替换掉，没法再拉起）。
running=1
child=""

stop_child() {
  [ -n "$child" ] || return 0
  kill -TERM "$child" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
  child=""
}

# Ctrl+C / kill：把 next dev 一起带走，别留个孤儿占着 3000
trap 'running=0; stop_child' INT TERM

while [ "$running" -eq 1 ]; do
  next dev -H 0.0.0.0 -p 3000 "$@" &
  child=$!
  # 后台预热：把 Payload 初始化（约 3 秒）与首页编译挪出用户第一次打开页面的关键路径。
  # ⚠️ 下面日志里那条 GET /api/health 和 GET / 是**预热请求**，不是你的访问。
  echo "[dev] 后台预热中（初始化数据库连接 + 编译首页，约 3～5 秒，不影响你打开页面）…"
  dev_warmup &
  wait "$child"
  status=$?
  child=""

  # 被信号停掉的（Ctrl+C / kill）：正常收工，不再拉起
  [ "$running" -eq 1 ] || break
  # 干净退出（状态 0）：也视为「用户不想跑了」
  [ "$status" -eq 0 ] && break

  echo ""
  echo "[dev] next dev 意外退出（状态 $status），3 秒后重新拉起…"
  sleep 3
  # ⚠️ 这 3 秒里可能收到了 TERM（用户 Ctrl+C，或被另一个实例接管了）：
  #    这时**绝对不能**再去接管端口——那会把刚起来的新实例又杀掉，
  #    两边互踩，最后谁都起不来。收到停止信号就老实收工。
  [ "$running" -eq 1 ] || break
  # 重启前再接管一次：崩掉时 next dev 的 next-server 子进程可能还占着 3000，
  # 同时把 Turbopack 的过期持久缓存清掉（热更新失效的根因，见 dev-common.sh）。
  #
  # ⚠️ 这里是**崩溃**后的重拉：旧进程是异常退出的，缓存可能是半成品，
  #    所以显式要求清缓存（DEV_WIPE_CACHE=1）。
  #    正常重启（重新执行 npm run dev）时不清——见 dev-common.sh 里的说明。
  #
  # ⚠️ 接管失败**不要直接退出**：崩掉重拉时端口可能还没被系统释放干净，
  #    这时硬退出就等于「服务彻底起不来」。多试几轮，让守护实例扛过去。
  for attempt in 1 2 3 4 5; do
    [ "$running" -eq 1 ] || break
    if DEV_WIPE_CACHE=1 dev_takeover; then
      break
    fi
    if [ "$attempt" -eq 5 ]; then
      echo "[dev] 连续 5 次接管失败，放弃守护，退出。"
      exit 1
    fi
    echo "[dev] 接管失败，5 秒后再试（第 $attempt 次）…"
    sleep 5
  done
done
