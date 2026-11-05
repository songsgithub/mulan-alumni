'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** 日期选择（shadcn/ui Calendar + Popover） */
export function DatePicker({
  value,
  onChange,
  placeholder = '请选择日期',
  disabled,
  className,
}: {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            // 活动申请表（.activity-doc）里所有字段都是「Word 填空线」样式，
            // 这条钩子让日期框也归到同一条规则下（见 globals.css）
            data-date-picker=""
            className={cn(
              'h-12 w-full justify-start text-left text-body font-normal',
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-60" />
            {value ? format(value, 'yyyy年M月d日', { locale: zhCN }) : placeholder}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={zhCN}
        />
      </PopoverContent>
    </Popover>
  )
}
