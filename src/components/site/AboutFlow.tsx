'use client'

import { useEffect, useRef, useState } from 'react'

import { site } from '@/content/site'

/**
 * 互助团落地路径 —— 按 `docs/SOP/process.png` 的**逻辑**画的流程图，
 * 但**视觉语言用站里那一套**：白卡片（圆角 + 淡描边 + 柔光影）、品牌紫箭头、
 * 紫色胶囊标签、虚线回路。
 *
 * ⚠️ 文字全部来自 `docs/SOP/about&contactpages.docx`（存在 `site.about.path`），
 *    这里只负责画：
 *    - 主链：成立互助小组 → 结合姐妹需求 → 申请活动预算 →（审核通过）→ 按照活动计划
 *            → 按场次反馈 → 申请报销；
 *    - 回路一：申请活动预算 --审核未通过，调整计划重新申请--> 回到 结合姐妹需求；
 *    - 回路二：申请报销 --根据场次按照时间继续开展--> 回到 按照活动计划。
 *
 * ⚠️ **字号口径（2026-11-03 第四十九轮）**：流程图里的字与同页【激励机制】等
 *    小标题一样大（`h3` 的 `1.1875rem` = **19px**），不加粗（`fontWeight: 400`）。
 *    为了保证 19px 就是**屏幕上真实的 19px**（不会被容器缩放放大或缩小），
 *    这里**不写 `w-full`**，改成按容器实际宽度算好间距后 1:1 出图：
 *    容器变宽 → 箭头之间的间距变宽，盒子与文字的尺寸不变。
 */

/** 盒子的尺寸与间距（SVG 视图坐标，与 CSS 像素 1:1） */
const BOX_W = 162
const BOX_H = 62
const BOX_TOP = 10
/** 普通箭头留的间距 */
const GAP = 30
/** 「审核通过」那段留宽一点，胶囊才放得下 */
const GAP_APPROVE = 150
/** 返回路径横线的位置 */
const LOOP_Y = 108
/**
 * 流程图里的字号：与同页小标题（`h3` 的 `1.1875rem`）一致。
 * 盒子最宽的一行是 7 个字（「确定互助小组长」），7 × 19 = 133 < BOX_W(162)，放得下。
 */
const FONT_SIZE = 19
/** 多行文字的行距 */
const LINE_GAP = 25
/** 站点配色（与 globals.css 的 token 一致） */
const INK = '#241f3d'
const MAGNOLIA = '#6b4ae6'
const MAGNOLIA_SOFT = '#f1ecfe'
const LINE = '#e7e2f5'

export function AboutFlow() {
  const { steps, approve, loops } = site.about.path

  // 容器实际宽度：用来把多余的横向空间分给箭头间距，保证 1:1 渲染
  const scrollRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setAvailable(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 盒子的横坐标：第 approve.after 步之后用宽间距
  const baseGaps = steps.slice(0, -1).map((_, i) => (i === approve.after ? GAP_APPROVE : GAP))
  const baseWidth = steps.length * BOX_W + baseGaps.reduce((a, b) => a + b, 0)
  // 多出来的宽度平均分给各段间距（盒子与文字尺寸不变）
  const extra = Math.max(0, (available || baseWidth) - baseWidth)
  const extraPerGap = baseGaps.length ? extra / baseGaps.length : 0

  const xs: number[] = []
  let cursor = 0
  steps.forEach((_, i) => {
    xs.push(cursor)
    cursor += BOX_W + (baseGaps[i] ?? GAP) + extraPerGap
  })
  const width = xs[xs.length - 1] + BOX_W
  const center = (i: number) => xs[i] + BOX_W / 2
  const boxBottom = BOX_TOP + BOX_H

  /** 胶囊标签：按字数算宽度（中文一个字约等于一个字宽） */
  const pill = (text: string) => ({
    w: text.length * FONT_SIZE + 20,
    h: FONT_SIZE + 9,
    fontSize: FONT_SIZE,
  })

  // 视图高度：回路标签整块压在横线上，下方只留半块高度
  const LABEL_GAP = 4
  const loopBlocks = loops.map((loop) => {
    const ps = loop.lines.map((line) => pill(line))
    return { ps, blockH: ps.length * ps[0].h + (ps.length - 1) * LABEL_GAP }
  })
  const maxBlockH = Math.max(...loopBlocks.map((b) => b.blockH))
  const height = LOOP_Y + maxBlockH / 2 + 14

  return (
    <div>
      {/* 窄屏横向滚动：流程图本身不缩小（缩小了字就小于 19px 了） */}
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`互助团落地路径：${steps.map((s) => s.lines.join('')).join(' → ')}；${approve.label}；${loops
            .map((l) => l.lines.join(''))
            .join('；')}`}
          className="block font-display"
          style={{ width, height }}
        >
          <defs>
            <marker
              id="about-flow-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={MAGNOLIA} />
            </marker>
            {/* 卡片柔光影：跟站里 shadow-card 一个意思 */}
            <filter id="about-flow-shadow" x="-25%" y="-30%" width="150%" height="170%">
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="7"
                floodColor="#3c288c"
                floodOpacity="0.13"
              />
            </filter>
          </defs>

          {/* 主链的盒子（白卡片） */}
          {steps.map((step, i) => (
            <g key={step.lines.join('-')}>
              <rect
                x={xs[i]}
                y={BOX_TOP}
                width={BOX_W}
                height={BOX_H}
                rx={13}
                fill="#ffffff"
                stroke={LINE}
                strokeWidth={1}
                filter="url(#about-flow-shadow)"
              />
              {step.lines.map((line, j) => (
                <text
                  key={line}
                  x={center(i)}
                  y={BOX_TOP + BOX_H / 2 + (j - (step.lines.length - 1) / 2) * LINE_GAP}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={INK}
                  fontSize={FONT_SIZE}
                  fontWeight={400}
                >
                  {line}
                </text>
              ))}
            </g>
          ))}

          {/* 主链的箭头（「审核通过」那段：标签压在箭头中间） */}
          {steps.slice(0, -1).map((_, i) => (
            <line
              key={`arrow-${i}`}
              x1={xs[i] + BOX_W + 4}
              y1={BOX_TOP + BOX_H / 2}
              x2={xs[i + 1] - 10}
              y2={BOX_TOP + BOX_H / 2}
              stroke={MAGNOLIA}
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#about-flow-arrow)"
            />
          ))}

          {/* 「审核通过」：紫色胶囊，压在第 approve.after 步之后那段箭头的中间 */}
          {(() => {
            const p = pill(approve.label)
            const midX = (xs[approve.after] + BOX_W + 4 + xs[approve.after + 1] - 10) / 2
            const midY = BOX_TOP + BOX_H / 2
            return (
              <g>
                <rect
                  x={midX - p.w / 2}
                  y={midY - p.h / 2}
                  width={p.w}
                  height={p.h}
                  rx={p.h / 2}
                  fill={MAGNOLIA_SOFT}
                />
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={MAGNOLIA}
                  fontSize={p.fontSize}
                  fontWeight={400}
                >
                  {approve.label}
                </text>
              </g>
            )
          })()}

          {/* 返回路径：从来源框底部往下 → 向左 → 再向上指回目标框（虚线） */}
          {loops.map((loop, li) => {
            const fromX = center(loop.from)
            const toX = center(loop.to)
            const midX = (fromX + toX) / 2
            const { ps, blockH } = loopBlocks[li]
            const lineH = ps[0].h
            const gapY = 4
            const blockW = Math.max(...ps.map((p) => p.w))
            // 标签**整体**压在横线的中间（把线挡在后面），跟「审核通过」一个处理
            const top = LOOP_Y - blockH / 2
            return (
              <g key={loop.lines.join('-')}>
                <path
                  d={`M ${fromX} ${boxBottom} V ${LOOP_Y} H ${toX} V ${boxBottom + 10}`}
                  fill="none"
                  stroke={MAGNOLIA}
                  strokeWidth={2}
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#about-flow-arrow)"
                />
                <rect
                  x={midX - blockW / 2}
                  y={top}
                  width={blockW}
                  height={blockH}
                  rx={lineH / 2 + 4}
                  fill={MAGNOLIA_SOFT}
                />
                {loop.lines.map((line, j) => (
                  <text
                    key={line}
                    x={midX}
                    y={top + j * (lineH + gapY) + lineH / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={MAGNOLIA}
                    fontSize={ps[j].fontSize}
                    fontWeight={400}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <p className="mt-1 text-[0.9375rem] text-ink-muted sm:hidden">← 左右滑动可看完整流程 →</p>
    </div>
  )
}
