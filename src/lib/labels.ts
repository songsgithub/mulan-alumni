/**
 * 公众域的枚举值 → 中文标签映射。
 *
 * 集合里存的是稳定的英文枚举值（便于改文案而不动数据），
 * 页面展示时统一在这里翻成中文。
 */

/**
 * 互助团的四个项目类型（工作台地图按这个筛选）。
 *
 * 集合里存的是**项目的官方英文名**（kebab-case），页面展示时统一翻成中文。
 * 工作台与公众站的界面文字里只出现中文；英文名只留在 CMS 后台的下拉项里，
 * 供运维对照官方项目名。
 */
export const COHORT_CATEGORIES = [
  { value: 'go-mulan', label: '加油木兰' },
  { value: 'a-idol', label: 'AI豆计划' },
  { value: 'homestay-manager', label: '民宿管家' },
] as const

export const COHORT_CATEGORY_LABEL: Record<string, string> = {
  'go-mulan': '加油木兰',
  'a-idol': 'AI豆计划',
  'homestay-manager': '民宿管家',
}

/** 活动形式（与 ActivityPlans 集合的 form 选项一致） */
export const FORM_LABEL: Record<string, string> = {
  offline: '线下',
  online: '线上',
  hybrid: '线上线下结合',
}

/** 资源分类（与 Resources 集合的 category 选项一致） */
export const RESOURCE_CATEGORY_LABEL: Record<string, string> = {
  vi: '品牌 VI',
  template: '工具模板',
  guide: '操作指南',
  policy: '政策速查',
}

/** 资源类型（与 Resources 集合的 type 选项一致）：只说文件形态 */
export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  doc: '文档',
  video: '视频',
}

/** 文件类型提示 */
export const FILE_KIND_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'video/mp4': '视频',
  'video/webm': '视频',
  'video/quicktime': '视频',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '表格',
  'text/plain': '文本',
}

