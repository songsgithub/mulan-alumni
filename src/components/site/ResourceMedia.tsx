'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Play } from 'lucide-react'

/**
 * 资源的「主体」：视频播放器 / PDF 内嵌预览 / 大图。
 *
 * 国际上资源站点的常见做法（Google Drive、Dropbox、Notion）：
 * **先能看，再能下**——详情页顶部给一个可交互的预览区（视频用播放器、
 * PDF 用内嵌阅读、图用大图），下载按钮放在旁边，不抢主位。
 */
interface ResourceMediaProps {
  /** 附件（站内文件） */
  file?: { url?: string; filename?: string; mimeType?: string; filesize?: number } | null
  /** 外链：mp4 / webm 直链可以直接播；页面地址（B 站等）只给跳转 */
  url?: string | null
  cover?: { url?: string; alt?: string } | null
  title: string
}

/** 视频直链的扩展名判断（B 站那种页面地址不能塞进 <video>） */
const isPlayableUrl = (url?: string | null) =>
  Boolean(url && /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url))

/** 胶囊标签（分类 / PDF 这种小徽标） */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-white/80 px-2.5 py-0.5 text-[0.9375rem] font-medium tracking-[0.08em] text-ink-muted">
      {children}
    </span>
  )
}

/** 文件大小这一行小字 */
function Small({ children }: { children: React.ReactNode }) {
  return <p className="text-[1rem] leading-[1.7] text-ink-muted">{children}</p>
}

export function ResourceMedia({ file, url, cover, title }: ResourceMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  // 1. 视频：站内文件，或外链是视频直链
  const videoSrc = file?.mimeType?.startsWith('video/') ? file.url : isPlayableUrl(url) ? url : null
  if (videoSrc) {
    const start = () => {
      setPlaying(true)
      void videoRef.current?.play().catch(() => setPlaying(false))
    }
    return (
      <div>
        {/* 16:9 画框：封面铺满（cover），点开才播；播放后露出原生控件。
            ⚠️ 容器与 video 都不要铺黑底：圆角裁切处会透出 1px 黑边 */}
        <div className="relative overflow-hidden rounded-[1.5rem] shadow-card">
          {/* 字幕：站内目前不收字幕文件，播放器下方有文字说明（WCAG 1.2.2 的过渡做法） */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onEnded={() => setPlaying(false)}
            className="block aspect-video w-full object-contain"
          >
            <source src={videoSrc} />
            你的浏览器不支持视频播放，可以
            <a href={videoSrc} download={file?.filename}>
              下载文件
            </a>
            后再看。
          </video>

          {!playing ? (
            <button
              type="button"
              onClick={start}
              aria-label={`播放：${title}`}
              className="group absolute inset-0 flex items-center justify-center"
            >
              {cover?.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 bg-mulan" aria-hidden />
              )}
              <span className="relative flex size-16 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift transition-transform duration-300 group-hover:scale-105">
                <Play aria-hidden className="ml-1 size-6 fill-current" />
              </span>
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {file?.filesize ? <Small>{(file.filesize / 1024 / 1024).toFixed(1)} MB</Small> : null}
          <Small>本视频暂无字幕，可结合页面文字介绍观看。</Small>
        </div>
      </div>
    )
  }

  // 2. PDF：内嵌阅读（像 Drive / Dropbox 那样能直接翻）
  if (file?.mimeType === 'application/pdf' && file.url) {
    return (
      <div>
        <div className="overflow-hidden rounded-card border bg-card">
          <iframe
            src={file.url}
            title={title}
            className="h-[70vh] min-h-[520px] w-full"
            loading="lazy"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Chip>PDF</Chip>
          {file.filesize ? <Small>{(file.filesize / 1024 / 1024).toFixed(1)} MB</Small> : null}
        </div>
      </div>
    )
  }

  // 3. 图片：大图（relative 是必需的：next/image 的 fill 依赖父级定位）
  if (cover?.url) {
    return (
      <figure>
        <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface">
          <Image
            src={cover.url}
            alt={cover.alt ?? title}
            fill
            sizes="(max-width: 1680px) 100vw, 1600px"
            className="object-cover"
          />
        </div>
      </figure>
    )
  }

  return null
}
