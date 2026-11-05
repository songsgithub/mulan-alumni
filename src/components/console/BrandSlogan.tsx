import { cn } from '@/lib/utils'

/**
 * 品牌标语「AI时代 木兰同行」（`public/brand/slogan.svg`）。
 *
 * ⚠️ **这个文件不是矢量**：它是 SVG 外壳里内嵌了一张 1551×307 的 PNG
 * （透明底，base64 内嵌，所以文件有 100KB，0 条 path）。
 * 后果：
 * - 顶栏里只能按**高度**缩放（28px 高 ≈ 141px 宽 = 源图缩到 1/11），
 *   边缘是位图缩出来的软边，比矢量标识毛；
 * - 真要完全清晰，得让设计再导一份纯 path 的矢量版（Illustrator 里那份是有的，
 *   现在这份是「嵌入」而不是「转曲」）。
 *
 * 用法：跟标识并排放在顶栏品牌区（标识后面）。
 */
export function BrandSlogan({
  className,
  size = 28,
}: {
  className?: string
  /** 高度（px）；宽度按 1560 : 310 的比例自动跟 */
  size?: number
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} style={{ height: size }}>
      <img
        src="/brand/slogan.svg"
        alt="AI时代 木兰同行"
        width={1560}
        height={310}
        className="h-full w-auto"
      />
    </span>
  )
}
