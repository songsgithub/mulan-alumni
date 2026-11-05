#!/usr/bin/env bash
# 安全边界冒烟（只读为主；写入类请求都应被拒，不会真的落库）。需要 dev 服务器在 3000 端口。
# 用法：bash scripts/verify-security.sh
set -u
W='connect.localhost:3000'
P='localhost:3000'
C='admin.localhost:3000'
BASE='http://127.0.0.1:3000'
pass=0; fail=0
check() { # 名称 期望 实际
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ✅ $1"; else fail=$((fail+1)); echo "  ❌ $1 — 期望 $2，实际 $3"; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jar=$(mktemp)
curl -s -c "$jar" -H "Host: $W" -H 'Content-Type: application/json' \
  -d '{"email":"lead@mulan.org","password":"Mulan@2026"}' "$BASE/api/users/login" >/dev/null

echo '▌REST 写入一律只给后台账号'
check '团长 PATCH 活动申请（自批）被拒' 403 "$(code -b "$jar" -X PATCH -H "Host: $W" -H 'Content-Type: application/json' -d '{"status":"approved"}' "$BASE/api/activity-plans/1")"
check '团长 PATCH 报销金额被拒' 403 "$(code -b "$jar" -X PATCH -H "Host: $W" -H 'Content-Type: application/json' -d '{"approvedAmount":99999}' "$BASE/api/reimbursements/1")"
check '团长 POST 付款记录被拒' 403 "$(code -b "$jar" -X POST -H "Host: $W" -H 'Content-Type: application/json' -d '{}' "$BASE/api/payments")"
check '团长改活动设置（全局）被拒' 403 "$(code -b "$jar" -X POST -H "Host: $W" -H 'Content-Type: application/json' -d '{"budgetMax":99999}' "$BASE/api/globals/activity-settings")"
check '团长 POST 媒体被拒' 403 "$(code -b "$jar" -X POST -H "Host: $W" -F 'file=@/etc/hostname' "$BASE/api/media")"

echo '▌读取边界'
check '团长读不到别人的账号' 404 "$(code -b "$jar" -H "Host: $W" "$BASE/api/users/1")"
check '密码重置记录不可读' 403 "$(code -b "$jar" -H "Host: $W" "$BASE/api/password-resets")"
check '未登录不能列媒体库' 401 "$(code -H "Host: $W" "$BASE/api/media")"
check '未登录读不到财务凭证' 403 "$(code -H "Host: $W" "$BASE/api/finance-evidence")"

echo '▌跨站与旁路'
check '跨站写 /api（Origin 不同域）被拒' 403 "$(code -b "$jar" -X POST -H "Host: $W" -H "Origin: http://$P" "$BASE/api/media")"
check 'Payload 自带找回密码接口关闭' 404 "$(code -X POST -H "Host: $W" "$BASE/api/users/forgot-password")"
check 'CMS 首个账号注册接口关闭' 404 "$(code -X POST -H "Host: $C" "$BASE/api/ops-users/first-register")"
check '公众域不认 Server Action' 404 "$(code -X POST -H "Host: $P" -H 'Next-Action: x' "$BASE/")"
check '公众域没有集合接口' 404 "$(code -H "Host: $P" "$BASE/api/activity-plans")"
check '工作台域不开 GraphQL' 404 "$(code -X POST -H "Host: $W" "$BASE/api/graphql")"

echo '▌内部路径与限流'
check '工作台内部路径 /home 不对外' 404 "$(code -H "Host: $W" "$BASE/home")"
check '公开站内部路径 /site-activities 不对外' 404 "$(code -H "Host: $P" "$BASE/site-activities")"
hit=0; for i in $(seq 1 7); do s=$(code -X POST -H "Host: $P" -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.0.0.$i, 192.0.2.7" -d '{}' "$BASE/api/contact"); [ "$s" = 429 ] && hit=1; done
# 模拟 Nginx（proxy_add_x_forwarded_for）：客户端自己填的在前、代理写的真实 IP 在最后
check '伪造 X-Forwarded-For 绕不过联系表单限流' 1 "$hit"

echo '▌响应头'
h=$(curl -s -D - -o /dev/null -H "Host: $P" "$BASE/")
check 'X-Frame-Options' 1 "$(echo "$h" | grep -ci '^x-frame-options: SAMEORIGIN')"
check 'nosniff' 1 "$(echo "$h" | grep -ci '^x-content-type-options: nosniff')"
check '不暴露 X-Powered-By' 0 "$(echo "$h" | grep -ci '^x-powered-by')"
rm -f "$jar"
echo; echo "通过 $pass · 失败 $fail"
[ "$fail" = 0 ]
