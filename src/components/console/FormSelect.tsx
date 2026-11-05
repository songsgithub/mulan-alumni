'use client'

import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FormSelectOption {
  value: string
  label: string
  disabled?: boolean
}

/**
 * 「不设置」选项用的哨兵值。
 *
 * ⚠️ Base UI 的 Select 不接受空字符串作为选项值（空串 = 未选），
 *    所以「清空」用一个哨兵表示；服务端 `resolveId()` 会把它当成 `null`（未指定）。
 */
const CLEAR_VALUE = '__none__'

/**
 * 表单用的下拉框（Base UI Select）。
 *
 * 传 `name` 后 Base UI 会自己渲染隐藏的 input，调用方照旧用 `formData.get('name')` 读取。
 * 空值用 `null` 表示「未选」，此时显示 placeholder。
 *
 * ⚠️ 2026-11-04：**placeholder 只是「未选时的提示文字」，不是一个可选项**——
 *    用户没法「选」它。以前报销审核负责人说「可以设为空」但实际做不到，
 *    就是因为只有 placeholder、没有「不设置」这一项。
 *    现在传 `clearable="不设置"` 就会在列表最前面多出这一项。
 */
export function FormSelect({
  name,
  options,
  placeholder = '请选择',
  defaultValue = '',
  value: controlledValue,
  required = false,
  disabled = false,
  clearable,
  onValueChange,
  className,
  contentClassName,
}: {
  name: string
  options: FormSelectOption[]
  placeholder?: string
  defaultValue?: string
  /** 受控值；不传则用 defaultValue 维护内部状态 */
  value?: string
  required?: boolean
  disabled?: boolean
  /** 传了就在列表最前面加一个「不设置」项（值是 `CLEAR_VALUE`） */
  clearable?: string
  onValueChange?: (value: string) => void
  className?: string
  contentClassName?: string
}) {
  const [innerValue, setInnerValue] = useState(defaultValue)
  const value = controlledValue ?? innerValue

  // 「不设置」排在最前面
  const allOptions: FormSelectOption[] = clearable
    ? [{ value: CLEAR_VALUE, label: clearable }, ...options]
    : options

  return (
    <Select
      name={name}
      items={allOptions.map((o) => ({ value: o.value, label: o.label }))}
      value={value || null}
      required={required}
      disabled={disabled}
      onValueChange={(next) => {
        const v = next ?? ''
        setInnerValue(v)
        onValueChange?.(v)
      }}
    >
      <SelectTrigger className={className ?? 'w-full'} aria-label={placeholder} data-select={name}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {allOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
