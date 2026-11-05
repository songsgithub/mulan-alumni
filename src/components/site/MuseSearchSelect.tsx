'use client'

import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

interface MuseSelectOption {
  value: string
  label: string
}

const ALL_VALUE = '__all__'

/**
 * 公众站的可搜索下拉（Base UI Combobox）。
 *
 * 与站点长相一致：触发器是胶囊（44px 高、白底细边、ink 文字），
 * 弹层顶部一行放大镜 + 输入框，输入即过滤，↑↓ 选择、Enter 确认、Esc 关闭。
 *
 * 与工作台的 `console/SearchSelect` 分开：两边的 token（magnolia/ink ↔ accent/fg）、
 * 圆角与阴影口径不同，站点不混用工作台样式。
 */
export function MuseSearchSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  className,
  searchPlaceholder,
  emptyLabel = '没有匹配的地域',
}: {
  label: string
  value: string
  placeholder: string
  options: MuseSelectOption[]
  onChange: (v: string) => void
  className?: string
  searchPlaceholder?: string
  emptyLabel?: string
}) {
  const selected = options.find((option) => option.value === value)
  const allItem = { value: ALL_VALUE, label: placeholder }
  const items = [allItem, ...options]
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  // 有关键词时：匹配项在前，「全部区域」沉到最后（既是重置入口，也不抢第一条高亮）
  const matched = keyword ? options.filter((o) => o.label.toLowerCase().includes(keyword)) : options
  const filteredItems = keyword ? [...matched, allItem] : items
  const noMatch = Boolean(keyword) && matched.length === 0

  return (
    <Combobox.Root<string, false, MuseSelectOption>
      items={items}
      filteredItems={filteredItems}
      value={value || ALL_VALUE}
      onValueChange={(next) => onChange(next == null || next === ALL_VALUE ? '' : String(next))}
      onInputValueChange={(next) => setQuery(next)}
      // 打开时默认高亮第一条匹配项：键盘 ↓/↑ 移动、Enter 直接选中
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={label}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-full border border-line bg-white px-4 text-left text-[1rem] text-ink transition-colors hover:border-magnolia/50 focus-visible:border-magnolia/50 focus-visible:ring-[3px] focus-visible:ring-magnolia/15',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-ink-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-magnolia/70" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={6} className="z-50">
          <Combobox.Popup className="w-(--anchor-width) max-h-(--available-height) overflow-hidden rounded-[1rem] border border-line bg-white text-ink shadow-card">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <Combobox.Input
                placeholder={searchPlaceholder ?? '搜索…'}
                className="h-11 w-full min-w-0 flex-1 bg-transparent text-[1rem] !outline-none placeholder:text-ink-muted"
              />
            </div>
            {noMatch ? (
              <p className="px-4 py-5 text-center text-[1rem] text-ink-muted">{emptyLabel}</p>
            ) : null}
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto p-1.5">
              {(item: MuseSelectOption) => (
                <Combobox.Item
                  key={item.value}
                  value={item.value}
                  className="relative flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-2 pr-9 pl-3 text-left text-[1rem] break-words whitespace-normal text-ink select-none data-[highlighted]:bg-blush"
                >
                  <span className="absolute right-3 flex size-3.5 items-center justify-center">
                    <Combobox.ItemIndicator>
                      <Check className="size-4 text-magnolia" />
                    </Combobox.ItemIndicator>
                  </span>
                  {item.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
