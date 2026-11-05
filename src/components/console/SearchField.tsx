'use client'

import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput, SEARCH_ICON_CLASS } from '@/components/ui/input-group'

/**
 * 页面级搜索框（管理端**统一长相**）。
 *
 * 口径：**放大镜在左、清空在右**，中间是输入框。
 * 与弹层里那行搜索（`ComboSearchRow`）是同一套：同样的放大镜、同样的输入框高度、
 * 同样的「搜…」提示词格式——全站只有一个搜索框长相。
 *
 * 用它的三处：互助团列表（/circles）、全部互助团名录（/circles/all）、资源与图片搜索。
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel = '搜索',
  leading,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
  /** 输入框左边的额外内容（如地图选中的地域标记） */
  leading?: ReactNode
  className?: string
}) {
  const clear = () => onChange('')

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <Search aria-hidden className={SEARCH_ICON_CLASS} />
      </InputGroupAddon>
      {leading}
      <InputGroupInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') clear()
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <Button type="button" variant="ghost" size="icon-sm" onClick={clear} aria-label="清空搜索">
            <X />
          </Button>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
