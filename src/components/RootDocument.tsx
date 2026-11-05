import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import '@/app/globals.css'

/**
 * 公众站与工作台共用的 `<html>/<body>` 外壳。
 *
 * 为什么不放在 `app/layout.tsx`：Payload 后台（`(payload)` 路由组）的 `RootLayout`
 * 自己会渲染一个 `<html lang="en">`；根布局再包一层就是两个 `<html>` 嵌套，
 * 后台每次打开都报水合错误。所以改成**多个根布局**：
 * `(site)` 与 `(admin)` 各自用这个外壳，`(payload)` 用 Payload 自己的。
 *
 * 全站一套无衬线；中文不下载 webfont（几十 MB），用本地字体栈兜底（见 globals.css）。
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const rootMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'),
  title: {
    default: '数字木兰 · 校友互助网络',
    template: '%s · 数字木兰',
  },
  description:
    '数字木兰是蚂蚁公益基金会的项目，连接完成数字技能培训的校友。她们在城市里组成互助团，自己策划活动、分享方法，公开可用的资料全部放在这里。',
  openGraph: {
    title: '数字木兰 · 校友互助网络',
    description: '培训结束，互助开始。城市里的互助团自己策划活动、分享方法。',
    type: 'website',
    locale: 'zh_CN',
  },
}

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <head>
        {/* 阿里巴巴普惠体：按 unicode-range 分片的 woff2，浏览器只下载页面用到的字 */}
        <link rel="preconnect" href="https://mdn.alipayobjects.com" crossOrigin="" />
        <link rel="stylesheet" href="https://mdn.alipayobjects.com/muse_ppt/uri/file/as/v1/AliBabaPuHuiTi-v2.css" />
      </head>
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  )
}
