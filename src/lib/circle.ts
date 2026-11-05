/**
 * 互助团在"网络视图"里的统一形状。
 *
 * 地图（ChinaMap）与列表（CohortList）用的是同一份数据——
 * 这样点列表能定位到地图上的区县，点地图也知道列表里对应的是哪几个团。
 */
/**
 * 地图上的一个行政区划节点（全国 / 省 / 市 / 区（县））。
 *
 * `adcode` 是 DataV.GeoAtlas 的行政区划代码——互助团的省 / 市 / 区县各存一个，
 * 两边靠它对上号（见 `CirclePoint` 的三个 code 字段）。
 */
export interface MapNode {
  /** 行政区划代码 */
  adcode: string
  /** 行政区划名称（面包屑与筛选标签用） */
  name: string
}

export interface CirclePoint {
  id: number | string
  /** 团的标识（公开站路由用） */
  slug: string
  name: string
  /** 类别枚举值（go-mulan / a-idol / homestay-manager） */
  category: string
  /** 类别中文名 */
  categoryLabel: string
  province: string
  provinceCode: string
  city: string
  cityCode: string
  district: string
  districtCode: string
  /** 状态：active 运行中 / closed 解散 */
  status: string
  /** 团长名字（一个团只有一个团长） */
  leaderName: string
  theme?: string
}
