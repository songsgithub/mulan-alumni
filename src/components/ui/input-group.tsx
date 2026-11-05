import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 放大镜图标的类名：所有搜索框（页面上的、弹层里的）统一用它，
 * 免得同一个图标在不同地方长得不一样。
 */
export const SEARCH_ICON_CLASS = "size-4 shrink-0 opacity-50"

/**
 * 输入组（shadcn/ui 官方 `input-group` 的做法）。
 *
 * 一个输入框里除了文字，还可以带**前/后缀**：筛选标记、清除按钮、图标。
 * 本项目里用它装「地域筛选标记 + 搜索框 + 清空」——
 * 标记写在框里比另起一行更省地方，读者也一眼知道正在搜哪一片。
 *
 * 尺寸口径与 `Input` 一致：框高 48px（输入框下限），字号 17px；外形是胶囊（与公开站的搜索框同一长相）。
 *
 * 焦点样式也**跟 `Input` 一样**：粗紫描边（2px 实线、外扩 3px）+ 焦点环。
 * 这套描边原本来自 globals.css 的全局 `:focus-visible`，但那条规则只作用在
 * 真正可聚焦的元素上——输入组的外层是 div，够不着，所以这里用 `focus-within:`
 * 手动补上（内层 input 另加 `!outline-none`，免得在框里又画出一个方框）。
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-12 w-full items-center gap-2 rounded-full border border-input bg-card px-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-2 focus-within:outline-solid focus-within:outline-accent focus-within:outline-offset-[3px]",
        className,
      )}
      {...props}
    />
  )
}

/** 输入组里的前缀 / 后缀位 */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  )
}

/**
 * 输入组里的输入框本体（无边框，靠外层 `InputGroup` 画框）。
 *
 * `!outline-none`：globals.css 的全局 `:focus-visible`（品牌色方框）**不在 Tailwind 分层里**，
 * 普通 `outline-none` 压不住它——点进输入框就会在**框里**画出一个紫色方框。
 * 粗紫描边与焦点环由外层 `InputGroup` 的 `focus-within:` 统一负责（见 `SearchSelect` 的 `COMBO_INPUT`）。
 */
function InputGroupInput({ className, type = "text", autoComplete = "off", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      autoComplete={autoComplete}
      data-slot="input-group-input"
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent px-2 text-body !outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupInput }
