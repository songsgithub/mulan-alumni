/**
 * 《经费预算明细表》费用类目树。
 *
 * 2026-11-01 第三十六轮：**类目不再写死在代码里**——
 * 以前这里是 13 个一级类别 + 上百条二级明细的硬编码常量，
 * 改一次类别要动代码、发版；现在由项目组在工作台「设置」里维护，
 * 存在 `activity-settings.expenseCategories`（见 `globals/ActivitySettings.ts`）。
 *
 * ## 为什么这里还留一份内置清单
 *
 * 1. **兜底**：设置还没初始化（刚建库、迁移后未写入）时，下拉不能是空的。
 * 2. **一级类别的基线**：费用类别必须是从清单里选的大类，要有一份确定的基线。
 *
 * 2026-11-02 第四十六轮：**明细正文不再受清单约束**——
 * 页面上的「预算明细 / 实际支出明细」由人手动写（写清实际发生的东西或服务），
 * 清单里的二级明细项变成「可支持项」参考（见「查询可支持项」弹窗）。
 * 清单只管**一级类别**。
 *
 * 但**读取时以设置为准**：`getExpenseCategories()` 返回设置里的类目树；
 * 设置为空时才回落到这份内置清单。
 *
 * ## 历史数据不受影响（重要）
 *
 * 活动方案 / 反馈 / 报销单里存的是**类别名与明细项名的快照**
 * （`budgetItems[].category` / `.item` 是普通文本，不是这里的索引），
 * 所以后来改了类别名、调整了归属、甚至删了某个明细项，
 * **已经提交的老记录照样按当初的写法显示**。
 * 这也是为什么校验用的是"名字在不在清单里"，而不是"索引有没有指向"。
 */

interface BudgetItemDef {
  name: string
}

/**
 * 费用类别（**只有一级**，2026-11-03 第五十一轮）。
 *
 * 以前是「一级类别 + 二级明细项」两层（`BudgetCategoryDef.items`），
 * 第五十一轮移除二级明细项后，`items` 恒为空数组——
 * 保留这个字段是为了**不破坏**下面这些调用点的形状（`cat.items` 仍可安全访问）。
 */
export interface BudgetCategoryDef {
  name: string
  /** @deprecated 二级明细项已移除，恒为空数组 */
  items: BudgetItemDef[]
}

/**
 * 内置兜底清单（设置未初始化时用）。
 *
 * ⚠️ 2026-11-03 第五十一轮：**只留一级类别**（原来还带二级明细项）。
 */
export const DEFAULT_EXPENSE_CATEGORIES: BudgetCategoryDef[] = [
  '活动场地与布置',
  '活动物料与耗材',
  '宣传与记录',
  '设备与网络',
  '餐饮茶歇',
  '交通与差旅',
  '讲师与人员',
  '活动体验与参观',
  '健康与安全',
  '亲子与特殊人群',
  '奖品与纪念品',
  '物流与杂费',
  '其他',
].map((name) => ({ name, items: [] as BudgetItemDef[] }))

/**
 * 把设置里存的结构转成统一形状。
 *
 * ⚠️ 2026-11-03 第五十一轮：二级明细项已移除。
 * 旧数据里还有 `items`（`{ item }[]`），这里**读到就丢**——
 * 迁移会把库里那一列清掉，但代码里留一层兼容，
 * 万一还有没迁移干净的库也能正常读出来（只是不带明细项）。
 */
const normalize = (
  rows: { category?: string | null; items?: unknown }[] | null | undefined,
): BudgetCategoryDef[] => {
  const out: BudgetCategoryDef[] = []
  for (const row of rows ?? []) {
    const name = String(row?.category ?? '').trim()
    if (!name) continue
    out.push({ name, items: [] })
  }
  return out
}

/**
 * 读当前生效的类目树：**设置里的优先**，为空则用内置兜底。
 *
 * 纯函数（不碰数据库），便于在客户端组件与 PDF 里共用；
 * 需要读数据库的���方请用 `getExpenseCategories(payload)`。
 */
export const expenseCategoriesFrom = (
  rows: { category?: string | null; items?: { item?: string | null }[] | null }[] | null | undefined,
): BudgetCategoryDef[] => {
  const normalized = normalize(rows)
  return normalized.length ? normalized : DEFAULT_EXPENSE_CATEGORIES
}

/**
 * 读设置里的类目树（服务端用）。
 *
 * 设置没写过 / 读失败 → 回落到内置清单（下拉不会是空的）。
 */
export const getExpenseCategories = async (payload: any): Promise<BudgetCategoryDef[]> => {
  try {
    const settings: any = await payload.findGlobal({
      slug: 'activity-settings' as any,
      depth: 0,
      overrideAccess: true,
    })
    return expenseCategoriesFrom(settings?.expenseCategories)
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES
  }
}

/**
 * 一笔明细的**展示文本**（2026-11-02 第四十六轮）。
 *
 * 第四十六轮起，页面与 PDF 里「费用项目」和「数量与规格」**合并成一列**
 * （申请阶段叫「预算明细」，报销阶段叫「实际支出明细」），明细由人手动填。
 * 数据里仍然分两个字段存：
 * - `item`：明细正文（新的记录只写它）；
 * - `description`：**历史字段**——老记录里的「数量与规格」，新记录留空。
 *
 * 所以展示时：两个都有且不一样 → 中间用「·」连起来（老记录不丢信息）；
 * 一样或只有一个 → 只显示一个。
 */
export const expenseDetailText = (
  row: { item?: string | null; description?: string | null } | null | undefined,
): string => {
  const item = String(row?.item ?? '').trim()
  const description = String(row?.description ?? '').trim()
  if (!item) return description
  if (!description || description === item) return item
  return `${item} · ${description}`
}

