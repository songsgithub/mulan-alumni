'use client'

import { useEffect, useState } from 'react'

import { SearchSelect } from '@/components/console/SearchSelect'

export interface RegionValue {
  province: string
  provinceCode: string
  city: string
  cityCode: string
  district: string
  districtCode: string
}

interface GeoFeature {
  properties: { adcode: number; name: string; level: string }
}

const EMPTY: RegionValue = {
  province: '',
  provinceCode: '',
  city: '',
  cityCode: '',
  district: '',
  districtCode: '',
}

/**
 * 地域选择：省 → 市 → 区（县），每一级都可搜索、也都可以不选。
 * 边界数据来自 `/api/geo/[adcode]`（本地缓存优先，缺了现拉并落盘）。
 */
export function RegionPicker({
  value,
  onChange,
  allowEmpty = false,
  partial = false,
}: {
  value: RegionValue
  onChange: (next: RegionValue) => void
  /** 筛选场景：每一级都可以清空（只选到省或市也可以） */
  allowEmpty?: boolean
  /**
   * 建团场景：**省必填，市 / 区县可以留空，也可以选了再清掉**。
   * 填到哪一级，团就落在哪一级（地图上按省 / 市 / 区县逐级下钻）。
   */
  partial?: boolean
}) {
  const [provinces, setProvinces] = useState<{ value: string; label: string }[]>([])
  const [middle, setMiddle] = useState<{ value: string; label: string }[]>([])
  const [districts, setDistricts] = useState<{ value: string; label: string }[]>([])
  const [middleIsCity, setMiddleIsCity] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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

  useEffect(() => {
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

  useEffect(() => {
    if (!middleIsCity || !value.cityCode) {
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

  const provinceName = provinces.find((p) => p.value === value.provinceCode)?.label ?? ''

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
      <SearchSelect
        value={value.provinceCode}
        options={provinces}
        placeholder="省 / 自治区 / 直辖市"
        allowEmpty={allowEmpty}
        emptyLabel="全部省份"
        label="省 / 自治区 / 直辖市"
        searchPlaceholder="搜索省份…"
        onChange={(code) => {
          if (!code) {
            onChange(EMPTY)
            return
          }
          const name = provinces.find((p) => p.value === code)?.label ?? ''
          onChange({ ...EMPTY, province: name, provinceCode: code })
        }}
      />

      <SearchSelect
        value={middleIsCity ? value.cityCode : value.districtCode}
        options={middle}
        placeholder={middleIsCity ? '市' : '区 / 县'}
        allowEmpty={allowEmpty || partial}
        emptyLabel={
          middleIsCity
            ? partial
              ? '只选到省'
              : '全部城市'
            : partial
              ? '不填到区县'
              : '全部区县'
        }
        disabled={!value.provinceCode || loading}
        label={middleIsCity ? '市' : '区 / 县'}
        searchPlaceholder={middleIsCity ? '搜索城市…' : '搜索区县…'}
        onChange={(code) => {
          if (!code) {
            if (middleIsCity) {
              onChange({ ...value, city: '', cityCode: '', district: '', districtCode: '' })
            } else {
              onChange({ ...value, district: '', districtCode: '' })
            }
            return
          }
          const name = middle.find((p) => p.value === code)?.label ?? ''
          if (middleIsCity) {
            onChange({ ...value, city: name, cityCode: code, district: '', districtCode: '' })
          } else {
            onChange({
              ...value,
              city: provinceName,
              cityCode: value.provinceCode,
              district: name,
              districtCode: code,
            })
          }
        }}
      />

      {middleIsCity ? (
        <SearchSelect
          value={value.districtCode}
          options={districts}
          placeholder="区 / 县"
          allowEmpty={allowEmpty || partial}
          emptyLabel={partial ? '不填到区县' : '全部区县'}
          disabled={!value.cityCode}
          label="区 / 县"
          searchPlaceholder="搜索区县…"
          onChange={(code) => {
            if (!code) {
              onChange({ ...value, district: '', districtCode: '' })
              return
            }
            const name = districts.find((p) => p.value === code)?.label ?? ''
            onChange({ ...value, district: name, districtCode: code })
          }}
        />
      ) : null}
    </div>
  )
}
