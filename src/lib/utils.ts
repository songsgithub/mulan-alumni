import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * 项目自定义的字号 token（globals.css 的 @theme --text-*）。
 *
 * ⚠️ 必须登记给 tailwind-merge：它不认识这些名字时，会把 `text-small` 当成**颜色**，
 * 遇到后面的 `text-muted` 就把它当成"冲突"删掉——结果字号整个丢了
 * （表头、徽标、页标题都回落成继承来的字号，2026-11-03 全站审计时发现）。
 * 新增 --text-* token 时，这里同步加一项。
 */
const FONT_SIZES = [
  'display-xl',
  'display-lg',
  'display-md',
  'title',
  'lead',
  'body',
  'small',
  'label',
  'eyebrow',
  'page-title',
  'stat',
  'brand-name',
  'auth-title',
  'hero',
  'hero-sub',
]

const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: FONT_SIZES },
  },
})

/** 合并 class（shadcn/ui 官方写法 + 本项目字号 token） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
