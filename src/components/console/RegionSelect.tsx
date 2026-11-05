'use client'

import * as React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronLeft, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { RegionValue } from './RegionPicker'
import {
  COMBO_ITEM,
  COMBO_PANEL,
  ComboSearchRow,
  FIELD_TRIGGER,
} from './SearchSelect'

interface GeoFeature {
  properties: { adcode: number; name: string; level: string }
}
export interface RegionSearchOption extends RegionValue {
  label: string
}

interface Option {
  value: string
  label: string
}

type Level = 'province' | 'city' | 'district'

interface Row {
  value: string
  label: string
  selected: boolean
}

const EMPTY: RegionValue = {
  province: '',
  provinceCode: '',
  city: '',
  cityCode: '',
  district: '',
  districtCode: '',
}

const MUNICIPALITIES = new Set(['110000', '120000', '310000', '500000'])

/**
 * 统计筛选用的地域（Base UI Combobox）：**一个下拉**，在里面逐级切换省 → 市 → 区。
 * 选到省或市就停（筛选立即生效），也可以继续往下选；输入即搜索，县域可直接搜到。
 */
export function RegionSelect({
  value,
  onChange,
  searchOptions = [],
}: {
  value: RegionValue
  onChange: (next: RegionValue) => void
  /** 当前数据里出现过的县域，可在搜索框里直接搜到 */
  searchOptions?: RegionSearchOption[]
}) {
  const [open, setOpen] = React.useState(false)
  const [level, setLevel] = React.useState<Level>('province')
  const [provinces, setProvinces] = React.useState<Option[]>([])
  const [middle, setMiddle] = React.useState<Option[]>([])
  const [districts, setDistricts] = React.useState<Option[]>([])
  const [middleIsCity, setMiddleIsCity] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState('')

  /**
   * 选中「省 / 市」这类会继续下钻的项时，Base UI 默认会关闭弹层。
   * 这里标记一次，让随后那次由选择引起的关闭被忽略，弹层保持打开显示下一级。
   */
  const keepOpen = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/geo/100000')
      .then((res) => res.json())
      .then((data: { features: GeoFeature[] }) => {
        if (cancelled) return
        setProvinces(
          (data.features ?? [])
            .filter((f) => f.properties.level === 'province')
            .map((f) => ({ value: String(f.properties.adcode), label: f.properties.name })),
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!value.provinceCode) {
      setMiddle([])
      setDistricts([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/geo/${value.provinceCode}`)
      .then((res) => res.json())
      .then((data: { features: GeoFeature[] }) => {
        if (cancelled) return
        const features = data.features ?? []
        const isCity = features[0]?.properties.level === 'city'
        setMiddleIsCity(isCity)
        setMiddle(
          features.map((f) => ({ value: String(f.properties.adcode), label: f.properties.name })),
        )
        setDistricts([])
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [value.provinceCode])

  React.useEffect(() => {
    if (!value.cityCode || !middleIsCity) {
      setDistricts([])
      return
    }
    let cancelled = false
    fetch(`/api/geo/${value.cityCode}`)
      .then((res) => res.json())
      .then((data: { features: GeoFeature[] }) => {
        if (cancelled) return
        setDistricts(
          (data.features ?? [])
            .filter((f) => f.properties.level === 'district')
            .map((f) => ({ value: String(f.properties.adcode), label: f.properties.name })),
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [value.cityCode, middleIsCity])

  const searchMatch = searchOptions.find((option) =>
    value.districtCode
      ? option.districtCode === value.districtCode
      : value.cityCode
        ? option.cityCode === value.cityCode
        : option.provinceCode === value.provinceCode,
  )
  const provinceLabel = value.provinceCode
    ? value.province ||
      provinces.find((p) => p.value === value.provinceCode)?.label ||
      searchMatch?.province ||
      ''
    : ''
  const cityLabel = value.cityCode
    ? value.city ||
      (middleIsCity ? middle.find((p) => p.value === value.cityCode)?.label : '') ||
      searchMatch?.city ||
      ''
    : ''
  const districtLabel = value.districtCode
    ? value.district ||
      (middleIsCity
        ? districts.find((p) => p.value === value.districtCode)?.label
        : middle.find((p) => p.value === value.districtCode)?.label) ||
      searchMatch?.district ||
      ''
    : ''

  // 触发框只显示最末一级（如「遂平县」），完整路径放在提示里，避免窄框里截断成「河南省 / 驻…」
  const fullLabel = [provinceLabel, cityLabel, districtLabel].filter(Boolean).join(' / ')
  const shortLabel = districtLabel || cityLabel || provinceLabel

  const openPicker = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setQuery('')
    if (nextOpen) {
      if (value.districtCode) setLevel('district')
      else if (value.cityCode) setLevel('city')
      else if (value.provinceCode) setLevel(MUNICIPALITIES.has(value.provinceCode) ? 'district' : 'city')
      else setLevel('province')
    }
  }

  const levelList = levelOptions(level, middleIsCity, { provinces, middle, districts })

  /** 选中某一级：下钻时保持弹层打开；最终选定时关闭 */
  const drill = (next: () => void) => {
    keepOpen.current = true
    setQuery('')
    next()
    // 没有触发关闭时也要复位，避免下一次真正的关闭（点外面）被吞掉
    window.setTimeout(() => {
      keepOpen.current = false
    }, 0)
  }

  const pick = (option: Option) => {
    if (level === 'province') {
      const municipality = MUNICIPALITIES.has(option.value)
      drill(() => {
        onChange({ ...EMPTY, province: option.label, provinceCode: option.value })
        setLevel(municipality ? 'district' : 'city')
      })
      return
    }
    if (level === 'city' && middleIsCity) {
      drill(() => {
        onChange({
          ...value,
          city: option.label,
          cityCode: option.value,
          district: '',
          districtCode: '',
        })
        setLevel('district')
      })
      return
    }
    // 区县（含直辖市没有市级层的情况）：最终选定，关闭
    keepOpen.current = false
    onChange({
      ...value,
      city: middleIsCity ? value.city : provinceLabel,
      cityCode: middleIsCity ? value.cityCode : value.provinceCode,
      district: option.label,
      districtCode: option.value,
    })
    setOpen(false)
  }

  /** 本层的「不限」：清空本层及以下的选择 */
  const clearLevel = () => {
    if (level === 'province') {
      keepOpen.current = false
      onChange(EMPTY)
      setOpen(false)
      return
    }
    if (level === 'city') {
      drill(() => {
        onChange({ ...value, city: '', cityCode: '', district: '', districtCode: '' })
        setLevel('province')
      })
      return
    }
    drill(() => {
      onChange({ ...value, district: '', districtCode: '' })
      setLevel('city')
    })
  }

  // 每次渲染重建行与动作表：value 只是 Base UI 的索引，真正的动作在 actions 里
  const actions = new Map<string, () => void>()
  const rows: Row[] = []

  if (query.trim()) {
    for (const option of searchOptions) {
      const key = `sr:${option.districtCode || option.cityCode || option.provinceCode}`
      rows.push({ value: key, label: option.label, selected: false })
      actions.set(key, () => {
        keepOpen.current = false
        onChange({
          province: option.province,
          provinceCode: option.provinceCode,
          city: option.city,
          cityCode: option.cityCode,
          district: option.district,
          districtCode: option.districtCode,
        })
        setLevel('district')
        setOpen(false)
        setQuery('')
      })
    }
  }

  const emptyText = level === 'province' ? '全部地域' : level === 'city' ? '不限城市' : '不限区县'
  rows.push({ value: 'clear', label: emptyText, selected: false })
  actions.set('clear', clearLevel)

  for (const option of levelList) {
    const selected =
      (level === 'province' && option.value === value.provinceCode) ||
      (level === 'city' && option.value === value.cityCode) ||
      (level === 'district' && option.value === value.districtCode)
    const key = `lv:${option.value}`
    rows.push({ value: key, label: option.label, selected: Boolean(selected) })
    actions.set(key, () => pick(option))
  }

  return (
    <Combobox.Root
      items={rows}
      value={null}
      open={open}
      onOpenChange={(next) => {
        if (!next && keepOpen.current) return
        openPicker(next)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        if (next == null) return
        actions.get(String(next))?.()
      }}
    >
      <Combobox.Trigger
        aria-label="地域"
        title={fullLabel || undefined}
        className={cn(FIELD_TRIGGER, !shortLabel && 'text-muted-foreground')}
      >
        <span className="truncate">{shortLabel || '全部地域'}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className={COMBO_PANEL}>
            {/* 面包屑：只在下钻后出现，文字不换行 */}
            {level !== 'province' ? (
              <div className="flex items-center gap-1 border-b border-rule px-2 py-2 text-label">
                <button
                  type="button"
                  onClick={() => {
                    onChange(EMPTY)
                    setLevel('province')
                  }}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-control px-2 text-muted hover:bg-console-accent hover:text-fg"
                >
                  <ChevronLeft className="size-4" />
                  全国
                </button>
                {level === 'district' ? (
                  <button
                    type="button"
                    onClick={() => setLevel('city')}
                    className="inline-flex min-h-11 min-w-0 items-center gap-1 whitespace-nowrap rounded-control px-2 text-muted hover:bg-console-accent hover:text-fg"
                  >
                    <ChevronLeft className="size-4 shrink-0" />
                    <span className="truncate">{provinceLabel || '省份'}</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            <ComboSearchRow placeholder="搜索地域…" />

            <Combobox.Empty className="empty:hidden px-3 py-6 text-center text-body text-muted">
              {loading ? '正在加载…' : '没有匹配项'}
            </Combobox.Empty>

            {loading && levelList.length === 0 ? (
              <div className="px-3 py-4 text-body text-muted">正在加载…</div>
            ) : null}

            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto p-1">
              {(row: Row) => (
                <Combobox.Item key={row.value} value={row.value} className={COMBO_ITEM}>
                  <Check
                    className={cn(
                      'absolute right-2 size-4',
                      row.selected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {row.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/** 当前层级的可选项。直辖市没有市级层，其区县直接挂在省下面。 */
function levelOptions(
  level: Level,
  middleIsCity: boolean,
  lists: { provinces: Option[]; middle: Option[]; districts: Option[] },
): Option[] {
  if (level === 'province') return lists.provinces
  if (level === 'city') return middleIsCity ? lists.middle : []
  return middleIsCity ? lists.districts : lists.middle
}
