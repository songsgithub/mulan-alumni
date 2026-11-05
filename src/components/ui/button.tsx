import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"

/**
 * 尺寸口径（工作台硬约束）：可点区域**不小于 44px**、字号 16px。
 * shadcn 默认的 36px / 14px 对 27–55 岁的读者太小，这里统一改掉，页面不必再逐个覆盖。
 *
 * 长相与公开站的 museButton 一致（胶囊 + 柔光影 + 悬停轻浮，300ms ease-soft）。
 *
 * ⚠️ 配色：本项目的 `accent` 是品牌强调色（紫），不是 shadcn 原意的「浅灰悬停底」。
 * 所以 outline / ghost 的悬停用 `console-accent`（浅紫底）+ 品牌紫字，
 * 不能写 `hover:bg-accent`——那会变成紫底黑字，对比度只有 2.8:1。
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-small font-medium whitespace-nowrap transition-all duration-300 ease-soft outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:translate-y-0 active:opacity-90 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // 与公开站 museButton('hero') 同一长相：品牌紫胶囊 + 同色柔光影，悬停轻浮
        default:
          "bg-primary text-primary-foreground shadow-button-accent hover:-translate-y-0.5 hover:bg-accent-strong",
        destructive:
          "bg-destructive text-white shadow-button-danger hover:-translate-y-0.5 hover:bg-destructive/90 focus-visible:ring-destructive/30",
        // 与公开站 museButton('outline') 同一长相
        outline:
          "border border-rule bg-white/80 text-fg backdrop-blur hover:border-accent/40 hover:text-accent",
        // 与公开站 museButton('secondary') 同一长相
        secondary:
          "bg-accent-soft text-primrose-fg hover:bg-tape",
        ghost:
          "text-fg hover:bg-console-accent hover:text-accent",
        link: "text-accent underline-offset-4 hover:text-accent-strong hover:underline",
      },
      size: {
        // 没有小于 44px 的档位：以前的 xs（36px）/ icon-xs（36px）已删除——
        // 它们正是全站多处"点不到"的源头。紧凑场景用 sm（同样 44px，只是内边距更小）。
        default: "h-11 px-5 has-[>svg]:px-4",
        sm: "h-11 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 px-6 text-body has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * 按钮（Base UI）。
 *
 * 要把按钮变成链接时用 `render`，不再用 `asChild`：
 * `<Button render={<Link href="/x" />}>去看看</Button>`
 * 渲染成非 button 元素时自动关闭原生 button 语义。
 */
function Button({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants>) {
  const isNativeButton =
    !React.isValidElement(render) || (render.type as string) === "button"

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      nativeButton={isNativeButton}
      render={render}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
