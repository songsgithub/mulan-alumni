'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Check } from 'lucide-react'

import { markNotificationsRead } from '@/app/(admin)/(workspace)/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface NotificationRow {
  id: string
  title: string
  link?: string | null
  read: boolean
  createdAt?: string | null
}

/**
 * 通知时间：**固定按北京时间**格式化。
 *
 * 这张表现在是客户端组件，服务端渲染出的字与浏览器水合时算的字必须一样，
 * 否则会报水合不一致。`lib/format.ts` 的 `formatDateTimeCN` 用的是运行环境的本地时区，
 * 服务器与浏览器不同就会对不上——所以这里自己用固定时区（与铃铛弹层同一套）。
 */
const TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const formatTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return TIME.format(date)
}

/**
 * 把搜索关键词在标题里标出来（不区分大小写，保留原文大小写）。
 *
 * 搜到一条通知却看不出"是哪几个字命中的"，等于没搜。
 * 高亮用工作台自己的 token：淡紫底 + 深紫字，不引入第二种颜色。
 */
function highlight(text: string, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return text
  const lower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let from = 0
  let key = 0
  for (;;) {
    const at = lower.indexOf(needle, from)
    if (at < 0) {
      parts.push(text.slice(from))
      break
    }
    if (at > from) parts.push(text.slice(from, at))
    parts.push(
      <mark
        key={key++}
        // decoration-skip-ink：下划线在字与字缝隙处断开，不要横穿高亮块
        className="rounded-[0.25rem] bg-accent-soft px-1 text-accent-strong decoration-skip-ink"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    from = at + needle.length
  }
  return parts
}

/**
 * 通知列表（工作台 /notifications）。
 *
 * **点一条 = 读掉一条**：标题可点，读完立刻变成已读（行首圆点消失、状态变「已读」）。
 *
 * 为什么必须在这里做：铃铛只带最近 10 条，且它自己只负责角标与弹层；
 * 「全部通知」页才是能逐条处理的地方。以前这一页只有一行表格，
 * 点标题只是跳走（**合作类通知连跳都没有**——它没有 link），未读永远消不掉。
 *
 * 三种标题形态：
 * - 有链接（活动审批 / 报销核定）：点了先标已读，再跳到对应页面；
 * - 无链接（合作联系留言）：点了标已读，就停在这一页；
 * - 已读：只是文字，不带任何动作。
 *
 * 另有一枚显式的「标为已读」按钮放在状态列——不靠"用户知道标题能点"，
 * 每一行都写着怎么把未读清掉。
 */
export function NotificationTable({
  rows,
  query,
}: {
  rows: NotificationRow[]
  /** 标题关键字（用于高亮命中片段） */
  query: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // 本地已读集合：标完立刻变，不用等服务端回包
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set())

  const isRead = (row: NotificationRow) => row.read || locallyRead.has(row.id)
  const unreadCount = useMemo(() => rows.filter((row) => !isRead(row)).length, [rows, locallyRead])

  /** 标一条已读（服务端动作；成功后刷新页面数据，让分页签计数与角标一起更新） */
  const markOne = async (id: string) => {
    const data = new FormData()
    data.append('id', id)
    const res = await markNotificationsRead(data)
    if (res?.ok) {
      setLocallyRead((prev) => new Set(prev).add(id))
      router.refresh()
    }
  }

  /**
   * 标题点击：有链接的先标已读再跳走；无链接的标完就停在这里。
   *
   * 拦默认行为的原因：服务端动作还没回包就跳走，请求可能被中断，
   * 于是"点了却没变成已读"——这正是这次要修的那个毛病。
   * ⌘/Ctrl/Shift 点击（开新标签）不拦，照常标记。
   */
  const onTitleClick = (event: React.MouseEvent, row: NotificationRow) => {
    if (isRead(row)) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      void markOne(row.id)
      return
    }
    event.preventDefault()
    startTransition(async () => {
      await markOne(row.id)
      if (row.link) router.push(row.link)
    })
  }

  return (
    <Table className="resp-table">
      <TableHeader>
        <TableRow>
          {/* 列序【状态 → 时间 → 通知】：
              状态在最左——进来先看"有没有还没读的"，一眼扫过去；
              通知列吃掉剩余宽度（它在最右，右边不留空档）。 */}
          <TableHead className="w-[7.5rem]">状态</TableHead>
          <TableHead className="w-[9rem]">时间</TableHead>
          <TableHead className="w-full">通知</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const read = isRead(row)
          return (
            <TableRow
              key={row.id}
              // 未读：整行淡紫底 + 一个圆点；已读：普通行。
              className={read ? undefined : 'bg-accent-soft/40'}
            >
              <TableCell className="align-top" data-label="状态">
                {read ? (
                  <Badge variant="muted">已读</Badge>
                ) : (
                  <span className="flex flex-col items-start gap-1.5">
                    <Badge variant="brand">未读</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await markOne(row.id)
                        })
                      }
                      className="-ml-2 text-muted hover:text-accent"
                    >
                      <Check aria-hidden />
                      标为已读
                    </Button>
                  </span>
                )}
              </TableCell>
              <TableCell className="align-top text-small tabular-nums text-muted" data-label="时间">
                {formatTime(row.createdAt)}
              </TableCell>
              <TableCell className="max-w-[46em] whitespace-normal" data-label="通知">
                <span className="flex items-start gap-2.5">
                  {!read ? (
                    <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                  ) : null}
                  {row.link ? (
                    <Link
                      href={row.link}
                      onClick={(event) => onTitleClick(event, row)}
                      className={
                        // 已读：普通字重、灰字、**不带常驻下划线**（满屏下划线太吵）；
                        // 未读：加粗 + 下划线 + 行首圆点 + 淡紫底——三层区分，一眼看出哪些还没看。
                        read
                          ? 'text-body text-muted transition-colors hover:text-accent hover:underline hover:decoration-accent hover:underline-offset-[5px]'
                          : 'text-body font-semibold text-fg underline decoration-rule underline-offset-[5px] transition-colors hover:text-accent hover:decoration-accent'
                      }
                    >
                      {highlight(row.title, query)}
                    </Link>
                  ) : (
                    // 没有链接的通知（合作联系留言）：点一下也能消掉未读
                    <button
                      type="button"
                      onClick={(event) => onTitleClick(event, row)}
                      className={
                        read
                          ? 'text-left text-body text-muted transition-colors hover:text-accent'
                          : 'text-left text-body font-semibold text-fg underline decoration-rule underline-offset-[5px] transition-colors hover:text-accent hover:decoration-accent'
                      }
                    >
                      {highlight(row.title, query)}
                    </button>
                  )}
                </span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
