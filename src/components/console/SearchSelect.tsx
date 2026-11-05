'use client'

import * as React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'

import { SEARCH_ICON_CLASS } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

interface SearchSelectOption {
  value: string
  label: string
}

const ALL_VALUE = '__all__'

/**
 * 下拉面板（弹层）：白底、细边、6px 圆角、中号阴影，与 shadcn Select 的面板同一套。
 * 宽度与触发框严格相同（`--anchor-width`），长选项换行。地域、互助团、入会页共用。
 */
export const COMBO_PANEL =
  'z-50 w-(--anchor-width) max-h-(--available-height) overflow-hidden rounded-[1rem] border border-rule bg-popover text-popover-foreground shadow-card origin-(--transform-origin) fill-mode-forwards data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95'

/**
 * 选项行：与 Select 选项同高（44px）、同字号、同高亮色（米色，不用品牌红）。
 */
export const COMBO_ITEM =
  'relative flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[0.75rem] py-2 pr-8 pl-3 text-left break-words whitespace-normal text-body outline-hidden select-none data-[highlighted]:bg-console-accent data-[highlighted]:text-fg data-[disabled]:opacity-50'

/** 搜索框：去掉全局焦点环（否则是品牌红的方框）。`!` 因为 globals.css 的 `:focus-visible` 不在 Tailwind 分层里。 */
export const COMBO_INPUT =
  'h-10 w-full min-w-0 flex-1 bg-transparent text-body !outline-none placeholder:text-muted-foreground'

/** 筛选触发框：胶囊（与筛选条里的下拉、搜索框、公开站筛选条同一长相），地域与互助团共用。 */
export const FIELD_TRIGGER =
  'flex h-12 w-full items-center justify-between gap-2 rounded-full border border-input bg-card px-4 text-left text-body font-normal text-fg shadow-xs outline-none transition-[color,box-shadow] hover:text-fg focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0'

/** 弹层顶部的搜索行：放大镜 + 输入框，与列表之间一条细线 */
const COMBO_SEARCH_ROW = 'flex items-center gap-2 border-b border-rule px-3'

/**
 * 弹层里的搜索行：**放大镜 + 输入框**，所有可搜索下拉共用。
 *
 * 提示词统一成「搜索X…」的格式（地域 = 搜索地域…、互助团 = 搜索互助团…），
 * 只差对象名，不再一个写「搜索地名…」、另一个写「输入关键词搜索…」。
 */
export function ComboSearchRow({ placeholder }: { placeholder: string }) {
  return (
    <div className={COMBO_SEARCH_ROW}>
      <Search className={SEARCH_ICON_CLASS} />
      <Combobox.Input placeholder={placeholder} className={COMBO_INPUT} />
    </div>
  )
}

/**
 * 可输入筛选的下拉（Base UI Combobox）。
 * 触发按钮 + 弹层里的搜索框：输入即过滤，↑↓ 选择，Enter 确认，Esc 关闭。
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled,
  allowEmpty = false,
  emptyLabel = '全部',
  className,
  label,
  searchPlaceholder,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  label?: string
  /** 弹层里那个搜索框的提示词（统一成「搜索X…」） */
  searchPlaceholder?: string
}) {
  const selected = options.find((option) => option.value === value)
  const items = allowEmpty
    ? [{ value: ALL_VALUE, label: emptyLabel }, ...options]
    : options

  return (
    <Combobox.Root
      items={items}
      value={value ? value : allowEmpty ? ALL_VALUE : null}
      onValueChange={(next) => {
        const v = next == null || next === ALL_VALUE ? '' : String(next)
        onChange(v)
      }}
      disabled={disabled}
    >
      <Combobox.Trigger
        aria-label={label ?? placeholder}
        className={cn(FIELD_TRIGGER, !selected && 'text-muted-foreground', className)}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className={COMBO_PANEL}>
            <ComboSearchRow placeholder={searchPlaceholder ?? '搜索…'} />
            <Combobox.Empty className="empty:hidden px-3 py-6 text-center text-body text-muted">
              没有匹配项
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto p-1">
              {(item: SearchSelectOption) => (
                <Combobox.Item key={item.value} value={item.value} className={COMBO_ITEM}>
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <Combobox.ItemIndicator>
                      <Check className="size-4" />
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
