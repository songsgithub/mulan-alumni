import React from 'react'
import { chromium, type Browser } from 'playwright'

import { ActivityHtml, docCss } from '@/components/pdf/ActivityHtml'
import { buildActivityPdfData, type PdfMode } from '@/lib/activity-pdf-data'
import { currentUser, isProjectTeam } from '@/lib/auth'
import { ownCohortWhere } from '@/lib/console-data'
import { getClient } from '@/lib/payload'
import { hit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 同时在打印的份数上限（每份一个 Chromium 页，内存大户） */
const MAX_CONCURRENT = 3
/** 纯文字的错误响应：中文要声明 UTF-8，否则浏览器直开会乱码 */
const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' }
let printing = 0

/**
 * 复用同一个 Chromium + context：
 * 浏览器只拉一次，字体也只在第一次下载（context 级缓存），后续打印不再重复取。
 */
let contextPromise: Promise<{ browser: Browser; newPage: () => Promise<any> }> | null = null
const getPrintContext = async () => {
  if (!contextPromise) {
    contextPromise = (async () => {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--font-render-hinting=none'],
      })
      const context = await browser.newContext()
      return { browser, newPage: () => context.newPage() }
    })().catch((error) => {
      contextPromise = null
      throw error
    })
  }
  return contextPromise
}

/**
 * 活动材料 PDF（按需生成，不落盘）。
 *
 * 用 Chromium 打印「排版好的 HTML」：中文断行、页码、跨页表头都由浏览器原生处理。
 * 团长只能生成本团活动；项目组不限。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  // 打印模式（2026-11-01 第三十六轮）：?mode=final 出「报销存档版」，
  // 不带参数（或 full）出「完整记录」——带版本变更的全过程。
  const mode: PdfMode = new URL(request.url).searchParams.get('mode') === 'final' ? 'final' : 'full'
  const user = await currentUser()
  if (!user) return new Response('请先登录', { status: 401, headers: TEXT })
  // 每次打印都要开一个 Chromium 页：按账号限流，并限制同时在打的份数
  if (!hit(`user:${user.id}`, { name: 'pdf', limit: 20, windowMs: 10 * 60_000 }).ok) {
    return new Response('打印太频繁，请稍后再试', { status: 429, headers: TEXT })
  }
  if (printing >= MAX_CONCURRENT) {
    return new Response('打印排队中，请稍后再试', { status: 503, headers: { ...TEXT, 'Retry-After': '5' } })
  }

  const payload = await getClient()
  const ownWhere = await ownCohortWhere(user)

  let plan: any = null
  try {
    const found = await payload.find({
      collection: 'activity-plans',
      where: { and: [{ slug: { equals: slug } }, ownWhere] },
      limit: 1,
      depth: 2,
      user: user as any,
      overrideAccess: false,
    })
    plan = (found.docs ?? [])[0] ?? null
  } catch {
    plan = null
  }
  if (!plan) return new Response('活动不存在', { status: 404, headers: TEXT })
  // 团长还没提交的草稿，项目组看不到（与活动详情页同一口径）
  if (isProjectTeam(user) && plan.status === 'draft') return new Response('活动不存在', { status: 404, headers: TEXT })

  const readOne = async (collection: string, where: any) => {
    try {
      const res = await payload.find({
        collection: collection as any,
        where,
        limit: 1,
        depth: 2,
        user: user as any,
        overrideAccess: false,
      })
      return (res.docs ?? [])[0] ?? null
    } catch {
      return null
    }
  }

  const report: any = await readOne('activity-reports', { plan: { equals: plan.id } })
  const reimbursement: any = await readOne('reimbursements', { plan: { equals: plan.id } })
  const data = await buildActivityPdfData(plan, report, reimbursement, mode)

  // 字体等静态资源从**配置的**站点地址取，不用请求的 Host（Host 能被伪造成外部地址）
  void request
  const baseUrl = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')
  // 动态引入：Next 不允许在路由模块顶层 import react-dom/server
  const { renderToStaticMarkup } = await import('react-dom/server')
  const body = renderToStaticMarkup(React.createElement(ActivityHtml, { data }))
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><style>${docCss(
    baseUrl,
  )}</style></head><body>${body}</body></html>`

  printing += 1
  let page: any = null
  try {
    const { newPage } = await getPrintContext()
    page = await newPage()
    // 只放行本站资源（字体）与内联数据（图片已内联成 data:），其余请求一律掐掉
    const allowedOrigin = new URL(baseUrl).origin
    await page.route('**/*', (route: any) => {
      const url = route.request().url()
      if (url.startsWith('data:') || url.startsWith('about:') || url.startsWith(allowedOrigin)) return route.continue()
      return route.abort()
    })
    /**
     * 字体要单独带 CORS 头（2026-11-02 第三十八轮修）：
     *
     * 页面是用 `page.setContent()` 灌进去的，源是 `about:blank`（opaque origin），
     * 从这里发起的 @font-face 请求属于**跨源**，Chromium 会按 CORS 规则拦掉，
     * 报 `net::ERR_FAILED`，字体静默不生效——中文会掉进兜底字体，
     * 在 PDF 里落成 **Type3 位图字体**（不能复制、放大发虚、跨页也乱）。
     *
     * 所以这里把字体请求拦下来，带上 `Access-Control-Allow-Origin: *` 回给浏览器。
     * 字体二进制直接从服务端读，不额外走一遍网络。
     */
    await page.route('**/fonts/*', async (route: any) => {
      const url = route.request().url()
      if (!url.startsWith(allowedOrigin)) return route.abort()
      try {
        const res = await fetch(url)
        if (!res.ok) return route.abort()
        const body = await res.arrayBuffer()
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': res.headers.get('content-type') || 'font/otf',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          body: Buffer.from(body),
        })
      } catch {
        await route.abort()
      }
    })
    await page.setContent(html, { waitUntil: 'load' })
    // 等中文字体与图片就绪，避免第一页缺字、图片量不到高度
    await page.evaluate(() => document.fonts.ready)
    /**
     * 显式确认公文字体真的加载了（2026-11-02 第三十八轮加）。
     *
     * 字体加载失败时 Chromium **不会报错**，只是静默换用兜底字体，
     * 中文在 PDF 里落成 Type3 位图字体——肉眼看得出，但排查极难。
     *
     * ⚠️ 判据只能用「字体是否已注册并 loaded」。
     * 不能靠「字宽与兜底字体是否相同」判断：中文汉字在多数字体里**都是等宽的**
     * （16pt 下每字都是 21.33px），量出来的宽度必然一样，比不出任何东西——
     * 这个坑我踩过一次，判据一度把好字体误报成没生效。
     * 真正的判据是「PDF 里嵌进去的是不是真字体」，那个由 scripts/verify-gongwen.py 在 PDF 上验。
     * 这里只做前置闸门：字体压根没加载就别往下走。
     */
    const fontsRegistered = await page.evaluate(`(() => {
      const families = ["NotoSerifSC"]
      const registered = families.filter((family) =>
        Array.from(document.fonts).some((f) => f.family === family && f.status === "loaded"),
      )
      return { registered, all: Array.from(document.fonts).map((f) => f.family + "=" + f.status) }
    })()`)
    if (fontsRegistered.registered.length < 1) {
      throw new Error(
        `中文字体未加载（已加载 ${fontsRegistered.registered.join(', ') || '无'}）；` +
          `字体状态：${fontsRegistered.all.join(', ')}`,
      )
    }
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.onload = () => resolve()
                image.onerror = () => resolve()
              }),
        ),
      )
    })

    /**
     * 图片排版（2026-11-02 第四十轮重写）。
     *
     * 用户要求（原文）：
     *   「我既要一页A4页面都是两份等高度图片（如果其他有一张图片或者两张都是
     *     低于等高设置的量，则另一张就不用强制设置了，只有两张高度加起来能
     *     在一页容纳下来即可），也要都是宽屏的图片」
     *   「不管你怎么办，不可以裁减不见一部分，可以压缩高度变形」
     *
     * 规则（现在的）：
     *   ① **满宽**：所有图片宽 = 版心宽 176mm（用户要「都是宽屏的图片」），
     *      不再是「按比例缩到槽位里、宽只有 147~162mm」；
     *   ② **等高**：同一份材料里的图片统一用**同一个高度**，
     *      所以同一页上的两张图一定是等高的（用户要「两份等高度图片」）；
     *   ③ **不裁剪**：图片内容一点不少（`object-fit: fill`，整张铺满设定的框）；
     *   ④ **只压扁、不拉长**：高度 = min(槽位上限, 该份材料里最矮那张图的自然高)。
     *      自然高 = 176mm × (图高 / 图宽)（满宽时的自然高度）。
     *      取 min 的意思是：**只往下压，不往上拉**——
     *      宽幅图（16:9）在满宽时本来就矮，让它保持自然高度，
     *      别的图压到和它一样高；这样谁都不会被拉长变形。
     *   ⑤ **例外（用户明说）**：如果这一份材料里**所有**图的自然高都低于
     *      「等高设置」（槽位上限），就不强求等高——各图保持自己的自然高度，
     *      只要两张加起来装得进一页即可。
     *
     * ⚠️ 为什么可以「压扁」：用户明确授权了——
     *    「不可以裁减不见一部分，可以压缩高度变形」。
     *    满宽 + 两张 + 等高 + 不裁剪，四者同时成立，
     *    唯一可行的实现就是**按宽满铺、按高统一压**（object-fit: fill）。
     *
     * ⚠️ 槽位上限 118mm 的来历：
     *    版心高 267mm ÷ 2 = 133.5mm 一个槽位，扣掉图注（8.5mm）与
     *    figure 间距（2.2mm）= 122.8mm；再留 4.8mm 余量给 Chromium 取整，
     *    否则两张图加起来会差一点点装不下、第二张被挤到下一页。
     *    实测 118mm × 2 + 2 × 10.7mm = 257.2mm ≤ 267mm ✓
     *
     * ⚠️ 版心宽**必须用常量**，不能用容器的实测宽度：
     *    此刻 .photos 容器还没被版心约束，它的宽度是**被图片撑开**的
     *    （实测 289mm > 版心 176mm），照着它算就会把图算得过大、
     *    一张图超过一页高，于是标题与图被拆到两页。
     */
    const imageLayout = await page.evaluate(`(() => {
      // 版心尺寸（mm）：A4 210×297，上下白边各 15 → 版心高 267；左右各 17 → 版心宽 176
      const PAGE_W_MM = 176
      const PAGE_H_MM = 267
      const MM_PER_PX = 25.4 / 96

      // 「等高设置」：单图高度上限。一页两张，两张（含图注与间距）
      // 必须 ≤ 版心高 267mm，否则第二张会被挤到下一页。
      const SLOT_H_MM = 118

      /**
       * 排一段图（照片区 .photos / 票据区 .receipts）。
       * 同一段里的图共用一个高度 → 同一页上的两张必然等高。
       */
      const layoutSection = (selector) => {
        const figures = Array.from(document.querySelectorAll(selector + " figure"))
        const items = []
        for (const fig of figures) {
          const img = fig.querySelector("img")
          if (!img) continue
          const natW = img.naturalWidth
          const natH = img.naturalHeight
          if (!natW || !natH) continue
          items.push({ fig, img, natHMm: (PAGE_W_MM * natH) / natW })
        }
        if (!items.length) return { adjusted: 0, sizes: [], equalHeight: true }

        const minNat = Math.min.apply(null, items.map((it) => it.natHMm))
        const allBelowSlot = items.every((it) => it.natHMm <= SLOT_H_MM)

        // ⑤ 例外：全都低于等高设置 → 不强求等高，各图保持自然高度
        //   （用户：「两张都是低于等高设置的量，则另一张就不用强制设置了」）
        // ④ 否则：统一等高 = min(槽位上限, 最矮那张的自然高) —— 只压扁、不拉长
        const heights = allBelowSlot
          ? items.map((it) => it.natHMm)
          : items.map(() => Math.min(SLOT_H_MM, minNat))

        const sizes = []
        items.forEach((it, index) => {
          const w = PAGE_W_MM
          const h = heights[index]
          it.img.style.width = (w / MM_PER_PX) + "px"
          it.img.style.height = (h / MM_PER_PX) + "px"
          it.img.style.maxWidth = "none"
          // fill = 整张铺满设定的框（压扁变形），**不裁剪、不留白**
          it.img.style.objectFit = "fill"
          sizes.push({
            w: Math.round(w * 10) / 10,
            h: Math.round(h * 10) / 10,
          })
        })
        return { adjusted: items.length, sizes, equalHeight: !allBelowSlot, allBelowSlot }
      }

      const photos = layoutSection(".photos")
      const receipts = layoutSection(".receipts")
      return { photos, receipts }
    })()`)

    /**
     * 照片标题绑定（2026-11-02 第三十八轮之二）。
     *
     * 满宽照片（176mm 宽 → 约 132mm 高）一页只放得下一张，
     * 于是「照片区标题」很容易与第一张图**分到两页**：
     * 标题留在页尾、整张图跳到下一页 → 标题独占一页、下面全空。
     *
     * ⚠️ 纯 CSS 的 break-after:avoid 在这里**不可靠**——
     *    满宽大图 + 标题的组合超出 Chromium 的避头尾处理能力。
     *    所以用 JS 把标题和第一张 figure 包进同一个容器，
     *    再给容器 break-inside:avoid：整组要么同页，要么整组下移。
     */
    const photosHeadProbe = await page.evaluate(`(() => {
      const container = document.querySelector(".photos")
      if (!container) return
      const title = container.querySelector(".photos-title")
      const firstFigure = container.querySelector("figure")
      if (!title || !firstFigure) return

      const head = document.createElement("div")
      head.className = "photos-head"
      container.insertBefore(head, title)
      head.appendChild(title)
      head.appendChild(firstFigure)
      return { bound: true }
    })()`)
    void photosHeadProbe

    /**
     * 票据自适应（2026-11-02 第四十轮）。
     *
     * 票据与照片**共用上面那套规则**（同一个 layoutSection）：
     * 满宽 176mm + 等高 + 不裁剪 + 只压扁不拉长。
     *
     * 为什么票据也这么排：
     *   票据是财务凭证，**不能变形**（拉长会让金额看着失真），
     *   所以「只压扁、不拉长」这条对它尤其重要——
     *   宽幅票据（如 700×400）满宽时自然高只有 100mm，
     *   它就是这一页的「基准高度」，别的票据压到和它一样高，
     *   谁都不会被拉长。
     *
     * 只有一张票据时仍然**垂直居中**（下面挂 min-height 撑开），
     * 免得孤零零一张贴在页顶、下面全空。
     */
    const receiptCount = await page.evaluate(`(() => {
      const figs = Array.from(document.querySelectorAll(".receipts figure"))
      if (!figs.length) return { count: 0 }
      // 只有一张票据时垂直居中：给 figure 一个撑开的 min-height
      if (figs.length === 1) {
        figs[0].style.minHeight = (267 - 40) + "mm"
      }
      return { count: figs.length }
    })()`)
    void receiptCount

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      // 页边距（2026-11-02 第三十八轮之五调整）：
      //   上下白边 37/35 → **15/15**，版心高 225mm → **267mm**（用户要求「上下边距也要调小」）
      //   左右白边仍是 17mm，版心宽 176mm（表格宽度是设计约束，让位于它）
      //
      // 上下收紧的连带影响（已知取舍）：
      //   公文 GB/T 9704 的「每页 22 行」是按 225mm 版心 + 28.9pt 行距推出来的，
      //   版心高放宽到 267mm 后，一页能放约 **26 行**。
      //   行距本身没动（仍是 28.9pt），字号也没动，
      //   所以正文行距、字体、字号层级三项规范验收都不受影响。
      //
      // 为什么左右没按公文的 28/26mm：这份材料是「活动立项与结项记录**表**」，
      // 表格是主体而不是纯文稿。四列（标签 + 内容 ×2）按内容算至少要 170.6mm
      // 版心宽，硬套 156mm 的结果是「计划活动时间」「2026年10月31日」这类内容
      // 到处断行（实测日期被断成两行），反而更不像正式材料。
      // 表格宽度是设计约束，页边距要让位于它。
      margin: { top: '15mm', bottom: '15mm', left: '17mm', right: '17mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      /**
       * 公文式页码：四号数字，数字左右各放一条一字线。
       *
       * ⚠️ 为什么页码用 DejaVu Serif 而不是正文的 Noto Serif SC：
       * Chromium 渲染 header/footer 模板时**不加载页面的 @font-face，也不认自定义系统字体**，
       * 只有它自带的少数字体能真正嵌入。实测：
       *   - Noto Serif SC → 落成 Type3 位图路径（不可选、不可搜）
       *   - DejaVu Serif  → 嵌入 Type0 真字体（可选、可搜、放大清晰）
       * 所以这里取「可复制可搜索」优先。页码只有数字与破折号，
       * 观感差异肉眼几乎看不出；正文与标题仍是 Noto Serif SC。
       *
       * ⚠️ GB/T 9704 规定「单页码居右空一字、双页码居左空一字」，
       * 但 Chromium 的 footerTemplate 不支持奇偶页 CSS 伪类，无法区分左右，
       * 这里统一居中排布。
       */
      footerTemplate: `<div style="width:100%;text-align:center;font-size:14pt;color:#000000;font-family:'DejaVu Serif','Noto Serif SC',serif;padding:0 26mm;"><span style="letter-spacing:0.1em;">— <span class="pageNumber"></span> —</span></div>`,
    })
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="activity-${plan.slug}${mode === 'final' ? '-final' : ''}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } finally {
    printing -= 1
    await page?.close().catch(() => undefined)
  }
}
