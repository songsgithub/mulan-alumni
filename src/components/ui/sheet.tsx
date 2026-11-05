"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Sheet（抽屉 / 侧滑面板，Base UI 的 Dialog）。
 *
 * 移动端的标准做法：窄屏把导航这类"次级入口"收进抽屉，
 * 桌面端保持原来的横排导航。两边共用同一份数据，只换呈现方式。
 *
 * `side` 决定从哪边滑出：
 * - `left` / `right`：侧边导航抽屉（汉堡菜单）
 * - `bottom`：底部面板（活动进度这类"从底部升起"的清单）
 *
 * 底部面板额外做了三件手机上的事：
 * 1. 顶部留一条拖拽把手（视觉暗示"可以往上推"）；
 * 2. 高度上限 85dvh，**内部自己滚动**（页面本身不滚）；
 * 3. 底部留出 `env(safe-area-inset-bottom)`，避开 iPhone 的 home 指示条。
 */

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 fill-mode-forwards data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:animate-in data-[open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out fill-mode-forwards data-[closed]:duration-300 data-[open]:duration-500 data-[closed]:animate-out data-[open]:animate-in",
          side === "right" && "inset-y-0 right-0 h-full w-4/5 max-w-sm border-l",
          side === "left" && "inset-y-0 left-0 h-full w-4/5 max-w-sm border-r",
          side === "top" && "inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-block)] border-t data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-slot="sheet-close"
          className="ring-offset-background focus:ring-ring absolute top-3 right-3 grid size-11 place-content-center rounded-control opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <XIcon className="size-5" />
          <span className="sr-only">关闭</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 px-5 pt-5 pb-2", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-title font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-label text-muted", className)}
      {...props}
    />
  )
}

/** 底部面板顶部的拖拽把手：手机上的通用视觉暗示 */
function SheetHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-handle"
      aria-hidden
      className={cn("mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-rule", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHandle,
  SheetHeader,
  SheetTitle,
}
