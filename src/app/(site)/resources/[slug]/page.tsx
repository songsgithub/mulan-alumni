import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, FileText } from 'lucide-react'

import { ResourceMedia } from '@/components/site/ResourceMedia'
import { RichTextBlock } from '@/components/site/RichText'
import { ResourceCard, Wrap, cnDate, museButton } from '@/components/site/muse'
import { formatFileSize } from '@/lib/format'
import { FILE_KIND_LABEL, RESOURCE_CATEGORY_LABEL } from '@/lib/labels'
import { getLibrary, getLibraryItemBySlug } from '@/lib/public-data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getLibraryItemBySlug((await params).slug)
  return { title: item?.title ?? '资源' }
}

/**
 * 资源详情。
 *
 * - 视频：单栏，播放器居中（上限 1100px）——画面比排版重要；
 * - PDF / 有正文的文档：左 6 右 4，左边预览、右边标题与说明（右侧吸顶）；
 * - 其它：标题卡 + 预览（能预览才显示）。
 */
export default async function LibraryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getLibraryItemBySlug(slug)
  if (!item) notFound()
  const more = (await getLibrary(8)).filter((e) => e.slug !== slug).slice(0, 3)

  const mime = item.file?.mimeType
  const isVideo = Boolean(mime?.startsWith('video/')) || item.type === 'video'
  const isPdf = mime === 'application/pdf'
  const isImage = Boolean(mime?.startsWith('image/'))
  const hasBody = Boolean(item.body)
  /** 能在页面里直接看的：视频 / PDF / 图片；其它格式给下载说明卡，不拿封面图充数 */
  const previewable = isVideo || isPdf || isImage

  const info = (
    <>
      <p className="hand-note text-[1rem]">{RESOURCE_CATEGORY_LABEL[item.category ?? ''] ?? '资源'}</p>
      <h1 className="mt-1 font-display text-[1.625rem] leading-snug font-medium text-ink sm:text-[2rem]">
        {item.title}
      </h1>
      <p className="mt-2 text-[1rem] text-ink-muted">
        {[
          mime ? FILE_KIND_LABEL[mime] : item.type === 'video' ? '视频' : '',
          item.file?.filesize ? formatFileSize(item.file.filesize) : '',
          cnDate(item.publishedAt),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {item.summary ? (
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink/85">{item.summary}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {item.file?.url ? (
          <a href={item.file.url} download={item.file.filename ?? 'download'} className={museButton('default', 'lg')}>
            <Download aria-hidden className="size-4" /> 下载
          </a>
        ) : null}
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className={museButton('outline', 'lg')}>
            <ExternalLink aria-hidden className="size-4" /> 在外部打开
          </a>
        ) : null}
      </div>
    </>
  )

  /** 没法在线预览的格式：给一张说明卡，别留一块空白 */
  const noPreview = !previewable && !item.url ? (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-line bg-white p-8 text-center">
      <FileText aria-hidden className="size-10 text-mountain/40" />
      <p className="text-[1rem] text-ink-muted">
        {mime ? FILE_KIND_LABEL[mime] : '这个文件'} 不能在线预览
      </p>
      <p className="text-[0.9375rem] text-ink-muted">下载后用本地软件打开</p>
    </div>
  ) : null

  return (
    <Wrap className="pt-8 pb-8">
      <Link href="/resources" className={museButton('outline')}>
        <ArrowLeft aria-hidden className="size-4" /> 返回资源
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:items-start lg:gap-8">
        {/* 左：预览（视频 / PDF / 图片；不能预览的给说明卡） */}
        <div className="min-w-0">
          {noPreview ?? (
            <ResourceMedia file={item.file} url={item.url} cover={item.cover} title={item.title} />
          )}
        </div>

        {/* 右：标题 / 下载 / 说明（吸顶） */}
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[1.5rem] border border-line bg-white p-6 shadow-card">
            {info}
            {hasBody ? (
              <article className="mt-6 border-t border-line/70 pt-5 text-[1.0625rem] leading-loose text-ink/90 [&_p]:mb-4">
                <RichTextBlock data={item.body} />
              </article>
            ) : null}
          </div>
        </aside>
      </div>

      {more.length ? (
        <section className="mt-14">
          <h2 className="mb-5 font-display text-[1.5rem] font-medium text-ink">资源里还有</h2>
          {/* 与 /resources 列表页**同一套栅格与卡片尺寸**（2026-11-03 第四十九轮）：
              之前这里多写了 `grid-cols-[minmax(0,1fr)]`，把 `auto-fill` 的列定义覆盖成单列，
              卡片被拉成整行宽屏。这里只保留 `auto-fill` 那一列定义。 */}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))] sm:gap-5">
            {more.map((e) => (
              <ResourceCard key={e.slug} item={e} categoryLabel={RESOURCE_CATEGORY_LABEL[e.category ?? '']} />
            ))}
          </div>
        </section>
      ) : null}
    </Wrap>
  )
}
