'use client'

import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * 视图切换（链接型分页签）：与资源页、经费页同一套 Tabs。
 *
 * 选中项写进地址（由调用方给 href），刷新 / 分享都是同一屏；
 * 不用自己拼胶囊按钮——那是另一套长相。
 */
export function LinkTabs({
  value,
  items,
  ariaLabel,
}: {
  value: string
  /** count：标签后面的数量（如「全部 9」），数字用等宽、弱一档 */
  items: { value: string; label: string; href: string; count?: number }[]
  ariaLabel?: string
}) {
  const router = useRouter()

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const target = items.find((item) => item.value === next)
        if (target && next !== value) router.push(target.href, { scroll: false })
      }}
      aria-label={ariaLabel}
    >
      <TabsList>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1.5 font-normal tabular-nums opacity-70">{item.count}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
