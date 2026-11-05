'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as echarts from 'echarts/core'
import { MapChart } from 'echarts/charts'
import { GeoComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import { Button } from '@/components/ui/button'
import type { CirclePoint, MapNode } from '@/lib/circle'

echarts.use([MapChart, GeoComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])



interface GeoFeature {
  properties: {
    adcode: number
    name: string
    level: string
    childrenNum: number
    centroid?: [number, number]
  }
}

const CHINA = { adcode: '100000', name: '中国' }

/**
 * 直辖市：省下面**直接就是区**，没有市级层。
 *
 * 数据里北京的 cityCode 是 `110100`（伪市级），那个 adcode 在 DataV 上并不存在——
 * 真按它去拉边界会 404/502，地图就停在半路。所以直辖市直接跳过市级层。
 */
const MUNICIPALITY_CODES = new Set(['110000', '120000', '310000', '500000'])

/**
 * 地图配色：与 globals.css 的品牌 token 同值（ECharts 画在 canvas 上，读不到 CSS 变量）。
 * 改主题色时两处一起改。
 */
const MAP_COLORS = {
  accent: '#6b4ae6',
  accentStrong: '#5a3bd4',
  muted: '#625c7a',
  land: '#f4f1fd',
  border: '#e7e2f5',
  hover: '#f1ecfe',
  filled: '#e6defd',
  filledBorder: '#cbbcf6',
  tooltip: 'rgba(36, 31, 61, 0.94)',
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

/**
 * 互助团分布地图。
 *
 * - 三级下钻：全国 → 省 → 市 → 区（县），**最小单位是区（县）**；
 * - 每个区域上标该区域内的互助团数量，筛选后数量随之变化；
 * - 边界数据来自 `/api/geo/[adcode]`（本地缓存优先，缺了现拉并落盘）。
 *
 * 层级（`path`）是**受控**的：父级（CircleNetwork）拿着它，
 * 这样"点地图 → 右侧列表按这个地域筛选"与"清除地域筛选 → 地图回到全国"才能对上。
 */
export function ChinaMap({
  points,
  focus = null,
  onFocusChange,
  path,
  onPathChange,
  scope = null,
  onRegionPick,
  height = 620,
}: {
  points: CirclePoint[]
  /** 列表点过来的那个团：地图自动下钻到它所在的区县并高亮 */
  focus?: CirclePoint | null
  onFocusChange?: (point: CirclePoint | null) => void
  /** 当前层级（受控）：全国 → 省 → 市 → 区（县） */
  path: MapNode[]
  onPathChange: (path: MapNode[]) => void
  /** 当前选中的地域（右侧列表按它筛选） */
  scope?: MapNode | null
  /** 点地图 / 面包屑 / 返回上一级 → 把选中的地域告诉父级 */
  onRegionPick?: (node: MapNode | null) => void
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const [geo, setGeo] = useState<{ features: GeoFeature[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * 窄屏（容器 < 480px）：地图只标**数量**，不标地名。
   *
   * 360px 的地图上写地名 = 一团互相压着的字（"内蒙古自治区""吉林省""北京"
   * 叠在一起），比不写还糟。手机上本来也点不准地图，地图只是个方位感，
   * 具体的团在下面的列表里。
   */
  const [narrow, setNarrow] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)

  const current = path[path.length - 1]

  /* ---- 列表 → 地图：下钻到那个区县并高亮 ---- */
  useEffect(() => {
    if (!focus) {
      setHighlight(null)
      return
    }
    const province = { adcode: focus.provinceCode, name: focus.province }
    // 直辖市没有市级层：省下面直接是区，不要去拉那个不存在的 110100
    const isMunicipality = MUNICIPALITY_CODES.has(String(focus.provinceCode ?? ''))
    const target =
      isMunicipality || !focus.cityCode || focus.cityCode === focus.provinceCode
        ? [province]
        : [province, { adcode: focus.cityCode, name: focus.city ?? '' }]
    onPathChange([CHINA, ...target])
    setHighlight(focus.districtCode || focus.cityCode || focus.provinceCode)
    // ⚠️ 这里**不**动地域筛选：点列表是"地图定位"，不是"按这个地域筛列表"
  }, [focus, onPathChange])

  /* ---------------------------------------------- 窄屏判定（容器宽度 < 480px） */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setNarrow(el.clientWidth < 480)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* ---------------------------------------------------------- 取边界数据 */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // 换层级时**先把上一级的边界清掉**：
    // 不清的话，旧边界会被注册成新层级的地图（`registerMap(新adcode, 旧边界)`），
    // 地图与层级对不上；拉取失败时更会一直错下去。
    setGeo(null)
    fetch(`/api/geo/${current.adcode}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`地图数据不可用（HTTP ${res.status}）`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setGeo(data)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? '地图数据加载失败')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [current.adcode])

  /* ------------------------------------------------- 每个区域的互助团数量 */
  const byCode = useMemo(() => {
    // 一个团同时登记了省 / 市 / 区县三个 adcode，
    // 地图停在任意一级时都能按 adcode 精确对上
    // （直辖市没有市级层：省 adcode 下面直接是区）。
    const map = new Map<string, CirclePoint[]>()
    for (const point of points) {
      for (const code of [point.provinceCode, point.cityCode, point.districtCode]) {
        if (!code) continue
        const list = map.get(code) ?? []
        list.push(point)
        map.set(code, list)
      }
    }
    return map
  }, [points])

  /* ------------------------------------------------------------- 画地图 */
  useEffect(() => {
    const el = containerRef.current
    if (!el || !geo) return

    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    echarts.registerMap(current.adcode, geo as never)

    const features = (geo.features ?? []) as GeoFeature[]
    const counts = new Map<string, number>()
    for (const f of features) {
      counts.set(String(f.properties.adcode), byCode.get(String(f.properties.adcode))?.length ?? 0)
    }

    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          borderWidth: 0,
          backgroundColor: MAP_COLORS.tooltip,
          textStyle: { color: '#fff', fontSize: 15 },
          formatter: (params: any) => {
            const adcode = String(params.data?.adcode ?? '')
            const list = byCode.get(adcode) ?? []
            // 提示框是 HTML：地名与团名一律转义后再拼
            const head = `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(params.name)}</div>`
            if (!list.length) {
              return `${head}<div style="opacity:.75">这里还没有互助团</div>`
            }
            const names = list
              .map((p) => `<div style="opacity:.9">· ${escapeHtml(p.name)}</div>`)
              .join('')
            return `${head}<div style="margin-bottom:6px">${list.length} 个互助团</div>${names}`
          },
        },
        series: [
          {
            type: 'map',
            map: current.adcode,
            roam: true,
            zoom: 1.08,
            scaleLimit: { min: 0.8, max: 6 },
            selectedMode: false,
            // 只标有互助团的区域（数量 + 地名）；没互助团的地方留给悬停提示，
            // 否则 35 个省名会互相压在一起，地图反而看不清重点。
            label: {
              show: true,
              formatter: (params: any) => {
                const adcode = String(params.data?.adcode ?? '')
                const n = counts.get(adcode) ?? 0
                if (!n) return ''
                // 窄屏只留数字（地名挤成一团反而看不清）
                return narrow ? `{n|${n}}` : `{n|${n}}\n{name|${params.name}}`
              },
              rich: {
                n: {
                  color: MAP_COLORS.accent,
                  fontSize: narrow ? 12 : 15,
                  fontWeight: 700,
                  lineHeight: narrow ? 15 : 18,
                  align: 'center',
                },
                name: {
                  color: MAP_COLORS.muted,
                  fontSize: 11,
                  lineHeight: 14,
                },
              },
            },
            // 团多起来后标签会挤在一起，交给 ECharts 自动隐藏重叠的那些
            labelLayout: { hideOverlap: true },
            itemStyle: {
              areaColor: MAP_COLORS.land,
              borderColor: MAP_COLORS.border,
              borderWidth: 1,
            },
            emphasis: {
              label: { show: true },
              itemStyle: { areaColor: MAP_COLORS.hover, borderColor: MAP_COLORS.accent },
            },
            data: features.map((f) => {
              const adcode = String(f.properties.adcode)
              const n = counts.get(adcode) ?? 0
              // 高亮两种：列表定位过来的那个区县，或当前选中的地域
              const isHighlight = adcode === highlight || (scope ? adcode === scope.adcode : false)
              return {
                name: f.properties.name,
                adcode,
                value: n,
                itemStyle: isHighlight
                  ? { areaColor: MAP_COLORS.accent, borderColor: MAP_COLORS.accentStrong }
                  : n
                    ? { areaColor: MAP_COLORS.filled, borderColor: MAP_COLORS.filledBorder }
                    : undefined,
                label: isHighlight
                  ? {
                      rich: {
                        n: {
                          color: '#ffffff',
                          fontSize: narrow ? 13 : 16,
                          fontWeight: 700,
                          lineHeight: narrow ? 16 : 19,
                          align: 'center',
                        },
                        name: { color: '#ffffff', fontSize: 11, lineHeight: 14 },
                      },
                    }
                  : undefined,
              }
            }),
          },
        ],
      },
      true,
    )

    const onClick = (params: any) => {
      const adcode = String(params.data?.adcode ?? '')
      const feature = features.find((f) => String(f.properties.adcode) === adcode)
      if (!feature) return
      const node: MapNode = { adcode, name: feature.properties.name }
      // 有下级（childrenNum > 0）才能继续下钻；区（县）是最小单位
      const drillable = Boolean(feature.properties.childrenNum)
      setHighlight(drillable ? null : adcode)
      onFocusChange?.(null)
      // 选中这个地域 → 右侧列表同步筛到这一片
      onRegionPick?.(node)
      if (drillable) {
        onPathChange([...path, node])
      }
    }
    chart.on('click', onClick)

    const onResize = () => {
      // 地图只是工作台里的一个展示件：**重画失败绝不能把整个页面带崩**。
      // 会翻车的两种情况：
      // 1. 图表已经被销毁（组件卸载、或热替换后重新挂载）——对着死实例 resize 会报错；
      // 2. ECharts 内部状态不一致时的重画异常（偶发，历史上报过
      //    "Cannot read properties of null (reading '0')"）。
      // 两种都在这里兜住：日志里留一笔，页面照常用。
      if (chart.isDisposed()) return
      try {
        chart.resize()
      } catch (err) {
        console.warn('地图重画失败', err)
      }
    }
    window.addEventListener('resize', onResize)
    // 容器尺寸变了（窗口、栅格、面板高度）也要跟着重画，只听 window 事件不够
    const observer = new ResizeObserver(onResize)
    observer.observe(el)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      if (!chart.isDisposed()) chart.off('click', onClick)
    }
  }, [geo, byCode, current.adcode, highlight, scope, path, narrow, onPathChange, onRegionPick, onFocusChange])

  /**
   * 组件卸载时销毁图表，**并把引用置空**。
   *
   * 不置空的话，重新挂载（路由切回来、或开发时热替换）会复用上一个
   * 已经销毁的实例——那是个死对象，setOption / resize 都会炸。
   */
  useEffect(
    () => () => {
      chartRef.current?.dispose()
      chartRef.current = null
    },
    [],
  )

  /**
   * 回到某一层级：地图换层级，右侧列表也跟着筛到这一层
   * （回到「中国」= 不按地域筛）。
   */
  const goToLevel = useCallback(
    (index: number) => {
      setHighlight(null)
      onFocusChange?.(null)
      const next = path.slice(0, index + 1)
      onPathChange(next)
      const last = next[next.length - 1]
      onRegionPick?.(last.adcode === CHINA.adcode ? null : last)
    },
    [path, onPathChange, onRegionPick, onFocusChange],
  )

  const canDrill = (current.adcode === CHINA.adcode) || (geo?.features ?? []).some((f) => f.properties.childrenNum > 0)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <nav aria-label="地图层级" className="flex flex-wrap items-center gap-2 text-small">
          {path.map((node, index) => (
            <span key={node.adcode} className="flex items-center gap-2">
              {index > 0 ? <span className="text-faint">/</span> : null}
              {index === path.length - 1 ? (
                <span className="font-semibold text-fg">{node.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => goToLevel(index)}
                  className="text-muted transition-colors hover:text-accent"
                >
                  {node.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        {/* 「返回上一级」的位置**从一开始就留好高度**：
            按钮出现 / 消失时这一行的高度不变，地图不会被顶下去（否则会跳一下） */}
        <div className="flex h-11 shrink-0 items-center justify-end gap-2">
          {path.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => goToLevel(path.length - 2)}
            >
              返回上一级
            </Button>
          ) : null}
        </div>
      </div>

      {/* 画布高度：窄屏压到 420px（一张地图不值得空滚 200px），
          桌面用调用方给的高度。断点写在 globals.css 里，尺寸只有一处。 */}
      <div
        className="relative flex-1 map-canvas"
        style={{ '--map-canvas-h': `${height}px` } as React.CSSProperties}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {loading ? (
          <p className="absolute inset-0 grid place-content-center text-body text-muted">
            正在加载地图…
          </p>
        ) : null}
        {error ? (
          <p className="absolute inset-0 grid place-content-center px-6 text-center text-body text-muted">
            {error}
            <span className="mt-2 block text-small text-faint">
              地图数据来自 DataV.GeoAtlas，需要能访问外网
            </span>
          </p>
        ) : null}
        {!loading && !error && !canDrill ? (
          <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-small text-muted">
            已到区（县）一级，这是地图的最小单位
          </p>
        ) : null}
        {/* 窄屏：地图上只标数量，这里补一句"团名在下面" */}
        {narrow && !loading && !error ? (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface px-4 py-2 text-small text-muted">
            窄屏只标数量，团名看下面的列表
          </p>
        ) : null}
      </div>
    </div>
  )
}
