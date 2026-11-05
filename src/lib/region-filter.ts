interface RegionCodes {
  provinceCode?: string | null
  cityCode?: string | null
  districtCode?: string | null
}

/**
 * 互助团所在地是否落在所选地域内。只比较所选的**最深一级**：
 * 选到区就只看区代码，选到市只看市代码，选到省只看省代码。
 *
 * 为什么不逐级比：直辖市的"市"代码在数据里是 110100，而地域选择器的省代码是 110000，
 * 逐级比会把直辖市的区全部筛空。
 */
export function matchesRegion(
  location: RegionCodes | null | undefined,
  want: RegionCodes,
): boolean {
  if (want.districtCode) return location?.districtCode === want.districtCode
  if (want.cityCode) return location?.cityCode === want.cityCode
  if (want.provinceCode) return location?.provinceCode === want.provinceCode
  return true
}
