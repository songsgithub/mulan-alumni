import type { CollectionBeforeValidateHook } from 'payload'

import { uniqueCode } from './code'

/**
 * 集合的 slug 自动补齐。
 *
 * 规则：**地址标识一律是不透明随机串**，展示名（name / title）才是中文人话。
 * 谁建的对象都走这一套——CMS 后台手建的、种子脚本建的、接口建的，
 * 都不会漏出语义 slug。
 *
 * 用法：给集合挂上
 *   hooks: { beforeValidate: [generateSlug('resources')] }
 */
export const generateSlug = (collection: string): CollectionBeforeValidateHook =>
  async ({ data, req }) => {
    if (!data) return data
    if (data.slug) return data

    data.slug = await uniqueCode(async (candidate) => {
      const hit = await req.payload.find({
        collection: collection as never,
        where: { slug: { equals: candidate } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return hit.docs.length > 0
    })

    return data
  }
