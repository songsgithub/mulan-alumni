import type { getPayload } from 'payload'

type PayloadClient = Awaited<ReturnType<typeof getPayload>>
import { deterministicCode } from '../lib/code'
import { pdfAttachment, photoPng } from '../lib/demo-assets'
import { bulletList, editorState, heading, paragraph, text } from '../lib/lexical'

/**
 * 公众站演示数据：互助团、已发布活动、公开资料库。
 * 与治理链路（方案 / 反馈 / 报销）分开，便于各自维护。
 */

/**
 * 封面：生成"照片感"的抽象图（天空 / 柔光 / 地面 / 颗粒）。
 * 纵向与横向交替，让成果瀑布流天然有高低错落。
 */
const COVER_TONES = ['light', 'mid', 'dark'] as const

/** 覆盖式写媒体：先删同名旧记录（含磁盘文件），再新建，保证文件名稳定 */
async function replaceMedia(
  payload: PayloadClient,
  input: { filename: string; alt: string; file: { data: Buffer; mimetype: string; name: string; size: number } },
) {
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: input.filename } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    await payload.delete({ collection: 'media', id: existing.docs[0].id, overrideAccess: true })
  }
  return payload.create({
    collection: 'media',
    data: { filename: input.filename, alt: input.alt, visibility: 'public' } as any,
    file: input.file,
    overrideAccess: true,
  })
}

async function uploadCover(
  payload: PayloadClient,
  filename: string,
  alt: string,
  toneIndex: number,
  portrait = false,
) {
  const width = portrait ? 680 : 900
  const height = portrait ? 900 : 600
  const data = photoPng(width, height, toneIndex, COVER_TONES[toneIndex % COVER_TONES.length])
  const file = { data, mimetype: 'image/png', name: filename, size: data.length }

  // 已存在就先删旧记录（连带删掉磁盘文件），再新建：
  // Payload 的"带文件更新"会在磁盘上留下 `-1` 后缀的重复文件，容易造成外链失效。
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    await payload.delete({
      collection: 'media',
      id: existing.docs[0].id,
      overrideAccess: true,
    })
  }

  return payload.create({
    collection: 'media',
    data: { filename, alt, visibility: 'public' } as any,
    file,
    overrideAccess: true,
  })
}

interface CircleSeed {
  name: string
  /** 种子内部键（中文团名）；网址里的标识由它派生，保证脚本可重复运行 */
  key: string
  region: string
  /** 三个项目类型之一：go-mulan / a-idol / homestay-manager */
  category: 'go-mulan' | 'a-idol' | 'homestay-manager'
  /** 地图定位：省 / 市 / 区县各一个 6 位 adcode */
  location: {
    province: string
    provinceCode: string
    city: string
    cityCode: string
    district: string
    districtCode: string
  }
  theme: string
  description: string
  leadEmail: string
  leadName: string
  members: { email: string; name: string }[]
}

const CIRCLES: CircleSeed[] = [
  {
    name: '杭州 AI 互助团',
    key: '杭州 AI 互助团',
    category: 'a-idol',
    location: { province: '浙江省', provinceCode: '330000', city: '杭州市', cityCode: '330100', district: '西湖区', districtCode: '330106' },
    region: '浙江 · 杭州',
    theme: '把 AI 用进每天的工作里',
    description:
      '六位从 AI 豆计划出来的姐妹，每两周聚一次，把自己岗位上最费时间的那件事拆开，用工具重新做一遍。',
    leadEmail: 'lead@mulan.org',
    leadName: '林晓',
    members: [
      { email: 'member@mulan.org', name: '周雨' },
      { email: 'chenxi@mulan.org', name: '陈曦' },
      { email: 'sunan@mulan.org', name: '苏楠' },
      { email: 'hejia@mulan.org', name: '何佳' },
    ],
  },
  {
    name: '北京产品互助团',
    key: '北京产品互助团',
    category: 'go-mulan',
    location: { province: '北京市', provinceCode: '110000', city: '北京市', cityCode: '110100', district: '朝阳区', districtCode: '110105' },
    region: '北京',
    theme: '转行做产品，需要有人一起打磨作品集',
    description:
      '六位从运营转产品的姐妹。作品集日、案例互评，还有不留情面的提问——这是她们进步最快的方式。',
    leadEmail: 'yangfan@mulan.org',
    leadName: '杨帆',
    members: [
      { email: 'mengyu@mulan.org', name: '孟雨' },
      { email: 'liruo@mulan.org', name: '李若' },
      { email: 'dengjia@mulan.org', name: '邓佳' },
      { email: 'wanglu@mulan.org', name: '王璐' },
    ],
  },
  {
    name: '成都民宿互助团',
    key: '成都民宿互助团',
    category: 'homestay-manager',
    location: { province: '四川省', provinceCode: '510000', city: '成都市', cityCode: '510100', district: '青羊区', districtCode: '510104' },
    region: '四川 · 成都',
    theme: '民宿运营里那些课上学不到的事',
    description:
      '十四位民宿管家，每月一次长桌聚会，聊淡旺季定价、聊差评、聊那些没人教过你的运营细节。',
    leadEmail: 'zhaomin@mulan.org',
    leadName: '赵敏',
    members: [
      { email: 'tangwei@mulan.org', name: '唐薇' },
      { email: 'liuqi@mulan.org', name: '刘琪' },
      { email: 'xulei@mulan.org', name: '徐蕾' },
      { email: 'gaoyuan@mulan.org', name: '高媛' },
    ],
  },
  {
    name: '深圳内容互助团',
    key: '深圳内容互助团',
    category: 'a-idol',
    location: { province: '广东省', provinceCode: '440000', city: '深圳市', cityCode: '440300', district: '南山区', districtCode: '440305' },
    region: '广东 · 深圳',
    theme: '给小店拍短视频',
    description:
      '五位做内容的姐妹，为街区里的店铺拍片。一部手机就够，她们轮流当彼此的摄影棚。',
    leadEmail: 'huangqi@mulan.org',
    leadName: '黄琪',
    members: [
      { email: 'wenshu@mulan.org', name: '温舒' },
      { email: 'zhoutao@mulan.org', name: '周涛' },
      { email: 'linjie@mulan.org', name: '林洁' },
    ],
  },
  {
    name: '西安服务互助团',
    key: '西安服务互助团',
    category: 'go-mulan',
    location: { province: '陕西省', provinceCode: '610000', city: '西安市', cityCode: '610100', district: '雁塔区', districtCode: '610113' },
    region: '陕西 · 西安',
    theme: '从客服到客户管理，职业路怎么走',
    description:
      '两年时间里从客服做到客户管理的姐妹们。她们做模拟面试，也把听到的每一个招聘消息互相转发。',
    leadEmail: 'maqian@mulan.org',
    leadName: '马倩',
    members: [
      { email: 'liyan@mulan.org', name: '李妍' },
      { email: 'wangyu@mulan.org', name: '王宇' },
      { email: 'zhaolei@mulan.org', name: '赵磊' },
    ],
  },
]

interface EventSeed {
  slug: string
  title: string
  type: 'event' | 'story' | 'template'
  /** 卡片形态：photo 有封面 / quote 无图 / template 带可下载文件 */
  variant: 'photo' | 'quote' | 'template'
  excerpt: string
  byline: string
  eventDate: string
  eventLocation: string
  attendeeCount: number
  circleSlug: string
  /** 模板类成果附带的可下载文件 */
  file?: { filename: string; lines: string[] }
  body: { heading?: string; paragraphs: string[]; bullets?: string[] }
}

const EVENTS: EventSeed[] = [
  {
    slug: 'prompt-to-workflow-hangzhou',
    title: '从一句话到一条工作流：杭州周六工作坊',
    type: 'event',
    variant: 'photo',
    excerpt: '二十一位姐妹带着自己岗位上真实的那件事来，散场时带走一个自己真的在用的助手。',
    byline: 'K7M3QX9B · 林晓',
    eventDate: '2026-09-20',
    eventLocation: '杭州 · 公益创投空间',
    attendeeCount: 21,
    circleSlug: '杭州 AI 互助团',
    body: {
      paragraphs: [
        '每个人都带了一件自己一直在躲的事：每周的报表、客人的投诉回复、三位产品经理要的同一份东西的三种版本。',
        '玩法很简单。先拿自己的事跑一遍，然后两人一组互相拆对方的流程。十分钟还卡住的组，才由带 facilitating 的那位介入。',
      ],
      heading: '什么最管用',
      bullets: [
        '带真实的工作来，不要用编出来的例子——能撑过周一才算数。',
        '两个人一组比听讲有效得多，每组都在改别人的东西。',
        '把「改简历」也放进同一场，十五个人当场就改完了。',
      ],
    },
  },
  {
    slug: 'portfolio-day-beijing',
    title: '作品集日：八份简历，八个故事',
    type: 'event',
    variant: 'photo',
    excerpt: '八位姐妹当众读自己的作品集。后面那些诚实的提问，才是这一天真正的部分。',
    byline: 'P4R8TD2N · 杨帆',
    eventDate: '2026-08-15',
    eventLocation: '北京 · 共享办公空间',
    attendeeCount: 34,
    circleSlug: '北京产品互助团',
    body: {
      paragraphs: [
        '这个形式更像排练，而不是路演。你把自己的案例读给全场听，房间里的人会问出招聘官会问的问题——然后再多问几句。',
        '前十分钟会不太舒服。之后，它会变成大多数人拿到的最快的一次反馈。',
      ],
      heading: '被问得最多的三个问题',
      bullets: [
        '这个决定是你做的吗？你为了它放弃了什么？',
        '半年后你用什么判断它是对的？',
        '这里面哪部分是你，哪部分只是需求本身？',
      ],
    },
  },
  {
    slug: 'guesthouse-operations-chengdu',
    title: '民宿运营，重新讲一遍',
    type: 'event',
    variant: 'photo',
    excerpt: '定价、差评，还有那些运营课里从来不讲的部分。',
    byline: 'C9V2HK6X · 赵敏',
    eventDate: '2026-07-18',
    eventLocation: '成都 · 二环',
    attendeeCount: 26,
    circleSlug: '成都民宿互助团',
    body: {
      paragraphs: [
        '十四位运营者，一张很长的桌子，规矩只有一条：每个故事都要讲到最后——「下次你会怎么做」。',
        '话题从旺季定价绕到那个订三晚却每一晚都投诉的客人，又绕回来。',
      ],
      heading: '她们后来写下来的',
      bullets: [
        '旺季和淡季，用同一套定价逻辑。',
        '差评回复，趁还生气的时候写完。',
        '把夜里接电话的人带教好——那才是整个生意。',
      ],
    },
  },
  {
    slug: 'shooting-for-small-brands-shenzhen',
    title: '给小店拍视频',
    type: 'event',
    variant: 'photo',
    excerpt: '五位姐妹，五部手机：一家街边小店该怎样给自己拍。',
    byline: 'S5W7JB3Q · 黄琪',
    eventDate: '2026-06-21',
    eventLocation: '深圳 · 滨海市场',
    attendeeCount: 19,
    circleSlug: '深圳内容互助团',
    body: {
      paragraphs: [
        '市场里每家店都拍了一分钟，规矩只有一条：不要配音。',
        '素材很糙。重点是店主自己就能在某个星期二做出来，房间里不用有别人。',
      ],
      heading: '留下来的几条',
      bullets: [
        '窗户边的自然光，胜过你拥有的任何一盏灯。',
        '一个想法只拍一条，后期再剪，别在拍的时候纠结。',
        '拍你真正擅长的那件事，而不是看起来最厉害的那件。',
      ],
    },
  },
  {
    slug: 'interview-clinic-xian',
    title: '两年，从客服做到客户管理',
    type: 'event',
    variant: 'photo',
    excerpt: '十二个人做了一整天的模拟面试，简历上多出来的不是话术，是判断力。',
    byline: 'X8N4LF5D · 马倩',
    eventDate: '2026-06-07',
    eventLocation: '西安 · 高新咖啡馆',
    attendeeCount: 12,
    circleSlug: '西安服务互助团',
    body: {
      paragraphs: [
        '规则很简单：每人一小时，面试官必须反问三次以上。被问的人后来都说，这三问比任何建议都值钱。',
        '那天结束时有四个人当场改了简历标题。',
      ],
      heading: '被反复问到的',
      bullets: [
        '你的日常工作里，有哪部分是你能讲清楚的？',
        '换个岗位看，你这段经历哪里是加分项？',
        '如果只能保留一件事，你留哪件？',
      ],
    },
  },
  {
    slug: 'what-the-first-year-taught-us',
    title: '第一年，我们学到了什么',
    type: 'story',
    variant: 'quote',
    excerpt: '十二个月，五个城市，一个结论：互助团需要一个固定的理由才能聚起来。',
    byline: 'K7M3QX9B · 五个互助团的共同复盘',
    eventDate: '2026-05-30',
    eventLocation: '五个城市',
    attendeeCount: 58,
    circleSlug: '杭州 AI 互助团',
    body: {
      paragraphs: [
        '最初几个互助团靠「有空的时候」聚会。这样运转了两个月，然后就安静地停了。',
        '真正让它稳定下来的办法其实很无聊：固定日期、固定地点，加一件要带的东西。别的什么都没变。',
      ],
      heading: '想告诉新互助团的话',
      bullets: [
        '先定日期，再定主题。主题会自己跟上来。',
        '每人带一样东西来，只要一样。它能让一个晚上不至于变成一堂课。',
        '趁还觉得显而易见的时候把有效的方法写下来，一个月后就不这么觉得了。',
      ],
    },
  },
  {
    slug: 'writing-the-handbook',
    title: '写那份手册',
    type: 'story',
    variant: 'quote',
    excerpt: '六个互助团、一份文档，和一场关于「该写多少」的争论。',
    byline: 'P4R8TD2N · 六个互助团共同起草',
    eventDate: '2026-04-12',
    eventLocation: '线上',
    attendeeCount: 24,
    circleSlug: '北京产品互助团',
    body: {
      paragraphs: [
        '我们想要一份这样的文档：新的互助团在火车上读完，周一见面就能开张。',
        '六个互助团交了笔记。争论不在内容，而在要解释多少，以及哪些事应该留给她们自己。',
      ],
      heading: '最后留下来的',
      bullets: [
        '怎么开第一次会，一页。',
        '怎么花钱，一页，用大白话写数字。',
        '不写任何「怎么申请」的部分。',
      ],
    },
  },
  {
    slug: 'resume-rewrite-circle',
    title: '简历逐行改写：二十份简历，四十双眼睛',
    type: 'story',
    variant: 'quote',
    excerpt: '不是讲座，是一场互相拆解的下午。有人改完当场就投了第一份。',
    byline: 'K7M3QX9B · 周雨',
    eventDate: '2026-03-22',
    eventLocation: '杭州 · 共享办公空间',
    attendeeCount: 20,
    circleSlug: '杭州 AI 互助团',
    body: {
      paragraphs: [
        '规则是：每个人带三份简历来，念给别人听，别人只问问题不给建议。',
        '被问的人一开始很不舒服，但那份「别人眼中我」的冲击，比任何模板都管用。',
      ],
      heading: '反复出现的三个问题',
      bullets: [
        '这一行里，你做的决定是什么？',
        '它带来了什么代价？',
        '半年后你靠什么知道它做对了？',
      ],
    },
  },
  {
    slug: 'xian-service-two-years',
    title: '两年，从客服到客户管理，我们记下了什么',
    type: 'story',
    variant: 'quote',
    excerpt: '不是成功学，是六个人把两年的弯路一条条写下来。',
    byline: 'X8N4LF5D · 李妍',
    eventDate: '2026-02-14',
    eventLocation: '西安',
    attendeeCount: 6,
    circleSlug: '西安服务互助团',
    body: {
      paragraphs: [
        '每个人的路都不一样，但有几句几乎每个人都说过。',
        '我们把它们原样记下来，没有加工。',
      ],
      heading: '被说过好几次的那几句',
      bullets: [
        '面试时对方问「你为什么换行业」，答案永远比经历本身更重要。',
        '别把第一份工作当成终身判决，它只是起点。',
        '学会看数据，比学会说话有用。',
      ],
    },
  },
  {
    slug: 'event-budget-template',
    title: '活动预算一页纸：五个互助团各改一版',
    type: 'template',
    variant: 'template',
    excerpt: '被五个互助团改过五遍的一页纸。谁都能拿去改，改成自己互助团的样子。',
    byline: 'C9V2HK6X · 徐蕾整理',
    eventDate: '2026-01-28',
    eventLocation: '成都',
    attendeeCount: 9,
    circleSlug: '成都民宿互助团',
    file: {
      filename: '数字木兰-活动预算一页纸.txt',
      lines: [
        '数字木兰 · 活动预算（一页纸）',
        '',
        '五六个人的互助团，每月一次。',
        '',
        '  场地          240',
        '  物料          140',
        '  交通          100',
        '  机动          60',
        '  ------------------------',
        '  合计          540',
        '',
        '让它保持简单的几条规则：',
        '  - 每类成本只占一行。写不进这一页的，就不是这次活动的一部分。',
        '  - 机动预算是真金白银，留着它。',
        '  - 交通费提前付，别事后算。',
        '  - 每张票据都留着，拍下来的票据也算。',
        '',
        '可自由复制与改编，注明出处即可。',
      ],
    },
    body: {
      paragraphs: [
        '一页纸，四行成本，一条规则：写不进这一页的，就不是这次活动的一部分。',
        '好几个互助团原样用了一年，现在还成立。',
      ],
    },
  },
  {
    slug: 'interview-cards-outcome',
    title: '面试练习卡：十二张，从四个互助团凑出来的',
    type: 'template',
    variant: 'template',
    excerpt: '每个互助团贡献了几道自己被问过的题，凑成十二张。配一个真的会反问你的人。',
    byline: 'P4R8TD2N · 李若整理',
    eventDate: '2026-01-09',
    eventLocation: '线上',
    attendeeCount: 15,
    circleSlug: '北京产品互助团',
    file: {
      filename: '数字木兰-面试练习卡-四团合辑.txt',
      lines: [
        '数字木兰 · 面试练习卡（12 张 · 四个互助团凑的）',
        '',
        '可以剪开，也可以照着念。最好打乱顺序。',
        '',
        '  1. 讲一次你做错的决定。',
        '  2. 为了这个决定，你放弃了什么？',
        '  3. 半年后你靠什么判断它是对的？',
        '  4. 这件事里你最自豪的是哪一部分？',
        '  5. 你做的事放在整盘生意里是什么位置？',
        '  6. 如果时间更充裕，你会怎么做？',
        '  7. 我还应该去问谁？',
        '  8. 你现在还不知道什么？',
        '  9. 你怎么判断一个东西好到可以交付了？',
        ' 10. 讲一次你改变主意的经历。',
        ' 11. 如果你站在我的起点上，你会给自己什么建议？',
        ' 12. 你在找什么？',
        '',
        '规矩：听的人至少要反问一次。',
      ],
    },
    body: {
      paragraphs: [
        '十二个问题，打乱着用。重点不是问题本身，而是听的人至少要反问一次。',
      ],
    },
  },
  {
    slug: 'homestay-pricing-table',
    title: '民宿淡旺季定价对照表',
    type: 'template',
    variant: 'template',
    excerpt: '十四个人的真实定价区间，摊在一张表上，谁都能拿去比。',
    byline: 'C9V2HK6X · 唐薇整理',
    eventDate: '2025-12-16',
    eventLocation: '成都',
    attendeeCount: 14,
    circleSlug: '成都民宿互助团',
    file: {
      filename: '数字木兰-民宿定价对照表.txt',
      lines: [
        '数字木兰 · 民宿淡旺季定价对照（成都互助团 · 十四人汇总）',
        '',
        '  时段        平日    周末    节假日',
        '  工作日       168     228     298',
        '  寒暑假      198     268     358',
        '  跨年周      238     328     428',
        '',
        '她们写下来的三条：',
        '  - 涨价要提前七天说，临期涨价客人会直接取消。',
        '  - 节假日溢价不是翻倍，是多两成到四成。',
        '  - 淡季宁可空着也别降价，降下来很难涨回去。',
        '',
        '数据来自各人自己店的真实区间，仅供参考。',
      ],
    },
    body: {
      paragraphs: [
        '十四个人的真实定价区间摊在一张表上。数字不重要，重要的是我们知道什么时候该涨、什么时候不该降。',
      ],
    },
  },
]

interface LibrarySeed {
  slug: string
  title: string
  category: string
  summary: string
  file?: { filename: string; lines: string[] }
  /** PDF 附件（品牌 VI 手册这类） */
  pdf?: { filename: string; title: string; lines: string[] }
  /** 外链（视频在线版这类） */
  url?: string
  coverTone?: number
  body?: { paragraphs: string[]; bullets?: string[] }
  /** 贡献这份资料的互助团（slug）；填了就会出现在该团的公开页上 */
  cohort?: string
  /** 资源类型（文件形态）：doc 文档 / video 视频 */
  type?: 'doc' | 'video'
}

const LIBRARY: LibrarySeed[] = [
  {
    slug: 'brand-vi-guide',
    type: 'doc',
    cohort: '杭州 AI 互助团',
    title: '数字木兰 品牌 VI 使用手册',
    category: 'vi',
    summary: 'logo、色卡与用法的完整说明：怎么用、怎么排、什么时候不要用。',
    coverTone: 4,
    pdf: {
      filename: '数字木兰-品牌VI手册.pdf',
      title: 'Digital Mulan - Brand VI Guide',
      lines: [
        'Version 1.0 / 2026',
        '',
        'Primary color  #B44A40',
        'Ink             #222222',
        'Paper           #F0EFEC',
        '',
        'Logo: keep clear space equal to the height of the mark.',
        'Type: use the Chinese serif for titles, sans for body.',
      ],
    },
    body: {
      paragraphs: [
        '这份手册是公开的：任何人都可以拿去用，不用先成为会员。',
        'logo 有透明底与深底两个版本，色卡里的三个颜色是全部——',
        '够用，也省得每次都要问。',
      ],
      bullets: [
        'logo 四周留白不小于标志本身的高度',
        '标题用衬线，正文用无衬线，别混',
        '对外场合只用主色一种强调色，别再叠别的颜色',
      ],
    },
  },
  {
    slug: 'brand-video-intro',
    type: 'video',
    cohort: '深圳内容互助团',
    title: '一分钟看懂：数字木兰在做什么',
    category: 'guide',
    summary: '项目介绍短片：谁在做什么、怎么加入、三分钟看完。',
    coverTone: 1,
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    body: {
      paragraphs: [
        '短片放在这里，页面里直接能播，不用跳去别处。',
      ],
    },
  },
  {
    slug: 'prompt-patterns',
    type: 'doc',
    cohort: '杭州 AI 互助团',
    title: '日常工作的提问模板',
    category: 'guide',
    summary: '六个在真实岗位上站得住的提问写法，以及三个看起来有用、其实不行的。',
    coverTone: 0,
    body: {
      paragraphs: [
        '大部分关于「怎么提问」的建议都是为演示写的。这六个是按周二下午写的。',
        '每一条都短到能记住，具体到不用查资料就能用。',
      ],
      bullets: [
        '先说读者是谁，再说任务。「写给没用过这个的人」比「写个回复」有用。',
        '一次要草稿，也要反对意见。一个提示词，两个产出，省一半改。',
        '让它把假设摆出来，再给答案。',
        '给它一个模板。结构永远比聪明重要。',
        '改两遍，不要一遍。第一遍不对，第二遍才准。',
        '当它不再变化就停手。第三稿和第二稿一样，说明成了。',
      ],
    },
  },
  {
    slug: 'event-budget-template',
    title: '活动预算表模板',
    cohort: '成都民宿互助团',
    category: 'template',
    summary: '五六个人的互助团办一场活动，一页纸预算，含真正要紧的那几个数字。',
    coverTone: 2,
    file: {
      filename: '数字木兰-活动预算模板.txt',
      lines: [
        '数字木兰 · 活动预算（一页纸）',
        '',
        '五六个人的互助团，每月一次。',
        '',
        '  场地          240',
        '  物料          140',
        '  交通          100',
        '  机动          60',
        '  ------------------------',
        '  合计          540',
        '',
        '让它保持简单的几条规则：',
        '  - 每类成本只占一行。写不进这一页的，就不是这次活动的一部分。',
        '  - 机动预算是真金白银，留着它。',
        '  - 交通费提前付，别事后算。',
        '  - 每张票据都留着，拍下来的票据也算。',
        '',
        '可自由复制与改编，注明出处即可。',
      ],
    },
    body: {
      paragraphs: [
        '一页纸，四行成本，一条规则：写不进这一页的，就不是这次活动的一部分。',
        '好几个互助团原样用了一年，现在还成立。',
      ],
    },
  },
  {
    slug: 'resume-rewrite',
    type: 'doc',
    cohort: '北京产品互助团',
    title: '简历逐行改写',
    category: 'guide',
    summary: '删什么、留什么，以及每一行留下的话都要回答的那个问题。',
    coverTone: 1,
    body: {
      paragraphs: [
        '简历不是职责清单，是一份决定清单，以及每个决定背后的取舍。',
        '一行一行往下改，每一行都问三个问题。',
      ],
      bullets: [
        '你做了什么决定，而不是你做了什么动作？',
        '为了这个决定，你放弃了什么？',
        '半年后你用什么判断它是对的？',
      ],
    },
  },
  {
    slug: 'policy-notes',
    type: 'doc',
    cohort: '深圳内容互助团',
    title: '数字就业政策速查',
    category: 'policy',
    summary: '多数人都符合条件、却没人去申请的那几类补贴，以及去哪里申请。',
    coverTone: 3,
    body: {
      paragraphs: [
        '就业补贴、见习岗位、职业培训补贴，基本都存在，也基本都躺在那里没人申领。',
        '这是一份阅读清单，不是法律意见。申请前请确认当期的申报窗口。',
      ],
      bullets: [
        '灵活就业就业补贴——通常面向毕业三年内的学员。',
        '见习岗位——多由本地企业发布，互助团里往往互相转发。',
        '职业培训补贴——可用于特定岗位的认证费用。',
      ],
    },
  },
  {
    slug: 'interview-practice-cards',
    type: 'doc',
    cohort: '西安服务互助团',
    title: '面试练习卡',
    category: 'template',
    summary: '十二个问题，打乱顺序用——配一个真的会反问你的人。',
    coverTone: 4,
    file: {
      filename: '数字木兰-面试练习卡.txt',
      lines: [
        '数字木兰 · 面试练习卡（12 张）',
        '',
        '可以剪开，也可以照着念。最好打乱顺序。',
        '',
        '  1. 讲一次你做错的决定。',
        '  2. 为了这个决定，你放弃了什么？',
        '  3. 半年后你靠什么判断它是对的？',
        '  4. 这件事里你最自豪的是哪一部分？',
        '  5. 你做的事放在整盘生意里是什么位置？',
        '  6. 如果时间更充裕，你会怎么做？',
        '  7. 我还应该去问谁？',
        '  8. 你现在还不知道什么？',
        '  9. 你怎么判断一个东西好到可以交付了？',
        ' 10. 讲一次你改变主意的经历。',
        ' 11. 如果你站在我的起点上，你会给自己什么建议？',
        ' 12. 你在找什么？',
        '',
        '规矩：听的人至少要反问一次。',
      ],
    },
    body: {
      paragraphs: [
        '十二个问题，打乱着用。重点不是问题本身，而是听的人至少要反问一次。',
      ],
    },
  },
]

/** 写入公众站演示数据 */
export async function seedShowcase(
  payload: PayloadClient,
  adminId: number | string,
  links: { planId?: number | string; reportId?: number | string } = {},
) {
  // ---- 互助团 ----
  const circleIds = new Map<string, number | string>()

  for (const circle of CIRCLES) {
    // 一个团只有一个团长：姐妹们不进系统，团长自己维护活动
    const lead = await ensureUser(
      payload,
      circle.leadEmail,
      circle.leadName,
      ['cohortLead'],
      circle.location,
      circle.category,
    )

    // 网址里的那一段：不透明随机串（同一个团每次跑种子都是同一串）
    const slug = deterministicCode(`circle:${circle.key}`)

    const existing = await payload.find({
      collection: 'cohorts',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })

    let cohortId: number | string
    if (existing.docs.length) {
      cohortId = existing.docs[0].id
      await payload.update({
        collection: 'cohorts',
        id: cohortId,
        data: {
          name: circle.name,
          region: circle.region,
          category: circle.category,
          location: circle.location,
          theme: circle.theme,
          description: circle.description,
          leader: lead.id,
          leaderTerms: [{ user: lead.id, from: '2025-11-01T00:00:00.000Z', to: null }],
          status: 'active',
          isPublic: true,
        } as any,
        overrideAccess: true,
      })
    } else {
      const created = await payload.create({
        collection: 'cohorts',
        data: {
          name: circle.name,
          slug,
          region: circle.region,
          category: circle.category,
          location: circle.location,
          theme: circle.theme,
          description: circle.description,
          leader: lead.id,
          leaderTerms: [{ user: lead.id, from: '2025-11-01T00:00:00.000Z', to: null }],
          status: 'active',
          isPublic: true,
          tags: [],
        } as any,
        overrideAccess: true,
      })
      cohortId = created.id
    }
    circleIds.set(circle.key, cohortId)

  }

  // ---- 活动 ----
  for (const [index, event] of EVENTS.entries()) {
    // 只有 photo 形态配封面；纵向 / 横向交替，瀑布流才有高低错落
    const cover =
      event.variant === 'photo'
        ? await uploadCover(
            payload,
            `cover-${event.slug}.png`,
            `${event.title} — 现场`,
            index,
            index % 2 === 0,
          )
        : null

    // 模板类成果挂可下载文件
    let fileId: number | string | null = null
    if (event.file) {
      const attachment = await replaceMedia(payload, {
        filename: event.file.filename,
        alt: event.title,
        file: {
          data: Buffer.from(event.file.lines.join('\n'), 'utf8'),
          mimetype: 'text/plain',
          name: event.file.filename,
          size: Buffer.byteLength(event.file.lines.join('\n')),
        },
      })
      fileId = attachment.id
    }

    const content = editorState([
      ...event.body.paragraphs.map((line) => paragraph([text(line)])),
      ...(event.body.heading ? [heading('h2', [text(event.body.heading)])] : []),
      ...(event.body.bullets ? [bulletList(event.body.bullets)] : []),
    ])

    // 网址里的那一段：不透明随机串
    const slug = deterministicCode(`publication:${event.slug}`)

    const existing = await payload.find({
      collection: 'publications',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })

    const data = {
      title: event.title,
      slug,
      type: event.type,
      excerpt: event.excerpt,
      eventDate: new Date(event.eventDate).toISOString(),
      eventLocation: event.eventLocation,
      attendeeCount: event.attendeeCount,
      byline: event.byline,
      cover: cover?.id ?? null,
      file: fileId,
      relatedCohort: circleIds.get(event.circleSlug) ?? null,
      relatedPlan: index === 0 ? (links.planId ?? null) : null,
      relatedReport: index === 0 ? (links.reportId ?? null) : null,
      featured: index === 0,
      publishedAt: new Date(new Date(event.eventDate).getTime() + 86400000).toISOString(),
      author: adminId,
      content,
    } as any

    let publicationId: number | string
    if (existing.docs.length) {
      await payload.update({
        collection: 'publications',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
      publicationId = existing.docs[0].id
    } else {
      const created = await payload.create({
        collection: 'publications',
        data,
        overrideAccess: true,
      })
      publicationId = created.id
    }

    // 回写反馈的 publishedAs：真实发布流程（createPublication）会写这个字段，
    // 不写的话团长会对着已经公开的内容还看得到"提名公开"的勾选框。
    if (index === 0 && links.reportId) {
      await payload.update({
        collection: 'activity-reports',
        id: links.reportId,
        data: { publishedAs: publicationId },
        overrideAccess: true,
      })
    }
  }

  // ---- 资料库 ----
  await seedLibrary(payload, adminId)
}

/** 公开站资料库（与真实互助团并存：不建团，只挂文件与正文） */
export async function seedLibrary(payload: PayloadClient, adminId: number | string) {
  for (const [index, item] of LIBRARY.entries()) {
    // 网址里的那一段：不透明随机串
    const slug = deterministicCode(`resource:${item.slug}`)

    let fileId: number | string | null = null
    if (item.file) {
      const attachment = await replaceMedia(payload, {
        filename: item.file.filename,
        alt: item.title,
        file: {
          data: Buffer.from(item.file.lines.join('\n'), 'utf8'),
          mimetype: 'text/plain',
          name: item.file.filename,
          size: Buffer.byteLength(item.file.lines.join('\n')),
        },
      })
      fileId = attachment.id
    }
    if (item.pdf) {
      // PDF 附件（品牌 VI 手册这类）：公开站可以直接翻着读
      const data = pdfAttachment(item.pdf.title, item.pdf.lines)
      const attachment = await replaceMedia(payload, {
        filename: item.pdf.filename,
        alt: item.title,
        file: {
          data,
          mimetype: 'application/pdf',
          name: item.pdf.filename,
          size: data.length,
        },
      })
      fileId = attachment.id
    }

    let coverId: number | string | null = null
    if (item.coverTone !== undefined) {
      const cover = await uploadCover(
        payload,
        `library-${slug}.png`,
        `${item.title} — cover`,
        item.coverTone + 2,
      )
      coverId = cover.id
    }

    const body = item.body
      ? editorState([
          ...item.body.paragraphs.map((line) => paragraph([text(line)])),
          ...(item.body.bullets ? [bulletList(item.body.bullets)] : []),
        ])
      : null

    // 网址里的那一段：不透明随机串
    const existing = await payload.find({
      collection: 'resources',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })

    const data = {
      title: item.title,
      slug,
      type: item.type ?? 'doc',
      category: item.category,
      summary: item.summary,
      file: fileId,
      cover: coverId,
      url: item.url ?? null,
      body,
      tags: [],
      publishedAt: new Date('2026-04-01').toISOString(),
      author: adminId,
      // 贡献这份资料的互助团：填了就会出现在该团的公开页上
      relatedCohort: null,
    } as any

    if (existing.docs.length) {
      await payload.update({
        collection: 'resources',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({ collection: 'resources', data, overrideAccess: true })
    }
  }
}

async function ensureUser(
  payload: PayloadClient,
  email: string,
  name: string,
  roles: string[],
  region?: {
    province: string
    provinceCode: string
    city: string
    cityCode: string
    district: string
    districtCode: string
  },
  program?: string,
) {
  // 演示用的手机号：由邮箱散列出来，稳定且不重复
  const phone = `139${String(Math.abs([...email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 100000000).padStart(8, '0')}`
  const data = {
    name,
    roles,
    program: program ?? 'other',
    region: region ?? null,
    phone,
    joinedAt: '2025-11-01T00:00:00.000Z',
    status: 'active',
  }
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    // 已有账号也刷一遍（地域 / 类别 / 角色会随项目变化）
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: data as any,
      overrideAccess: true,
    })
    return existing.docs[0]
  }
  return payload.create({
    collection: 'users',
    data: {
      email,
      password: 'Mulan@2026',
      ...data,
    } as any,
    overrideAccess: true,
  })
}
