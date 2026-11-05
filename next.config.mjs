// Payload 3.92 的导出路径是 `@payloadcms/next/withPayload`（旧版的 `with-payload` 已移除）
import { withPayload } from '@payloadcms/next/withPayload'

/**
 * 安全响应头（全站）。
 * - 不嵌入别人的框架（防点击劫持）、不嗅探 MIME（防上传文件被当脚本执行）；
 * - CSP 只收紧不会误伤的几项：Payload 后台与 Next 开发态都依赖内联脚本，
 *   script-src 不做强限制，否则后台直接白屏。
 */
const isProd = process.env.NODE_ENV === 'production'
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // 用户上传的文件：一律按附件下载语义的类型处理，禁止被嗅探成 HTML
      {
        source: '/api/(media|finance-evidence)/file/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ]
  },
  images: {
    // 只优化本站与对象存储上的图片：写 `https://**` 等于把图片优化接口变成任何人都能用的开放代理
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      ...[process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT, process.env.NEXT_PUBLIC_SERVER_URL]
        .filter(Boolean)
        .map((value) => {
          try {
            const url = new URL(value)
            return { protocol: url.protocol.replace(':', ''), hostname: url.hostname }
          } catch {
            return null
          }
        })
        .filter(Boolean),
    ],
  },
  typescript: { ignoreBuildErrors: false },
  // 生成活动材料 PDF 时用 Playwright 驱动 Chromium（服务端，只在打印路由里用）
  serverExternalPackages: ['playwright', 'playwright-core', 'pdfjs-dist', '@napi-rs/canvas'],
  experimental: {
    // 多个根布局（公众站 / 工作台 / Payload 后台各自一个 <html>），
    // 不存在的路径交给 app/global-not-found.tsx 渲染中文 404
    globalNotFound: true,
    // 工作台要上传现场照片与凭证：手机照片动辄 3–5 MB，
    // Server Action 默认 1 MB 上限会直接报 "Body exceeded 1 MB limit"。
    // ⚠️ 大的资源文件（视频，≤1GB）**不走 Server Action**——浏览器直传
    // /api/media（流式落盘），否则整个请求体会被缓冲进内存。
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default withPayload(nextConfig)
