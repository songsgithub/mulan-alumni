import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarDays,
  CalendarHeart,
  FileText,
  Flower2,
  MapPin,
  Play,
  Users,
} from 'lucide-react'

import { site } from '@/content/site'
import { formatFileSize } from '@/lib/format'
import type { CircleSummary, LibrarySummary, Outcome } from '@/lib/public-data'
import { cn } from '@/lib/utils'

/**
 * 公开站共享组件：复刻朋友平台 muse（muse/src/components/*），数据来自本系统。
 *
 * 第二十轮「高级 · 温馨」调整（结构不变，只调气质）：
 * - 版心从 1152px 放宽到 1440px，两边留白更少；
 * - 卡片照片内嵌（四周留一圈白边、圆角套圆角），阴影换成多层柔光；
 * - 按钮改成胶囊；标题用细字重 + 粉色荧光笔强调；章节前加一枝木兰花饰。
 */

/** muse 的日期写法：2026 年 9 月 20 日 */
export function cnDate(value?: string): string {
  if (!value) return '——'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 版心：最宽 1680px，左右留白 20 / 32 / 48px */
export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1680px] px-5 sm:px-8 xl:px-12', className)}>{children}</div>
  )
}

/** 花饰：一枝细线木兰（章节眉标签前、空状态里用） */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('size-5 shrink-0', className)}>
      <path d="M16 28c0-7 0-12 0-16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M16 12c-3.6-1-5.6-4.2-5-8 3.6.6 5.8 3.6 5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 12c3.6-1 5.6-4.2 5-8-3.6.6-5.8 3.6-5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 20c-2.8-.2-5-2-5.6-4.6 2.8-.2 5 1.6 5.6 4.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 23c2.8-.2 5-2 5.6-4.6-2.8-.2-5 1.6-5.6 4.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 眉标签：花饰 + 一句手写批注 */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('hand-note inline-flex items-center gap-2 text-[1rem]', className)}>
      <Sprig className="text-magnolia" />
      {children}
    </p>
  )
}

/** 小一号的标题（副标题 / 章节标题用；桌面 32px / 手机 26px） */
const TITLE_MD = 'text-[1.625rem] leading-[1.3] sm:text-[2rem]'

/**
 * 标题：细字重大字，`mark` 那几个字下面垫一笔粉色荧光笔。
 * 例：<Heading mark="活动">最新</Heading> → 最新活动（「活动」被强调）
 *
 * `size="md"` 是小一号（与页头副标题同号）：关于页的四个章节标题用它。
 */
export function Heading({
  children,
  mark,
  as: Tag = 'h2',
  className,
  size = 'lg',
}: {
  children?: React.ReactNode
  mark?: string
  as?: 'h1' | 'h2'
  className?: string
  /** lg = 常规标题（h1 更大）；md = 小一号，与副标题同号 */
  size?: 'lg' | 'md'
}) {
  return (
    <Tag
      className={cn(
        'font-display font-light tracking-[0.02em] text-ink',
        size === 'md'
          ? TITLE_MD
          : Tag === 'h1'
            ? 'text-[2.375rem] leading-[1.2] sm:text-[3.25rem]'
            : 'text-[2rem] leading-[1.25] sm:text-[2.625rem]',
        className,
      )}
    >
      {children}
      {mark ? <span className="mark-soft font-medium">{mark}</span> : null}
    </Tag>
  )
}

/** 章节头：眉标签 + 标题（+ 右侧链接） */
export function SectionHead({
  note,
  title,
  mark,
  link,
}: {
  note?: string
  title?: string
  mark?: string
  link?: { href: string; label: string }
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {note ? <Eyebrow>{note}</Eyebrow> : null}
        <Heading mark={mark} className={note ? 'mt-2' : undefined}>
          {title}
        </Heading>
      </div>
      {link ? (
        <Link
          href={link.href}
          className="group inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white/70 px-5 text-[1rem] font-medium text-ink backdrop-blur transition-all duration-300 hover:border-magnolia/40 hover:text-magnolia"
        >
          {link.label}
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      ) : null}
    </div>
  )
}

/** 列表页页头：花饰批注 + 细字大标题（+ 右侧操作），下面一道柔光分隔 */
export function PageIntro({
  note,
  title,
  mark,
  subtitle,
  subtitleAccent,
  lead,
  actions,
}: {
  note?: string
  title: string
  /** 标题里要强调的几个字（必须是 title 的结尾部分） */
  mark?: string
  /** 标题下面的副标题（display 字体，比标题小一号；关于页 / 联系我们页用） */
  subtitle?: string
  /** 副标题里要垫荧光笔的几个字（活动页「活动」那种标记） */
  subtitleAccent?: string
  lead?: string
  actions?: React.ReactNode
}) {
  const head = mark && title.endsWith(mark) ? title.slice(0, -mark.length) : title
  // 副标题里的荧光笔字：整段都要标记时，accent 就是整段
  const accentAt = subtitleAccent && subtitle ? subtitle.indexOf(subtitleAccent) : -1
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="min-w-0">
        {note ? <Eyebrow>{note}</Eyebrow> : null}
        <Heading
          as="h1"
          mark={mark && title.endsWith(mark) ? mark : undefined}
          className={note ? 'mt-2' : undefined}
        >
          {head}
        </Heading>
        {subtitle ? (
          <p className={cn('mt-2 font-display font-light tracking-[0.02em] text-ink', TITLE_MD)}>
            {accentAt >= 0 ? (
              <>
                {subtitle.slice(0, accentAt)}
                <span className="mark-soft font-medium">
                  {subtitle.slice(accentAt, accentAt + subtitleAccent!.length)}
                </span>
                {subtitle.slice(accentAt + subtitleAccent!.length)}
              </>
            ) : (
              subtitle
            )}
          </p>
        ) : null}
        {lead ? (
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}

export const projectName = (value?: string) =>
  site.projects.items.find((item) => item.value === value)?.name ?? '互助团活动'

/** 项目标签：四个项目各一种柔色（叠在照片上用白底半透明，读得清） */
const PROJECT_TONE: Record<string, string> = {
  'go-mulan': 'text-magnolia',
  'homestay-manager': 'text-primrose-fg',
  'a-idol': 'text-mountain',
}
const PROJECT_DOT: Record<string, string> = {
  'go-mulan': 'bg-magnolia',
  'homestay-manager': 'bg-homestay',
  'a-idol': 'bg-mountain',
}

export function ProjectTag({ value, className }: { value?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[0.9375rem] font-medium shadow-chip backdrop-blur',
        PROJECT_TONE[value ?? ''] ?? 'text-ink',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', PROJECT_DOT[value ?? ''] ?? 'bg-ink')} />
      {projectName(value)}
    </span>
  )
}

/** 卡片外壳：白底、细描边、柔光影，悬停浮起 */
const CARD =
  'group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-line/80 bg-white shadow-card transition-all duration-500 ease-soft hover:-translate-y-1.5 hover:border-magnolia/20 hover:shadow-card-hover'

/** 三种卡片（活动 / 互助团 / 资源）的内嵌照片区高度：全站统一一档 */
const CARD_MEDIA_H = 'h-[160px]'

/**
 * 活动卡片：内嵌封面（白边 + 圆角）+ 项目标签（图片左下）+ 名称 + 简介 +
 * 日期 / 地域 / 互助团 / 参与人数。
 *
 * 与互助团卡同一套版式语言：图片内嵌、项目标签贴图左下、底部一行元信息。
 */
export function ActivityCard({
  outcome,
  index = 0,
  feature = false,
}: {
  outcome: Outcome
  index?: number
  /** 首页的「最新活动」用三列大卡：图片按比例放大，比列表页的固定高度更有分量 */
  feature?: boolean
}) {
  const region = outcome.location || outcome.circle?.city
  return (
    <Link href={`/activities/${outcome.slug}`} className="block h-full min-w-0">
      <article className={CARD}>
        <div className="p-2.5 pb-0">
          <div
            className={cn(
              'relative overflow-hidden rounded-[1.125rem] bg-blush',
              feature ? 'aspect-[16/10]' : CARD_MEDIA_H,
            )}
          >
            {outcome.cover?.url ? (
              <Image
                src={outcome.cover.url}
                alt={`活动封面：${outcome.title}`}
                fill
                priority={index < 3}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 460px"
                className="object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.05]"
              />
            ) : (
              <span
                className="absolute inset-0 flex items-center justify-center text-magnolia/30"
                aria-hidden
              >
                <Flower2 className="size-14" strokeWidth={1.2} />
              </span>
            )}
            <ProjectTag value={outcome.category} className="absolute bottom-3 left-3" />
            <span className="absolute right-3 bottom-3 rounded-full bg-ink/55 px-3 py-1 text-[0.9375rem] text-white backdrop-blur-md">
              {outcome.kind}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
          <h3 className="line-clamp-2 font-display text-[1.1875rem] leading-snug font-semibold text-ink transition-colors duration-300 group-hover:text-magnolia">
            {outcome.title}
          </h3>
          {outcome.excerpt ? (
            <p className="mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-muted">
              {outcome.excerpt}
            </p>
          ) : null}
        </div>
        {/* 两行：日期 + 地点 / 团名 + 人数；地点与团名单行省略，鼠标悬停看全文 */}
        <div className="space-y-1.5 border-t border-line/70 px-5 py-3 text-[0.9375rem] text-ink-muted">
          <div className="flex items-center gap-x-4">
            {outcome.date ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                <CalendarDays aria-hidden className="size-4 shrink-0 text-magnolia/80" />
                <span className="tabular-nums">{cnDate(outcome.date)}</span>
              </span>
            ) : null}
            {region ? (
              <span className="inline-flex min-w-0 items-center gap-1" title={region}>
                <MapPin aria-hidden className="size-4 shrink-0 text-magnolia/80" />
                <span className="truncate">{region}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-x-4">
            {outcome.circle?.name ? (
              <span className="inline-flex min-w-0 items-center gap-1" title={outcome.circle.name}>
                <Users aria-hidden className="size-4 shrink-0 text-magnolia/80" />
                <span className="truncate">{outcome.circle.name}</span>
              </span>
            ) : null}
            {outcome.attendeeCount ? (
              <span className="shrink-0 whitespace-nowrap tabular-nums">{outcome.attendeeCount} 人参与</span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  )
}

/** 互助团卡片：上面一张活动现场图 + 团名与简介 + 底部四项数据（活动 / 人次 / 省县 / 成立时间） */
export function TeamCard({ circle }: { circle: CircleSummary }) {
  const cover = circle.latest?.cover

  return (
    <Link href={`/circles/${circle.slug}`} className="block h-full min-w-0">
      <article className={cn(CARD)}>
        {/* 顶部：这个团最近一场活动的现场图（没有就退回品牌渐变）。
            与活动列表卡一样内嵌一张：四周留白包边、图片自己圆角。 */}
        <div className="p-2.5 pb-0">
          <div className={cn('relative w-full shrink-0 overflow-hidden rounded-[1.125rem] bg-mulan', CARD_MEDIA_H)}>
            {cover?.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover.url}
                alt={cover.alt || circle.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : null}
            {/* 项目类别贴在图片左下角：与活动卡的标签同一套，只是位置更不容易压到人脸 */}
            <ProjectTag value={circle.category} className="absolute bottom-3 left-3" />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
          <h3 className="font-display text-[1.1875rem] leading-[1.35] font-semibold text-ink transition-colors group-hover:text-magnolia">
            {circle.name}
          </h3>
          <p className="mt-2 line-clamp-2 flex-1 text-[0.9375rem] leading-relaxed text-ink-muted">
            {circle.description || circle.theme || '姐妹们在这里互相搭把手，一起学习、一起成长。'}
          </p>
        </div>

        <div className="space-y-1.5 border-t border-line/70 px-5 py-3 text-[0.9375rem] text-ink-muted">
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-ink tabular-nums">{circle.outcomeCount || 0}</span>
            场活动
            <span aria-hidden className="text-line">
              ·
            </span>
            <span className="font-semibold text-ink tabular-nums">{circle.people || 0}</span>
            人次参与
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span
              className="inline-flex min-w-0 items-center gap-1"
              title={circle.regionShort || circle.city || undefined}
            >
              <MapPin aria-hidden className="size-4 shrink-0 text-magnolia/80" />
              <span className="truncate">{circle.regionShort || circle.city || '——'}</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CalendarHeart aria-hidden className="size-4 shrink-0 text-magnolia/80" />
              {circle.createdAt ? `${cnDate(circle.createdAt)} 成立` : '成立时间待补'}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

/** 资源卡片：内嵌封面 + 分类 + 标题 + 摘要 + 进去能做什么 */
export function ResourceCard({
  item,
  categoryLabel,
  kindLabel,
}: {
  item: LibrarySummary
  categoryLabel?: string
  kindLabel?: string
}) {
  const action =
    item.file?.mimeType?.startsWith('video/') || item.type === 'video'
      ? '在线播放'
      : item.file?.mimeType === 'application/pdf'
        ? '在线阅读 · 可下载'
        : item.file?.url
          ? '可以下载'
          : '查看详情'
  const isVideo = item.type === 'video' || Boolean(item.file?.mimeType?.startsWith('video/'))
  const size = formatFileSize(item.file?.filesize)
  const meta = [kindLabel ?? (isVideo ? '视频' : '文档'), size].filter(Boolean).join(' · ')

  return (
    <Link href={`/resources/${item.slug}`} className="block h-full min-w-0">
      <article className={CARD}>
        <div className="p-2.5 pb-0">
          <div className={cn('relative overflow-hidden rounded-[1.125rem] bg-lilac', CARD_MEDIA_H)}>
            {item.cover?.url ? (
              <Image
                src={item.cover.url}
                alt={item.cover.alt ?? item.title}
                fill
                sizes="(max-width: 640px) 100vw, 460px"
                className="object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.05]"
              />
            ) : (
              <span
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-mountain"
                aria-hidden
              >
                <FileText className="size-10" strokeWidth={1.2} />
                <span className="text-[0.9375rem] font-medium tracking-[0.08em]">{kindLabel ?? '文档'}</span>
              </span>
            )}
            {categoryLabel ? (
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[0.9375rem] font-medium text-mountain shadow-chip backdrop-blur">
                {categoryLabel}
              </span>
            ) : null}
            {isVideo ? (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink/55 px-3 py-1 text-[0.9375rem] text-white backdrop-blur-md">
                <Play aria-hidden className="size-3.5 fill-current" /> 视频
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
          <h3 className="line-clamp-2 font-display text-[1.1875rem] leading-snug font-semibold text-ink transition-colors group-hover:text-magnolia">
            {item.title}
          </h3>
          {item.summary ? (
            <p className="mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-muted">
              {item.summary}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-5 py-3 text-[0.9375rem] text-ink-muted">
          <span className="tabular-nums">{meta}</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-magnolia">
            {action} <ArrowUpRight aria-hidden className="size-4" />
          </span>
        </div>
      </article>
    </Link>
  )
}

/**
 * 批注卡（NoteCard）：纸面渐变 + 顶上一条胶带，微微斜放。
 * 活动详情的摘要卡与互助团详情的「关于我们」是同一张卡，全站统一一份版式。
 */
export function NoteCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'tape rotate-[-0.4deg] rounded-[1.5rem] border border-white bg-note p-6 shadow-paper',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** 空状态（muse EmptyState）：花饰 + 温柔的话 */
export function EmptyState({
  title = '暂无相关活动，换个关键词试试吧～',
  hint = '试试放宽筛选条件，或去互助团页面逛逛其他姐妹的动态',
  resetHref,
}: {
  title?: string
  hint?: string
  resetHref?: string
}) {
  return (
    <div className="glow-panel flex flex-col items-center rounded-[1.5rem] border border-line px-6 py-16 text-center shadow-card">
      <span
        className="flex size-24 items-center justify-center rounded-full bg-white text-magnolia shadow-card"
        aria-hidden
      >
        <Sprig className="size-12" />
      </span>
      <p className="mt-5 font-display text-[1.375rem] font-medium text-ink">{title}</p>
      <p className="mt-2 max-w-sm text-[1rem] leading-relaxed text-ink-muted">{hint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {resetHref ? (
          <Link href={resetHref} className={museButton('outline')}>
            重置筛选
          </Link>
        ) : null}
        <Link href="/circles" className={museButton('secondary')}>
          去互助团风采页 →
        </Link>
      </div>
    </div>
  )
}

/** 按钮（链接也能用）：胶囊形 */
export function museButton(
  variant: 'default' | 'outline' | 'secondary' | 'hero' = 'default',
  size: 'md' | 'lg' = 'md',
) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-300 ease-soft focus-visible:ring-[3px] focus-visible:ring-magnolia/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
    size === 'lg' ? 'min-h-12 px-7 text-[1.0625rem]' : 'min-h-11 px-5 text-[1rem]',
    variant === 'default' &&
      'bg-ink text-white shadow-button hover:-translate-y-0.5 hover:bg-ink-strong',
    variant === 'hero' &&
      'bg-magnolia text-white shadow-button-accent hover:-translate-y-0.5 hover:bg-accent-strong',
    variant === 'outline' &&
      'border border-line bg-white/80 text-ink backdrop-blur hover:border-magnolia/40 hover:text-magnolia',
    variant === 'secondary' && 'bg-blush text-primrose-fg hover:bg-blush-strong',
  )
}

/** 分页器：上一页 · 页码 · 下一页 */
export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
}) {
  if (totalPages <= 1) return null
  const num =
    'flex size-11 items-center justify-center rounded-full border font-display text-[1rem] transition-all duration-300'
  return (
    <nav aria-label="分页" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={cn(museButton('outline'), page <= 1 && 'pointer-events-none opacity-50')}
      >
        上一页
      </Link>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-label={`第 ${n} 页`}
          aria-current={n === page ? 'page' : undefined}
          className={cn(
            num,
            n === page
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-white text-ink hover:border-magnolia hover:text-magnolia',
          )}
        >
          {n}
        </Link>
      ))}
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={cn(museButton('outline'), page >= totalPages && 'pointer-events-none opacity-50')}
      >
        下一页
      </Link>
    </nav>
  )
}
