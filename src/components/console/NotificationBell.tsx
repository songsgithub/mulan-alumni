"use client"

import { EmptyState } from '@/components/console/EmptyState'
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Bell, CheckCheck } from "lucide-react"

import { markAllNotificationsRead, markNotificationsRead } from "@/app/(admin)/(workspace)/actions"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  title: string
  link?: string | null
  read?: boolean
  createdAt?: string
}

/** 通知时间：固定按北京时间格式化，服务端与浏览器渲染出同一串字（不会水合不一致） */
const TIME = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const formatTime = (value?: string) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : TIME.format(date)
}

/** 只跟站内路径（/activities/…），不跟外链与伪协议 */
const safeLink = (link?: string | null) => (link && /^\/(?!\/)/.test(link) ? link : null)

/** 单条通知 id → 服务端动作要用的 FormData */
const idPayload = (id: string) => {
  const data = new FormData()
  data.append("id", id)
  return data
}

/** 未读数轮询间隔：通知不需要秒级到达，60 秒一次；标签页隐藏时不查 */
const POLL_MS = 60_000

/**
 * 工作台右上角的通知铃铛。
 *
 * 未读数在铃铛角上（**真实未读总数**，不是弹层那 10 条的未读数）；
 * 点开列出最近的站内通知（活动审批 / 报销审核结果 / 合作留言），
 * 点某一条：标记已读并跳到活动页——**没有跳转地址的（合作留言）点一下也标已读**，
 * 不然这一条永远消不掉未读。有未读时可以一键全部标为已读（服务端按全量处理）。
 *
 * 自动刷新：每 60 秒轻量查一次未读数（只返回一个数字）；数字变了才刷新页面数据，
 * 没有变化就什么都不做，所以常态下几乎没有开销。
 */
export function NotificationBell({
  records,
  unreadCount = 0,
}: {
  records: NotificationItem[]
  /** 未读**总数**（服务端算的）：弹层只带最近 10 条，角标不能拿这 10 条的未读数顶上 */
  unreadCount?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const unread = records.filter((r) => !r.read)

  // 角标数字：先取服务端给的未读总数，轮询到新数字后以轮询结果为准
  const [count, setCount] = useState(unreadCount)
  const countRef = useRef(count)
  countRef.current = count
  // 页面数据刷新后（records 变了），角标跟上服务端给的总数
  useEffect(() => {
    setCount(unreadCount)
  }, [unreadCount])

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
          credentials: "same-origin",
        })
        // 会话失效：刷新一下，布局会把人送回登录页
        if (res.status === 401) {
          router.refresh()
          return
        }
        if (!res.ok) return
        const { count: next } = (await res.json()) as { count: number }
        if (next !== countRef.current) {
          countRef.current = next
          setCount(next)
          // 有新通知或别处已读：刷新页面数据，列表与角标一起更新
          router.refresh()
        }
      } catch {
        // 网络抖动：下一轮再查
      }
    }
    const timer = window.setInterval(check, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [router])

  const markRead = (ids: string[]) => {
    if (!ids.length) return
    const data = new FormData()
    ids.forEach((id) => data.append("id", id))
    startTransition(async () => {
      await markNotificationsRead(data)
      router.refresh()
    })
  }

  /**
   * 「全部已读」清的是**全部**未读，不只是弹层里加载的最近 10 条。
   *
   * 以前是把弹层里那几条 id 传回服务端：未读超过 10 条时，角标清了一半，
   * 数字却还是真实总数，对不上。现在服务端按「收件人 = 我 且 未读」全量处理。
   */
  const markAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead()
      router.refresh()
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={count ? `通知，${count} 条未读` : "通知"}
            className="relative"
          >
            <Bell className="size-5" />
            {count ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-label font-bold leading-none text-white ring-2 ring-white tabular-nums">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between border-b border-rule px-4 py-2">
          <span className="text-body font-semibold">通知</span>
          {count ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={markAllRead}
            >
              <CheckCheck aria-hidden />
              全部已读
            </Button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {records.length ? (
            <ul className="space-y-0.5">
              {records.map((item) => {
                const href = safeLink(item.link)
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      {!item.read ? (
                        <span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-accent" />
                      ) : null}
                      <span className={cn("min-w-0", !item.read && "font-semibold")}>{item.title}</span>
                    </span>
                    <span className={cn("text-small text-muted", !item.read && "pl-4")}>
                      {formatTime(item.createdAt)}
                      {!item.read ? <span className="sr-only">，未读</span> : null}
                    </span>
                  </>
                )
                return (
                  <li key={item.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={(event) => {
                          // 已读的照常跳转；未读的先标已读再跳，
                          // 否则跳转会把还没落库的动作打断——角标消不掉。
                          if (item.read) return
                          if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey ||
                            event.button !== 0
                          ) {
                            void markRead([item.id])
                            return
                          }
                          event.preventDefault()
                          setOpen(false)
                          startTransition(async () => {
                            await markNotificationsRead(idPayload(item.id))
                            router.push(href)
                          })
                        }}
                        className="flex flex-col gap-0.5 rounded-control px-3 py-2.5 text-body leading-7 transition-colors hover:bg-console-accent"
                      >
                        {body}
                      </Link>
                    ) : (
                      // 没有跳转地址的通知（合作联系留言）：也要能点，
                      // 否则这一条永远消不掉未读——只能去通知页处理。
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          if (!item.read) markRead([item.id])
                        }}
                        className="flex w-full flex-col gap-0.5 rounded-control px-3 py-2.5 text-left text-body leading-7 transition-colors hover:bg-console-accent"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState compact title="还没有通知" hint="审批与报销结果会出现在这里" />
          )}
        </div>
        <div className="border-t border-rule px-2 py-1.5 text-right">
          <Button render={<Link href="/notifications" onClick={() => setOpen(false)} />} variant="ghost" size="sm">
            全部通知 →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
