"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * 复选框（Base UI）。
 *
 * 触控区 44×44（size-11），方框本体 24×24（size-6）——
 * 满足「控件不小于按钮 44px」，视觉上仍是常规复选框大小。
 * Base UI 自己会在旁边渲染隐藏的 input，`name` / `value` 直接提交。
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group grid size-11 shrink-0 place-content-center rounded-md outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        data-slot="checkbox-box"
        className="grid size-6 place-content-center rounded-[4px] border border-input bg-background shadow-xs transition-colors group-data-[checked]:border-primary group-data-[checked]:bg-primary group-data-[checked]:text-primary-foreground"
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none"
        >
          <CheckIcon className="size-4" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
