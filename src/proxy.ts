import { NextResponse, type NextRequest } from 'next/server'

import { cmsHosts, hostnameOf, isCmsHost, isWorkspaceHost, workspaceHosts } from '@/lib/host'
import { clientIp, hit, type RateRule } from '@/lib/rate-limit'

/**
 * 接口限流（按 IP）：登录、邀请注册、邀请链接查询、联系表单。
 * 账号层还有 Payload 的连错锁定；这里挡的是换着账号撞库与刷接口。
 */
const RATE_RULES: { match: (method: string, pathname: string) => boolean; rule: RateRule }[] = [
  {
    match: (m, p) => m === 'POST' && (p === '/api/users/login' || p === '/api/ops-users/login'),
    rule: { name: 'login', limit: 30, windowMs: 5 * 60_000 },
  },
  { match: (m, p) => m === 'POST' && p === '/api/join', rule: { name: 'join', limit: 10, windowMs: 10 * 60_000 } },
  {
    // ⚠️ 2026-11-05：`GET /api/invitation-links/[token]` 已删（注册页改成服务端直接查库，
    // 没人调它了），这里只剩「打开注册页」这一条要限流。
    match: (m, p) => m === 'GET' && p === '/join',
    rule: { name: 'invite', limit: 60, windowMs: 10 * 60_000 },
  },
  { match: (m, p) => m === 'POST' && p === '/api/contact', rule: { name: 'contact', limit: 5, windowMs: 10 * 60_000 } },
]

const tooMany = (retryAfter: number) =>
  NextResponse.json(
    { message: '操作太频繁，请稍后再试' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )

/** 公众域能用的接口：只有媒体文件（图片 / 附件下载）与联系表单 */
const isPublicApi = (pathname: string) =>
  pathname.startsWith('/api/media/file/') || pathname === '/api/contact'

/** 只属于 CMS 域的接口：后台账号登录与 GraphQL */
const isCmsOnlyApi = (pathname: string) =>
  pathname === '/api/ops-users' ||
  pathname.startsWith('/api/ops-users/') ||
  pathname === '/api/graphql' ||
  pathname.startsWith('/api/graphql-playground')

/**
 * Payload 自带、但本系统**不用**的账号接口（自助找回密码 / 首个账号注册 / 邮箱验证 / 解锁）：
 * 重置密码只走项目组发的一次性链接（/reset-password），账号只能凭邀请链接注册。
 * 留着就是没有限流、没有业务校验的旁路，一律 404。
 * 运维的首个后台账号由种子脚本建；确需在后台页面建首个账号时，临时设 CMS_ALLOW_FIRST_USER=1。
 */
const isUnusedAuthApi = (pathname: string) =>
  /^\/api\/(users|ops-users)\/(forgot-password|reset-password|verify|unlock)(\/|$)/.test(pathname) ||
  /^\/api\/users\/first-register(\/|$)/.test(pathname) ||
  (process.env.CMS_ALLOW_FIRST_USER !== '1' &&
    (/^\/api\/ops-users\/first-register(\/|$)/.test(pathname) || pathname === '/admin/create-first-user'))

/**
 * 网址里的**内部真实路径**（地址栏只认对外的那一个）：
 * 工作台 `/` ← /home、`/circles` ← /network、`/resources` ← /assets；公开站 `/activities` ← /site-activities。
 * 直接访问内部路径一律 404，同一个页面只有一个地址（术语表见 docs/设计规范.md §7.4）。
 */
const isInternalPath = (pathname: string) =>
  /^\/(home|network|assets|site-activities)(\/|$)/.test(pathname)

/** 只属于公开站的页面：在工作台域不提供（否则工作台域下会长出一份带公开站页头的副本） */
const isPublicSitePath = (pathname: string) =>
  /^\/(about|contact)(\/|$)/.test(pathname) || pathname.startsWith('/resources/')

/** 写操作（非 GET/HEAD/OPTIONS） */
const isWrite = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method)

/**
 * 跨站写接口挡板：带 Origin 头的写请求，Origin 必须就是本站这个域名。
 * 三个域在同一个站点下（www / connect / admin），SameSite=Lax 的登录 cookie 会被带上，
 * 所以公众域的页面也能向工作台域的 /api 发写请求——这里按"同源"拦下。
 * 没有 Origin 头的（服务端调用、老浏览器的同源导航）放行，交给集合访问控制。
 */
const crossOriginWrite = (request: NextRequest, hostname: string) => {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).hostname !== hostname
  } catch {
    return true
  }
}

/** 未登录时不许列媒体库（未发布的活动照片也在里面）；单个文件仍可按地址访问 */
const isMediaListing = (method: string, pathname: string) =>
  method === 'GET' && (pathname === '/api/media' || /^\/api\/media\/\d+$/.test(pathname))

/**
 * 域名分流（三域，见 docs/设计规范.md §7.1）。
 *
 * - 公众域：展示站。**任意路径都不得出现登录入口**，后台路径一律 404。
 * - 工作台域（WORKSPACE_HOST）：业务工作台 + 登录 / 邀请注册。
 *   核心成员、团长、项目组在这里按角色分层操作。
 * - CMS 域（CMS_HOST）：Payload CMS 后台，只给运维账号（见 payload.config.ts 的 admin.user）。
 *
 * 规则只有三条，按域分工，**不维护路径清单、不做旧路径兼容**——
 * 系统尚未上线，旧路径一律当不存在处理（AGENTS.md 硬约束）。
 *
 * Next.js 16 的官方约定是 `src/proxy.ts`（不再是 `middleware.ts`）。
 */

/** Payload CMS 后台与其接口 */
const isCmsPath = (pathname: string) =>
  pathname === '/admin' ||
  pathname.startsWith('/admin/') ||
  pathname === '/api' ||
  pathname.startsWith('/api/')


/**
 * 跨域跳转时挑目标主机：优先同后缀（connect.mulan.org → admin.mulan.org），
 * 挑不到就用列表里的第一个。
 */
const pickHost = (from: string, candidates: string[]): string => {
  const suffix = from.split('.').slice(-2).join('.')
  const sameSuffix = candidates.find((host) => host.endsWith(suffix))
  return sameSuffix ?? candidates[0]
}

/** 换个主机、保持端口与路径 */
const toHost = (request: NextRequest, host: string, pathname: string) => {
  const url = request.nextUrl.clone()
  url.hostname = host
  url.pathname = pathname
  return url
}

/**
 * 404 用中文页面：状态码仍是 404，正文重写到 `/404` 路由
 * （见 docs/设计规范.md §7.2.1）。
 */
const notFound = (request: NextRequest) =>
  NextResponse.rewrite(new URL('/404', request.url), { status: 404 })

export function proxy(request: NextRequest) {
  const hostname = hostnameOf(request.headers.get('host'))
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  for (const { match, rule } of RATE_RULES) {
    if (!match(method, pathname)) continue
    const result = hit(clientIp(request.headers), rule)
    if (!result.ok) return tooMany(result.retryAfter)
  }

  // 内部真实路径不对外（任何域），本系统不用的 Payload 账号接口不对外
  if (isInternalPath(pathname) || isUnusedAuthApi(pathname)) return notFound(request)
  // 跨站写 /api：Origin 不是本域名就拒
  if (isWrite(method) && pathname.startsWith('/api/') && crossOriginWrite(request, hostname)) {
    return NextResponse.json({ message: '不允许跨站请求' }, { status: 403 })
  }

  if (!isCmsHost(hostname)) {
    // 后台账号与 GraphQL 只在 CMS 域
    if (isCmsOnlyApi(pathname)) return notFound(request)
    // 未登录不能列媒体库
    if (isMediaListing(method, pathname) && !request.cookies.has('payload-token')) {
      return NextResponse.json({ message: '请先登录' }, { status: 401 })
    }
  }

  /* ------------------------------------------------ CMS 域：Payload 后台 */
  if (isCmsHost(hostname)) {
    if (pathname === '/') {
      return NextResponse.redirect(toHost(request, hostname, '/admin'))
    }
    // 后台只服务 /admin 与它的接口，其余路径在这里不存在
    if (isCmsPath(pathname)) return NextResponse.next()
    return notFound(request)
  }

  /* --------------------------------------------- 工作台域：业务操作入口 */
  if (isWorkspaceHost(hostname)) {
    // 根路径 → 工作台首页（内部真实路径 /home，URL 保持 /）
    if (pathname === '/') {
      const target = new URL('/home', request.url)
      // 查询参数要一起带走（/?year=2026&category=… 是统计筛选条件，丢了筛选就没了）
      target.search = request.nextUrl.search
      return NextResponse.rewrite(target)
    }
    // 互助团网络 → 内部真实路径 /network（URL 保持 /circles）。
    // 公众站本来就有 /circles（互助团版图），同一个路径不能有两个页面，
    // 所以工作台这边用内部路径 + rewrite，浏览器里的地址仍是 /circles。
    if (pathname === '/circles' || pathname.startsWith('/circles/')) {
      const target = new URL(`/network${pathname.slice('/circles'.length)}`, request.url)
      // 查询参数要一起带走（?category=… 是筛选条件，丢了筛选就没了）
      target.search = request.nextUrl.search
      return NextResponse.rewrite(target)
    }
    // 资源 → 内部真实路径 /assets（公开站的 /resources 是另一个页面，同一路径不能有两个页面）
    if (pathname === '/resources') {
      const target = new URL('/assets', request.url)
      target.search = request.nextUrl.search
      return NextResponse.rewrite(target)
    }
    // 工作台没有公开站的页面（成果流、关于、联系……）：只有业务页面与登录注册
    if (isPublicSitePath(pathname)) return notFound(request)
    // CMS 后台在别的域：在工作台域点它要跳过去
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const target = pickHost(hostname, cmsHosts())
      return NextResponse.redirect(toHost(request, target, pathname))
    }
    return NextResponse.next()
  }

  /* -------------------------------------------------- 公众域：只有展示站 */
  // 公众域没有 Server Action（联系表单走 /api/contact）：带 Next-Action 头的请求一律不认
  if (method === 'POST' && request.headers.has('next-action')) return notFound(request)
  // 活动 → 内部真实路径 /site-activities（工作台的 /activities/<标识> 是活动详情，同一路径不能有两个页面）
  if (pathname === '/activities' || pathname.startsWith('/activities/')) {
    const target = new URL(`/site-activities${pathname.slice('/activities'.length)}`, request.url)
    target.search = request.nextUrl.search
    return NextResponse.rewrite(target)
  }
  // 公众域没有后台
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return notFound(request)
  }
  // 公众域：没有登录 / 注册 / 登出这件事（铁律，见 docs/设计规范.md §0.1）；也没有工作台页面
  if (
    ['/login', '/join', '/logout', '/reset-password'].includes(pathname) ||
    /^\/(budget|settings|account|notifications)(\/|$)/.test(pathname)
  ) {
    return notFound(request)
  }
  // 公众域只开放媒体文件与联系表单；其余接口（集合 REST、登录、注册、下载包）都在工作台域
  if ((pathname === '/api' || pathname.startsWith('/api/')) && !isPublicApi(pathname)) {
    return notFound(request)
  }
  return NextResponse.next()
}

export default proxy

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
