/**
 * 真实落点的互助团网络（演示用真名实姓的地名，不是随机撒点）。
 *
 * - AI豆计划 17 个（用户提供的真实落点；四川九龙按用户要求排除）
 * - 加油木兰 15 个（按项目覆盖的 18 个省区，各选 1 个欠发达县域）
 * - 民宿管家 22 个（16 个项目省份，各 1–2 个乡村旅游县）
 *
 * 做法：
 * 1) 先删掉上一版「模拟撒点」的团（团长邮箱是 sim-* 的那批），
 * 2) 按真实县名 / 市名落位（adcode 从 data/geo-cache/counties.json 取），
 * 3) 每个团一个团长账号（可登录，密码 Mulan@2026），isPublic=true → 公众站有主页，
 * 4) 一部分团各发一条公开成果（≈ 办过一场活动），让公众站有内容可看。
 *
 * 用法：npx tsx --env-file-if-exists=.env scripts/seed-network.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'
import config from '@payload-config'

import { deterministicCode } from '../src/lib/code'
import { formatPlace } from '../src/lib/format'

type Category = 'go-mulan' | 'a-idol' | 'homestay-manager'

const LABEL: Record<Category, string> = {
  'go-mulan': '加油木兰',
  'a-idol': 'AI豆计划',
  'homestay-manager': '民宿管家',
}

type Place = { province: string; provinceCode: string; city: string; cityCode: string }

type Entry = {
  category: Category
  /** 县 / 区名；市本级落点写市名 */
  name: string
  /** 同名区县（如永定区）用省份消歧 */
  province?: string
  /** 缩短后的地名（东乡族自治县去掉民族名后会变空，这里兜底） */
  shortName?: string
  /** 市本级落点（遵义 / 朔州 / 银川 / 铜川）手动给行政区划 */
  cityLevel?: Place
}

type County = {
  adcode: string
  name: string
  province: string
  provinceCode: string
  city: string
  cityCode: string
}

/** AI豆计划：用户提供的真实落点（四川九龙已按要求排除） */
const A_IDOL: Entry[] = [
  { category: 'a-idol', name: '万山区' },
  { category: 'a-idol', name: '遵义市', cityLevel: { province: '贵州省', provinceCode: '520000', city: '遵义市', cityCode: '520300' } },
  { category: 'a-idol', name: '清涧县' },
  { category: 'a-idol', name: '子洲县' },
  { category: 'a-idol', name: '延川县' },
  { category: 'a-idol', name: '绥德县' },
  { category: 'a-idol', name: '宜君县' },
  { category: 'a-idol', name: '永和县' },
  { category: 'a-idol', name: '朔州市', cityLevel: { province: '山西省', provinceCode: '140000', city: '朔州市', cityCode: '140600' } },
  { category: 'a-idol', name: '积石山保安族东乡族撒拉族自治县' },
  { category: 'a-idol', name: '银川市', cityLevel: { province: '宁夏回族自治区', provinceCode: '640000', city: '银川市', cityCode: '640100' } },
  { category: 'a-idol', name: '平安区' },
  { category: 'a-idol', name: '张北县' },
  { category: 'a-idol', name: '永靖县' },
  { category: 'a-idol', name: '兰考县' },
  { category: 'a-idol', name: '铜川市', cityLevel: { province: '陕西省', provinceCode: '610000', city: '铜川市', cityCode: '610200' } },
]

/** 加油木兰：18 个项目省份里的 15 个真实县域 */
const fuel = (name: string, shortName?: string): Entry => ({
  category: 'go-mulan',
  name,
  ...(shortName ? { shortName } : {}),
})

const GO_MULAN: Entry[] = [
  fuel('东乡族自治县', '东乡'),
  fuel('渭源县'),
  fuel('织金县'),
  fuel('纳雍县'),
  fuel('镇雄县'),
  fuel('会泽县'),
  fuel('昭觉县'),
  fuel('西吉县'),
  fuel('化隆回族自治县'),
  fuel('大宁县'),
  fuel('卓资县'),
  fuel('卢氏县'),
  fuel('都安瑶族自治县'),
  fuel('康保县'),
  fuel('桑植县'),
]

/** 民宿管家：16 个省份、22 个乡村旅游县 */
const homestay = (name: string, province?: string): Entry => ({
  category: 'homestay-manager',
  name,
  ...(province ? { province } : {}),
})

const HOMESTAY: Entry[] = [
  homestay('德清县'),
  homestay('淳安县'),
  homestay('松阳县'),
  homestay('婺源县'),
  homestay('井冈山市'),
  homestay('凤凰县'),
  homestay('永定区', '湖南省'),
  homestay('腾冲市'),
  homestay('大理市'),
  homestay('都江堰市'),
  homestay('阆中市'),
  homestay('阳朔县'),
  homestay('武夷山市'),
  homestay('黟县'),
  homestay('雷山县'),
  homestay('荔波县'),
  homestay('蔚县'),
  homestay('沂水县'),
  homestay('溧阳市'),
  homestay('武隆区'),
  homestay('安图县'),
  homestay('恩施市'),
]

/**
 * 后补的落点**只能追加在末尾**：slug 与团长邮箱都带 list index，
 * 往中间插会让后面所有团的地址标识整体错位（已发出去的链接就断了）。
 */
const EXTRA: Entry[] = [
  // 用户补充的第 17 个 AI豆计划落点（2026-10-30）
  { category: 'a-idol', name: '金昌市', cityLevel: { province: '甘肃省', provinceCode: '620000', city: '金昌市', cityCode: '620300' } },
]

const ALL = [...A_IDOL, ...GO_MULAN, ...HOMESTAY, ...EXTRA]

const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁沈任姚卢傅钟姜崔谭廖范汪陆金石贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('')
const GIVEN = ['晓梅','秀兰','桂英','丽娟','淑芬','玉兰','小燕','春花','桂芳','雅静','慧敏','丹丹','佳怡','子涵','雨欣','思琪','梦瑶','静怡','欣怡','文静','雪梅','金凤','秋月','爱华','春梅','凤英','素珍','桂兰','丽君','美玲','海燕','晓琳','红梅','玉梅','秀珍','丹凤','新梅','雪松','亚楠','露露','倩倩','媛媛','佳琪','月月','宁宁','蕾蕾','妍妍','珊珊','婷婷','萌萌','丽丽','燕燕','平平']

function makeRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
function hashCode(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 去掉行政级别后缀，作为团名与邮箱的一部分 */
const short = (name: string) =>
  name
    .replace(/(保安族|东乡族|撒拉族|回族|瑶族|土家族|苗族|彝族|壮族)?自治县$/, '')
    .replace(/(自治县|自治州|县|区|市)$/, '')

const THEME: Record<Category, string[]> = {
  'go-mulan': ['上学、看病的手续，姐妹们互相教一遍', '把政策讲给身边的人听', '理赔材料一起整理，少跑一趟是一趟'],
  'a-idol': ['从图片标注学起，老带新', '在家门口做数字新职业', '把 AI 工具用到自己的活计里'],
  'homestay-manager': ['客房、接单、短视频，一起练', '淡旺季定价与差评处理', '把一间房做成一份事业'],
}

const KIND: Record<Category, string> = {
  'go-mulan': '健康科普类',
  'a-idol': 'AI素养类',
  'homestay-manager': '技能提升类',
}

/**
 * 删一个团之前，先把它下面的业务数据按依赖顺序清掉：
 * 付款 → 报销 → 反馈 → 精选 → 活动方案 → 团。
 * （数据库里这些关系的 cohort_id / plan_id 是 NOT NULL，直接删团会撞约束）
 */
async function deleteCohortDeep(payload: any, cohortId: number | string) {
  const plans = await payload.find({
    collection: 'activity-plans',
    where: { cohort: { equals: cohortId } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const planIds = plans.docs.map((d: any) => d.id)

  const reports = planIds.length
    ? await payload.find({
        collection: 'activity-reports',
        where: { plan: { in: planIds } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }
  const reportIds = reports.docs.map((d: any) => d.id)

  const reimb = await payload.find({
    collection: 'reimbursements',
    where: { cohort: { equals: cohortId } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const reimbIds = reimb.docs.map((d: any) => d.id)

  if (reimbIds.length) {
    const pays = await payload.find({
      collection: 'payments',
      where: { reimbursement: { in: reimbIds } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of pays.docs) {
      await payload.delete({ collection: 'payments', id: d.id, overrideAccess: true })
    }
  }

  for (const id of reimbIds) {
    await payload.delete({ collection: 'reimbursements', id, overrideAccess: true })
  }
  for (const id of reportIds) {
    await payload.delete({ collection: 'activity-reports', id, overrideAccess: true })
  }

  const pubs = await payload.find({
    collection: 'publications',
    where: {
      or: [
        { relatedCohort: { equals: cohortId } },
        ...(planIds.length ? [{ relatedPlan: { in: planIds } }] : []),
        ...(reportIds.length ? [{ relatedReport: { in: reportIds } }] : []),
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const d of pubs.docs) {
    await payload.delete({ collection: 'publications', id: d.id, overrideAccess: true })
  }

  for (const id of planIds) {
    await payload.delete({ collection: 'activity-plans', id, overrideAccess: true })
  }

  await payload.delete({ collection: 'cohorts', id: cohortId, overrideAccess: true })
}

async function main() {
  const payload = await getPayload({ config })
  const counties: County[] = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'data', 'geo-cache', 'counties.json'), 'utf-8'),
  )

  // 1) 删掉上一版模拟团（团长邮箱 sim-*）
  const simUsers = await payload.find({
    collection: 'users',
    where: { email: { like: 'sim-' } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  const simIds = simUsers.docs.map((u: any) => u.id)
  console.log('清理模拟盘：团长账号', simIds.length, '个')
  if (simIds.length) {
    const oldCohorts = await payload.find({
      collection: 'cohorts',
      where: { leader: { in: simIds } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of oldCohorts.docs) {
      await deleteCohortDeep(payload, doc.id)
    }
    console.log('  已删除模拟团', oldCohorts.docs.length, '个')
  }

  // 2) 清掉上一版真实盘（re-* 团），保证脚本可重复
  const realUsers = await payload.find({
    collection: 'users',
    where: { email: { like: 'real-' } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  const realIds = realUsers.docs.map((u: any) => u.id)
  if (realIds.length) {
    const oldReal = await payload.find({
      collection: 'cohorts',
      where: { leader: { in: realIds } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of oldReal.docs) {
      await deleteCohortDeep(payload, doc.id)
    }
    for (const u of realUsers.docs) {
      await payload.delete({ collection: 'users', id: (u as any).id, overrideAccess: true }).catch(() => {})
    }
    console.log('  已清掉上一版真实团', oldReal.docs.length, '个')
  }

  let created = 0
  let published = 0

  for (const [index, entry] of ALL.entries()) {
    const category = entry.category
    const label = LABEL[category]

    let place: Place
    let district: string | null = null
    let districtCode: string | null = null

    if (entry.cityLevel) {
      place = entry.cityLevel
    } else {
      const hit = counties.find(
        (c) => c.name === entry.name && (!entry.province || c.province === entry.province),
      )
      if (!hit) {
        console.warn('⚠️ 找不到县域：', entry.name)
        continue
      }
      place = {
        province: hit.province,
        provinceCode: hit.provinceCode,
        city: hit.city,
        cityCode: hit.cityCode,
      }
      district = hit.name
      districtCode = hit.adcode
    }

    const placeLabel = entry.cityLevel ? entry.name : entry.name
    const region = formatPlace(place.province, place.city)
    const seedKey = `real-${category}-${districtCode ?? place.cityCode}-${index}`
    const slug = deterministicCode(seedKey)
    const email = `real-${districtCode ?? place.cityCode}-${index}@mulan.org`
    const rnd = makeRandom(hashCode(seedKey))
    const leaderName =
      SURNAMES[Math.floor(rnd() * SURNAMES.length)] + GIVEN[Math.floor(rnd() * GIVEN.length)]

    const existing = await payload.find({
      collection: 'cohorts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length) continue

    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        name: leaderName,
        roles: ['cohortLead'],
        program: category,
        region: {
          province: place.province,
          provinceCode: place.provinceCode,
          city: place.city,
          cityCode: place.cityCode,
          district,
          districtCode,
        },
        status: 'active',
        password: 'Mulan@2026',
        joinedAt: new Date('2025-09-01').toISOString(),
      } as any,
      overrideAccess: true,
    })

    const shortPlace = short(placeLabel) || entry.shortName || placeLabel
    const name = `${shortPlace}${label}互助团`
    const theme = THEME[category][Math.floor(rnd() * THEME[category].length)]

    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name,
        slug,
        region,
        category,
        location: {
          province: place.province,
          provinceCode: place.provinceCode,
          city: place.city,
          cityCode: place.cityCode,
          district,
          districtCode,
        },
        theme,
        description: `${placeLabel}的姐妹一起在做${label}。${theme}。`,
        leader: user.id,
        leaderTerms: [{ user: user.id, from: '2025-09-01T00:00:00.000Z', to: null }],
        status: 'active',
        isPublic: true,
        tags: [],
      } as any,
      overrideAccess: true,
    })
    created++

    // 3) 每三个团里挑一个「办过一场活动」：发一条公开成果
    if (index % 3 === 0) {
      const month = 5 + (index % 6)
      const day = 8 + (index % 20)
      const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      await payload.create({
        collection: 'publications',
        data: {
          title: `${short(placeLabel)}的第一场共学`,
          slug: deterministicCode(`pub-${seedKey}`),
          type: 'event',
          category,
          kind: KIND[category],
          eventDate: new Date(`${date}T10:00:00+08:00`).toISOString(),
          eventLocation: region,
          attendeeCount: 8 + Math.floor(rnd() * 14),
          excerpt: `${theme}。这一场先把人聚起来：认识的、不认识的，坐下来把各自手上的事说清楚，下一次就知道该找谁了。`,
          relatedCohort: cohort.id,
          byline: `${name} · ${leaderName}`,
        } as any,
        overrideAccess: true,
      })
      published++
    }
  }

  console.log(`完成：新建 ${created} 个真实落点互助团，发布 ${published} 条活动成果`)
  process.exit(0)
}

main().catch((err) => {
  console.error('生成真实互助团失败：', err)
  process.exit(1)
})
