import { cn } from '@/lib/utils'

/**
 * 数字木兰标识（官方 SVG 原图，`public/brand/mulan-logo.svg`）。
 *
 * 文件是横版组合标（记号 +「数字木兰校友会」），原图 1018.1 × 137.5（约 7.4 : 1），
 * 所以这里**只按高度缩放、宽度跟着比例走**——不要塞进正方形里，否则字会被压糊。
 *
 * ⚠️ **「糊」不是文件分辨率问题**：SVG 是矢量，浏览器按显示尺寸重新栅格化，永远清晰。
 * 看着糊是因为**新版标识的字重很粗**——同样高度下，笔画挤在一起、字内空隙被堵上，
 * 于是显得糊成一团。解法是**把它画大一点**（笔画之间的空隙才有像素），
 * 而不是去换更清晰的图。
 *
 * 深色底上（登录页左栏）传 `className="brightness-0 invert"` 变白。
 */
export function BrandMark({
  className,
  size = 38,
  alt = '',
}: {
  className?: string
  size?: number
  alt?: string
}) {
  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={cn('inline-flex shrink-0 items-center', className)}
      style={{ height: size }}
    >
      <img
        src="/brand/mulan-logo.svg"
        alt={alt}
        width={1018.1}
        height={137.5}
        className="h-full w-auto"
      />
    </span>
  )
}
