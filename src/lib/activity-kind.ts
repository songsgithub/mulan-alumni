/**
 * 活动类别：《数字木兰校友会互助团 SOP》第一部分 §7「建议的活动方向」的四类
 * （公开站的类别筛选用，与朋友平台 muse 的 CATEGORIES 一致）。
 *
 * 活动数据里没有单独存类别，这里按活动标题 / 摘要里的关键词归类（SOP 表里每一类的典型方向），
 * 都没命中的归「技能提升类」——SOP 里最大的一类。
 */
export const ACTIVITY_KINDS = ['技能提升类', 'AI素养类', '健康科普类', '生活成长类'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

const RULES: { kind: ActivityKind; words: RegExp }[] = [
  { kind: 'AI素养类', words: /AI|人工智能|提示词|大模型|智能|防诈|手机办事|数据标注|标注|工作流|助手/i },
  { kind: '健康科普类', words: /健康|义诊|药|护眼|经期|更年期|体检|医|足球|女足|运动|训练营/ },
  { kind: '生活成长类', words: /亲子|读书|阅读|情绪|减压|茶话|家庭|沟通|手作|插花|成长|故事|一年/ },
]

export function activityKind(...texts: (string | null | undefined)[]): ActivityKind {
  const text = texts.filter(Boolean).join(' ')
  for (const rule of RULES) if (rule.words.test(text)) return rule.kind
  return '技能提升类'
}
