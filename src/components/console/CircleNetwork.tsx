'use client'

import { useCallback, useMemo, useState } from 'react'

import { ChinaMap } from '@/components/console/ChinaMap'
import { CohortList } from '@/components/console/CohortList'
import type { CirclePoint, MapNode } from '@/lib/circle'

/** 全国：地图的顶层，也是"不按地域筛"的状态 */
const CHINA: MapNode = { adcode: '100000', name: '中国' }

/**
 * 互助团是否落在这个地域里。
 *
 * 一个团同时登记了省 / 市 / 区县三个 adcode，地图停在任意一级都能精确对上
 * （直辖市没有市级层：省 adcode 下面直接是区）。
 */
function inRegion(point: CirclePoint, adcode: string): boolean {
  return (
    point.provinceCode === adcode || point.cityCode === adcode || point.districtCode === adcode
  )
}

/**
 * 互助团网络：左边地图 + 右边列表，两者**联动**。
 *
 * 点列表里的一个团 → 地图自动下钻到它所在的区县并高亮；
 * 点地图上的一个区域 → 右侧列表同步筛到这一片（可清除）。
 * 几百个团的时候，这是唯一"地图和列表是一回事"的感觉。
 */
export function CircleNetwork({
  points,
  canManage = false,
  pageSize,
  actionLabel,
  allHref,
}: {
  points: CirclePoint[]
  canManage?: boolean
  pageSize?: number
  actionLabel?: string
  /** 右侧列表已全部列出时，底部「全部互助团」的入口 */
  allHref?: string
}) {
  const [focus, setFocus] = useState<CirclePoint | null>(null)
  /** 地图层级（受控传给地图）：全国 → 省 → 市 → 区（县） */
  const [path, setPath] = useState<MapNode[]>([CHINA])
  /** 当前选中的地域：右侧列表按它筛选 */
  const [scope, setScope] = useState<MapNode | null>(null)

  /** 按选中的地域筛过的团（地图下钻后，右边只剩这一片） */
  const visible = useMemo(
    () => (scope ? points.filter((point) => inRegion(point, scope.adcode)) : points),
    [points, scope],
  )

  /** 清除地域筛选：列表回到全部，地图也回到全国 */
  const clearScope = useCallback(() => {
    setScope(null)
    setPath([CHINA])
    setFocus(null)
  }, [])

  return (
    // `grid-cols-1`：显式给一列 minmax(0,1fr)。不写的话是 auto 轨道，
    // 会被地图容器的内容撑到 450px，整页横向溢出（手机上最明显）。
    // `xl:h-full`：只有宽屏（两栏 + 右侧独立滚动）才把高度锁死；
    // 窄屏（<1280px，含 1024–1280 的平板横屏）让页面自己滚。
    <div className="grid min-h-0 grid-cols-1 gap-6 xl:h-full xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* 地图：窄屏压到 300px（手机上是"定位辅助"，不是主内容）；
          桌面用组件传入的高度（620px）。 */}
      <ChinaMap
        points={points}
        focus={focus}
        onFocusChange={setFocus}
        path={path}
        onPathChange={setPath}
        scope={scope}
        onRegionPick={setScope}
      />

      {/* 列表：桌面是固定高度的**侧栏**（自己滚动）；
          窄屏**不设高度、也不裁切**，让它跟着页面一起滚——
          手机上做"页面里套一个可滚动框"是最难用的反模式（滚到边界会卡住），
          而"锁了页面高度又不给列表滚动"更糟：下半截直接够不着。 */}
      <div className="flex min-h-0 flex-col rounded-card border bg-card xl:h-full xl:overflow-hidden">
        <CohortList
          items={visible}
          canManage={canManage}
          activeId={focus?.id}
          onLocate={setFocus}
          pageSize={pageSize}
          actionLabel={actionLabel}
          allHref={allHref}
          scope={scope}
          total={points.length}
          onClearScope={clearScope}
        />
      </div>
    </div>
  )
}
