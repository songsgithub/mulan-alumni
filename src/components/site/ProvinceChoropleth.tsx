'use client'

import { useEffect, useRef } from 'react'

import { CustomChart } from 'echarts/charts'
import { GeoComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import type { BoundaryLine } from '@/lib/china-geo'

echarts.use([CustomChart, GeoComponent, TooltipComponent, CanvasRenderer])

interface ProvinceDatum {
  /** 完整省名，与 GeoJSON 的 properties.name 一致（如 浙江省） */
  name: string
  count: number
  /** 该省下面的互助团：市 + 区/县全称、团名 */
  circles: { place: string; name: string }[]
}

/**
 * 互助团分布（按省填色）。
 *
 * 底图是天地图开发者中心下载的官方 GeoJSON（审图号 GS (2026) 4921号），
 * 我们只改填充色、加数量标签，不动边界；九段线单独作为线条叠加，保证整幅图完整。
 * 地图不开放拖拽/缩放——避免被裁成缺角的地图。
 */
const COLORS = ['#f3eeff', '#ded2fb', '#c1a9f6', '#9770f0', '#6b4ae6']

const colorFor = (value: number, max: number) => {
  if (!value) return COLORS[0]
  const ratio = max <= 1 ? 1 : value / max
  if (ratio > 0.75) return COLORS[4]
  if (ratio > 0.5) return COLORS[3]
  if (ratio > 0.25) return COLORS[2]
  return COLORS[1]
}

let registered = false

export function ProvinceChoropleth({
  geo,
  boundaryLines,
  data,
}: {
  geo: { type: 'FeatureCollection'; features: any[] }
  boundaryLines: BoundaryLine[]
  data: ProvinceDatum[]
}) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return

    if (!registered) {
      echarts.registerMap('china-tdt', geo as never)
      registered = true
    }

    // 复用同一个实例：StrictMode 会 mount 两次，重复 init 会叠出两块 canvas
    let chart = echarts.getInstanceByDom(el)
    if (!chart) chart = echarts.init(el)

    const max = Math.max(1, ...data.map((d) => d.count))
    const byName = new Map(data.map((d) => [d.name, d]))
    // 官方样式：默认实线细描；两个特殊要素用虚线（见 lib/china-geo.ts 注释）
    const lines = boundaryLines

    /** 悬停：省 · N 个互助团，下面按「市 + 区/县」全称列出团名 */
    const tooltipFormatter = (params: any) => {
      const item = byName.get(params.name)
      if (!item) return `${params.name}：暂无互助团`

      // ⚠️ 2026-11-03 第四十九轮：按**行政区**分组。
      //    - 团名一律换到地名**下一行**，**左对齐**（不再与地名挤在同一行）；
      //    - 同一个行政区下面有多个团时，**地名只显示一遍**，下面列出各团名。
      const groups = new Map<string, string[]>()
      for (const c of item.circles) {
        const list = groups.get(c.place)
        if (list) list.push(c.name)
        else groups.set(c.place, [c.name])
      }

      const rows = [...groups.entries()]
        .map(
          ([place, names]) =>
            // 层次（2026-11-03 第四十九轮之三）：
            //   地名 = 主项（淡紫、稍加粗），团名 = 次项（白色、常规字重）。
            //   只靠**字重 + 颜色**分层，不加 · 标记、不做缩进——那些更像列表目录，不像层级。
            `<li style="margin-top:12px">
               <div style="color:#d9c4ff;font-weight:600;white-space:normal;overflow-wrap:anywhere">${place}</div>
               ${names
                 .map(
                   (n) =>
                     `<div style="text-align:left;font-weight:400;color:rgba(255,255,255,.82);white-space:normal;overflow-wrap:anywhere;margin-top:3px">${n}</div>`,
                 )
                 .join('')}
             </li>`,
        )
        .join('')
      return `<div class="chor-tooltip-inner" style="min-width:230px;max-width:320px">
          <p style="font-size:16px;font-weight:600;margin:0">${item.name} · ${item.count} 个互助团</p>
          <ul style="list-style:none;margin:0;padding:0;font-size:15px;color:rgba(255,255,255,.88)">${rows}</ul>
        </div>`
    }

    const tooltipStyle = {
      className: 'chor-tooltip',
      backgroundColor: 'rgba(43,32,53,0.94)',
      borderWidth: 0,
      confine: true,
      padding: [12, 14],
      textStyle: { color: '#fff', fontSize: 15 },
      extraCssText: 'border-radius:14px;box-shadow:0 18px 40px -20px rgba(43,32,53,.6);',
    }

    const option: echarts.EChartsCoreOption = {
      tooltip: { trigger: 'item', ...tooltipStyle, formatter: tooltipFormatter },
      geo: {
        map: 'china-tdt',
        // 整幅国土必须完整可见：zoom 保持 1、禁止拖拽缩放，任何放大都会裁掉边界
        roam: false,
        zoom: 1,

        // geo 区域的 tooltip 要写在 geo 里，根节点的 formatter 对它不生效
        tooltip: { show: true, ...tooltipStyle, formatter: tooltipFormatter },
        itemStyle: {
          areaColor: COLORS[0],
          borderColor: '#b39af6',
          borderWidth: 0.8,
        },
        emphasis: {
          itemStyle: { areaColor: '#8a62f2' },
          label: { color: '#fff' },
        },
        label: {
          show: true,
          color: '#4b3b6b',
          fontSize: 11,
          formatter: (params: any) => {
            const item = byName.get(params.name)
            return item ? String(item.count) : ''
          },
        },
        regions: data.map((d) => ({
          name: d.name,
          itemStyle: { areaColor: colorFor(d.count, max) },
          label: {
            color: d.count / max > 0.5 ? '#ffffff' : '#3b2a5c',
            fontWeight: 600,
          },
        })),
      },
      series: [
        // 官方「境界线」：默认实线细描；156980000（深港）蓝虚线、156970000（新疆西端）白虚线
        {
          type: 'custom',
          coordinateSystem: 'geo',
          silent: true,
          zlevel: 0,
          data: lines.map((_, i) => i),
          renderItem: (params: any, api: any) => {
            const line = lines[params.dataIndex]
            // api.coord 在坐标系还没就绪（resize 过程中、容器宽高为 0）时会返回 null；
            // 把 null 点交给 polyline，ECharts 内部读 point[0] 就会抛错——先滤掉，不够两点就不画
            const points = (line?.coords ?? [])
              .map((p) => api.coord(p))
              .filter((pt: unknown): pt is number[] => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
            if (points.length < 2) return null
            const style = line?.dash
              ? {
                  // 官方：156980000 蓝虚线；156970000 白虚线（白线压掉省界，形成虚线）。
                  // 我们的底比官网浅，白色等于「背景色」，所以用底色画同一段虚线，效果一致
                  stroke: line.dash === 'blue' ? '#8a62f2' : COLORS[0],
                  lineWidth: 2,
                  lineDash: [5, 5],
                  fill: null,
                }
              : { stroke: '#b39af6', lineWidth: 0.8, opacity: 0.9, fill: null }
            return { type: 'polyline', shape: { points }, style }
          },
        },
      ],
    }

    chart.setOption(option, { notMerge: true })

    // 重画合并到下一帧；容器宽高为 0（隐藏 / 布局过渡中）时不重画。
    // 地图是展示件：重画失败只记一笔，绝不能把整页带崩（与工作台 ChinaMap 同一口径）
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!chart || chart.isDisposed() || !el.clientWidth || !el.clientHeight) return
        try {
          chart.resize()
        } catch (err) {
          console.warn('地图重画失败', err)
        }
      })
    })
    observer.observe(el)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      // 容器已经离开文档（真的卸载了）才销毁；StrictMode 的假卸载要留住实例
      if (!el.isConnected) chart?.dispose()
    }
  }, [geo, boundaryLines, data])

  return <div ref={box} className="h-full min-h-[280px] w-full rounded-[1.25rem]" />
}
