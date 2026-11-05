'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { SearchField } from '@/components/console/SearchField'

/**
 * 页面级搜索框（写地址版）：与 `/circles`、`/notifications` 同一个长相与手感。
 *
 * 服务端只传**地址骨架**（`baseHref`：当前筛选 + 视图，不含 q），
 * 关键词由这里自己拼进去——函数不能从服务端组件传到客户端组件。
 * 输入防抖 300ms 后写地址；清空 = 从地址里去掉 q。
 */
export function UrlSearchField({
  value,
  baseHref,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  /** 当前筛选的地址骨架（不含 q） */
  baseHref: string
  placeholder: string
  ariaLabel?: string
  className?: string
}) {
  const router = useRouter()
  const [keyword, setKeyword] = useState(value)
  // 最后一次写进地址的关键字：分辨「服务端回传」与「用户正在输入」
  const pushed = useRef(value)

  useEffect(() => {
    if (value === pushed.current) return
    pushed.current = value
    setKeyword(value)
  }, [value])

  useEffect(() => {
    if (keyword === value) return
    const timer = setTimeout(() => {
      pushed.current = keyword
      const url = new URL(baseHref, window.location.origin)
      if (keyword.trim()) url.searchParams.set('q', keyword.trim())
      else url.searchParams.delete('q')
      router.push(`${url.pathname}${url.search}`, { scroll: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword, value, baseHref, router])

  return (
    <SearchField
      value={keyword}
      onChange={setKeyword}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
    />
  )
}
