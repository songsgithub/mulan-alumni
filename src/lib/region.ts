/**
 * 地域的紧凑写法：省名（去掉「省 / 市 / 自治区」）+ 区 / 县名（去掉行政级别后缀）。
 *
 * 例：贵州省 · 万山区 → 「贵州 · 万山」；甘肃省 · 积石山保安族东乡族撒拉族自治县 → 「甘肃 · 积石山」；
 * 北京市 · 朝阳区 → 「北京 · 朝阳」。
 * 只用于公开站的紧凑展示（卡片、详情页 Banner），完整地址仍用 `region` 字段。
 */

/** 省名：去掉行政级别与民族名后缀（广西壮族自治区 → 广西） */
export const provinceName = (name?: string | null): string => {
  const value = (name ?? '').trim()
  if (!value) return ''
  return value
    .replace(/(壮族|回族|维吾尔|藏族|蒙古族|朝鲜族|土家族|苗族|侗族|彝族|哈尼族|白族|傣族|傈僳族|拉祜族|佤族|纳西族|景颇族|布朗族|普米族|怒族|德昂族|独龙族|基诺族|水族|布依族|仡佬族|瑶族|畲族|黎族|羌族|毛南族|仫佬族|京族|土族|撒拉族|东乡族|保安族|裕固族|哈萨克族|柯尔克孜族|锡伯族|塔吉克族|乌孜别克族|俄罗斯族|塔塔尔族|达斡尔族|鄂温克族|鄂伦春族|赫哲族|满族|锡伯族)?自治区$/, '')
    .replace(/(省|市|特别行政区)$/, '')
}

/** 民族名（带「族」字），用于从自治县名里剥掉，按长度从长到短匹配 */
const ETHNIC = [
  '维吾尔族', '哈萨克族', '柯尔克孜族', '塔吉克族', '乌孜别克族', '俄罗斯族', '塔塔尔族',
  '达斡尔族', '鄂温克族', '鄂伦春族', '赫哲族', '朝鲜族', '蒙古族', '土家族', '苗族',
  '侗族', '彝族', '哈尼族', '白族', '傣族', '傈僳族', '拉祜族', '佤族', '纳西族',
  '景颇族', '布朗族', '普米族', '怒族', '德昂族', '独龙族', '基诺族', '水族', '布依族',
  '仡佬族', '瑶族', '畲族', '黎族', '羌族', '毛南族', '仫佬族', '京族', '土族', '撒拉族',
  '东乡族', '保安族', '裕固族', '锡伯族', '壮族', '回族', '藏族', '满族', '瑶族', '畲族',
  '纳西族', '拉祜族', '景颇族', '布朗族', '阿昌族', '普米族', '怒族', '德昂族', '独龙族',
].sort((a, b) => b.length - a.length)

/**
 * 区 / 县名：去掉行政级别后缀与民族名。
 * 西湖区 → 西湖；东乡族自治县 → 东乡；
 * 积石山保安族东乡族撒拉族自治县 → 积石山。
 */
const shortDistrict = (name?: string | null): string => {
  let value = (name ?? '').trim()
  if (!value) return ''
  value = value.replace(/(自治县|自治旗|自治州)$/, '')
  // 反复剥掉结尾的民族名（一个自治县名里可能连着好几个）
  for (let changed = true; changed; ) {
    changed = false
    for (const ethnic of ETHNIC) {
      if (value.endsWith(ethnic)) {
        value = value.slice(0, -ethnic.length)
        changed = true
        break
      }
    }
  }
  return value.replace(/(县|区|市|旗)$/, '')
}

/** 省名 + 区县名：「贵州 · 万山」。只有省时返回省名 */
export const shortRegion = (province?: string | null, district?: string | null): string => {
  const p = provinceName(province)
  const d = shortDistrict(district)
  return [p, d].filter(Boolean).join(' · ')
}
