# AGENTS.md · 数字木兰校友会互助团系统

> 面向在本仓库内工作的 Agent（MiniMax Code CLI / 桌面端 / 其他 Coding Agent）。
> 本文件是项目上下文与硬约束的唯一权威来源。

## 一、项目是什么

为《数字木兰校友会互助团SOP-AI豆计划（2026年10月）》搭建的**互助团运营系统**，
既承载"活动经费—审批—反馈—报销—付款"这条内部治理链路，也承载面向互联网大众的公开内容。

三条业务主线：

1. **入团链路**：项目组发邀请链接 → 对方在 `/join` 填资料注册（**注册即成为团长**）→ 自动建团或接管。公众**不必注册**即可浏览全部公开内容。
2. **活动与资金链路**：团长提交活动方案（含活动经费明细）→ 项目组审批 → 互助团实施并提交反馈 → 项目组核定报销 → 精选发布。
3. **公开内容链路**：项目组上传学习资源（任何人可公开学习）+ 精选内容推到前端（供互联网大众与普通成员观看）。

## 二、技术栈（硬约束，未经同意不得调整）

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript |
| 后台 | Payload CMS 3.92（Next 集成，`@payloadcms/next` / `@payloadcms/ui` / `@payloadcms/richtext-lexical`） |
| 数据库 | PostgreSQL 16（**开发与生产同一套**，2026-10-31 起不再支持 SQLite；`docker compose up -d postgres`） |
| UI | Tailwind CSS v4 + **shadcn/ui 组件库**（**Base UI** 底层，`@base-ui/react`），业务端不自研组件 |
| 表单 | 原生 FormData + Server Action（服务端逐条校验）；Zod 4 只用于 `/api/join` |
| 存储 | S3 兼容对象存储（留空则用 Payload 本地磁盘 `media/`） |
| 部署 | Docker Compose + Docker |

版本对齐：`@payloadcms/*` 统一 `3.92.0`；`@payloadcms/next@3.92` 的 peer 要求
`next >=16.3.3 <17`，本项目锁 `next 16.4.3`。Node 要求 `^22.23.4 || >=24.22.1`（Payload 与 CLI 的交集）。

> ⚠️ **装依赖注意**：国内镜像源（`registry.npmmirror.com`）尚未同步 Payload 3.92.0，
> 直接 `npm install` 会报 `ERESOLVE: Found: payload@undefined`。
> 请用 `npm install --registry=https://registry.npmjs.org`，**不要为了绕过它而降版本**。

## 三、代码约定

- **全站简体中文**（含演示数据、报错提示、空状态）。西文只出现在专有名词（Ant Foundation、AI）。
- **「地域」是全站唯一口径**（2026-10-31 第三十二轮）：省 / 市 / 区县这片地方，
  公众域与工作台的界面文案都叫**地域**（筛选标签、提示词、表单标签、团详情字段），
  **不再出现「区域」**；「行政区」是另一回事，只用于"已覆盖 N 个省级行政区"这类计数。
  代码里的 `region` / `location` 字段名不动，只统一界面上的字。口径见 `docs/设计规范.md` §6。
- **建团的地域可以只填到省**（2026-10-31 第三十二轮）：省必填，市 / 区县可留空；
  填到哪一级，团就落在哪一级（地图逐级下钻）。客户端与 `/api/join` 都只校验"省"。
- **已解散的团在公众站照常展示**（2026-10-31 第三十二轮）：主页 / 活动 / 资料一律不屏蔽，
  历史成果算数；公开读取层 `src/lib/public-data.ts` **不按 `status` 过滤**。
  但公众域不出现「解散」二字，只在团主页上用一行灰字讲事实
  （「这个互助团现在没有组织新活动了」），列表页与卡片不加任何状态标记。
  **现状数据与历史分开算**：首页的团数 / 地图 / 覆盖行政区只算运行中的团
  （`getCircles(200, { activeOnly: true })`），「场活动 / 人次参与」照旧按公开成果算；
  公开站团列表页仍列出已解散的团（否则它的主页没人找得到）。
- 颜色只用 `globals.css` 里 `@theme` 定义的 token（`fg` / `bg` / `muted` / `faint` / `rule` /
  `surface` / `inverse-*` / `accent` / `success` / `warning` / `danger`），**不写死十六进制色值**。
  **强调色 `--accent`（品牌紫 #7c3aed，取自标识）只允许出现在交互元素**（按钮、焦点环、悬停、选中态）
  与工作台的数据图表；状态只用 `StatusBadge`（绿完成 / 紫待处理 / 灰未开始 / 红驳回）；
  品牌渐变 `bg-brand` 只用于标识与登录 / 注册页的品牌面，上面只放大字（对比度见 globals.css）。
  ⚠️ 本项目的 `accent` 是品牌色，不是 shadcn 原意的浅灰悬停底——悬停底用 `console-accent`。
- 公众站版式一律来自 `src/components/site/` 的共享组件；页面里不允许拼版式类名。
  **这些共享组件本身由 shadcn/ui 拼出来**（Chip=Badge、ArrowLink=Button、Rule=Separator、
  成果卡/互助团卡/资源卡=Card）——公众站与工作台是同一套长相与动效，不分两套语气。
- **页头只留标题，解释收进「帮助」**（2026-10-30 第二十七轮）：每页页头只放标题（顶边仍 97px）
  + 一排操作 + 一个 ? 按钮；这一页的解释（口径、谁能看到）全在 `PageHelp` 弹窗里。
  新页面一律写 `help`，不要再往页头堆 `note` / `description`。
- **工作台与公众站是同一个产品**（2026-10-30 第二十五轮）：页头（display 字体标题 +
  一行批注 + 底部柔光分隔）、卡片（24px 大圆角 + `shadow-card`）、页面顶部柔光
  （`console-page`）、表格字号行距、空状态（花饰徽标）一律与公众站同一套口径，
  细节见 `docs/设计规范.md` §4.5.1。改工作台版式时对照那一节，别再长成两套语气。
- **业务端（工作台）一律用 shadcn/ui 组件**（`src/components/ui/*`，底层 Radix UI），不写自研 `ui-btn` / `ui-input` 这类 utility 当组件用；
  控件不小于按钮 44px / 输入框 48px；表单里的下拉用 `FormSelect`（`name` 由 Base UI 渲染隐藏 input），
勾选用组件库的 `Checkbox`。
- **字号下限：正文 17px，辅助文字与眉标签 15px。** 受众含 27–55 岁读者，小字是硬伤。
- **活动详情页的提示一律在右侧【处理】面板说**（2026-10-31 第三十三轮）：表单 `noValidate`，
  失败原因要写清是哪一项、哪一笔；别用浏览器英文气泡，也别把红色 Alert 塞在左边表格下面。
  上下文见 `src/components/console/ActivityIssue.tsx`。
- **一笔费用可以挂多个附件**（2026-10-31 第三十三轮）：`items[].receipt` 是 `hasMany`，
  每个附件都要写清对应哪一笔费用；新建反馈默认带出活动申请的预算明细；
  报销单留版本（`reimbursements.versions`），驳回重提沿用同一张单。
- 集合字段变更后必须重新生成类型：`npm run generate:types`。
- 新增集合后必须重新生成后台 import map：`npm run generate:importmap`。
- 访问控制一律写在 `src/access/`，不靠界面隐藏。
- **表结构只由迁移决定**（2026-10-31 起，`payload.config.ts` 里 `push: false`）：
  改了集合字段 → `npm run migrate:create <名字>` 生成迁移 → `npm run migrate` 执行 → `npm run generate:types`。
  开发态不再自动改表，开发库与生产库永远是同一套结构。原来 SQLite 的补列脚本（fix-sqlite-relations）已删。
- **内部业务数据只经服务端动作写入**（`actions.ts` 逐条校验角色、归属、状态机与指定审核人）；
  集合的 REST / GraphQL 写入一律 `opsOnly`（只给 CMS 后台账号）。新增集合照此办理，
  否则团长直接 `PATCH /api/<集合>/<id>` 就能绕过全部校验（见 §8.50）。
- 公开数据读取统一走 `src/lib/public-data.ts`（服务端 `overrideAccess` + 精确过滤），
  **禁止**在公开页面直接读内部集合。
- **公众站成果流按「活动开展日期」倒序，不按项目组推送时间**（2026-11-03 第四十九轮）：
  `getOutcomes()` 默认 `sort: 'eventDate'`（`publications.eventDate`）；首页成果流、`/activities`
  活动列表、活动详情页「相关活动」统一按它排。
  ⚠️ Postgres 的 `DESC` 默认把 NULL 排最前，所以 `public-data.ts` 把结果**分两批取**：
  有 `eventDate` 的按 `-eventDate`，没有的按 `-publishedAt` 接在后面（不让没有活动日期的成果顶到最前）。
- **公众站栅格**：资源列表与资源详情页的「资源里还有」用**同一套**栅格
  （`[grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]`）。
  ⚠️ 别在这条之外再写 `grid-cols-[minmax(0,1fr)]`——它会覆盖 `auto-fill`，
  卡片被拉成整行宽屏（2026-11-03 第四十九轮修的就是这个）。
- 文件一律走上传集合：`media`（公共媒体：封面 / 活动照片 / 学习资料附件）与
  `finance-evidence`（财务凭证：发票 / 收据 / 付款回单）。**财务凭证不得放进 `media`**。

> 🔒 **公众域铁律**：公众站任意页面不得出现登录 / 注册入口，也不得出现互助团的规则、
> 制度与内部术语。改动公众站前先读 `docs/设计规范.md` §0.1。
>
> ⚠️ **唯一例外（2026-10-31 用户明确要求）**：公众站顶栏导航右侧有一条竖线，
> 竖线后是「工作台」入口（**新标签**打开工作台域 `connect.*` 的登录页），再往右是紫色胶囊「联系我们」
> （2026-11-02 第三十四轮由「加入我们」改名，指向 `/contact`）。
> 这是**唯一**允许出现在公众域的登录指向；除此之外仍不得出现任何登录 / 注册入口。
> 入口文案与位置在 `src/content/site.ts` 的 `nav.workspace` 与 `nav.contact`，实现见 `SiteHeader.tsx` / `SiteNav.tsx`。

## 四、目录地图

```
src/
├── proxy.ts                     # 域名分流：管理域 vs 公众域（Next.js 16 官方约定）
├── payload.config.ts      # 集合注册、数据库适配器、存储、插件
├── access/index.ts        # 角色判定 + 集合级/字段级访问控制
├── lib/code.ts            # 不透明标识：随机串 / 查重 / 由固定键派生（种子用）
├── lib/slug.ts            # 集合的 slug 自动补齐钩子（generateSlug）
├── lib/workflow.ts        # SOP 状态机 + 经费标准口径（与 Payload 解耦）
├── lib/public-data.ts     # 公开数据读取层（成果 / 互助团 / 资料库）
├── lib/payload.ts         # 服务端 getPayload 封装
├── lib/site-url.ts        # 公开站绝对地址（管理域跳公众域用）
├── lib/host.ts            # 三域判断的唯一来源（proxy / layout 共用）
├── lib/upload.ts          # 站内上传助手（media / finance-evidence）
├── lib/format.ts          # 公众站统一的日期 / 体积格式
├── lib/lexical.ts         # Lexical 富文本状态构造器
├── lib/demo-assets.ts     # 演示资产生成器（几何封面 PNG / 文本附件）
├── content/site.ts        # 公众站文案唯一来源
├── collections/           # 16 个业务集合 + 2 个上传集合（media、finance-evidence）+ ops-users（后台账号）
│                        #   （2026-11-05 删掉了从未启用的 toolkits / opportunities，
│                        #    配置归档在 docs/collections-archive/）
│                        #   经费：annual-budget-settings（年度默认额度）/ cohort-budgets（单团覆盖）
│                        #   账号：password-resets（一次性密码重置链接）
├── components/ui/            # shadcn/ui 组件库（Button/Input/Select/Card/Table/Dialog/**Sheet**/Tabs…）
├── components/console/ChinaMap.tsx  # 互助团分布地图（ECharts，可下钻到区（县））
├── components/console/ActivityProgress.tsx # 活动进度：窄屏的紧凑状态条 + 底部抽屉
├── components/console/WorkspaceMenu.tsx    # 工作台窄屏导航抽屉
├── components/site/SiteNav.tsx  # 公众站导航：桌面横排 / 窄屏左侧抽屉
├── app/
│   ├── (site)/             # 公众域路由组：/ /activities（内部 /site-activities）/activities/[slug] /circles /circles/[slug]
│                        #   /resources /resources/[slug] /about /contact /404
│   ├── (admin)/(workspace)/ # 工作台域路由组：/（内部 /home） /activities/[slug] /circles（内部 /network） /resources（内部 /assets） /budget /settings …
│   ├── (admin)/(auth)/      # 工作台域：/login /join（独立外壳，不套工作台导航）
│   ├── (payload)/          # Payload 后台与 REST / GraphQL
│   └── not-found.tsx       # 全站中文 404（带站点头尾）
├── components/site/       # 站点头尾 + 共享组件（primitives / SiteHeader / SiteNav / OutcomeHero / OutcomeCard / OutcomeFeed / CircleCard / LibraryCard / RichText）
├── components/console/    # 工作台表单与看板
└── seed.ts + seed/         # 演示数据（治理链路 + 公众站展示数据）
docs/设计规范.md            # 前端设计规范（颜色、字体、间距、组件、禁止项）
docs/系统设计.md            # 组织模型、权限矩阵、状态机、字段字典、第八节 SOP 校准结论
docs/验收记录.md            # 验收清单的逐条结果、截图索引、踩坑记录
docs/验收截图/              # 验收截图
scripts/backup.sh          # 备份：pg_dump + 上传文件（保留 14 天）
scripts/migrate-sqlite-to-postgres.mjs # 一次性搬库脚本（2026-10-31 已执行，留作记录）
scripts/dev-common.sh       # 开发服务器公共逻辑：端口占用识别与接管
scripts/dev-run.sh          # npm run dev 入口（先接管 3000 再起；崩了自动拉起）
scripts/verify-dev.ts       # 开发服务器自愈验收：三域可用 / 热更新 / 崩了能自愈
scripts/restore-demo.ts    # 验收后还原演示态（删验收账号、恢复邀请码、清提名成果、重算成员数）
scripts/fetch-geo.ts       # 预取中国地图边界到 media/geo-cache/（省 / 市 / 区县三级）
scripts/seed-network.ts    # 按全国真实盘生成 318 个互助团（真实行政区划落位）
scripts/verify-round.ts    # 验收脚本：131 项（三域 / 权限 / 网址随机串 / 活动链路）
scripts/verify-security.sh # 安全边界冒烟：21 项（REST 写入 / 跨站 / 旁路接口 / 限流 / 响应头）
scripts/verify-versions.ts # 活动申请版本追溯：10 项（只对副本库 mulan_verify 跑）
scripts/verify-home.mjs    # 工作台首页专项：筛选前置 / 视图切换走地址 / 关键词全局（只读，11 项）
scripts/screenshots.ts     # 验收截图 → docs/验收截图/
```

## 五、SOP 状态机（改业务逻辑先看这里）

```
活动方案 draft → submitted → approved | rejected | revision_required → implemented → closed
活动反馈 submitted → accepted | revision_required
报销单   draft → submitted → approved | rejected → paid
付款     pending → processing → paid | failed
```

金额三段分离：**预算额 → 实际支出 → 申请报销额 → 核定金额**（可核减，必须填原因）。
活动设置（工作台「设置」，全局配置 `activity-settings`）：
- **预算合计 ≤ 预算上限**（默认 500 元）：超过则不能提交活动申请；
- **预计参与人数 ≥ 预计人数下限**（默认 1 人）：不足则不能提交；实际参与人数不设限制；
- **活动审核负责人**、**报销审核负责人**：只能从项目组成员中选，可以是同一人；
  只有对应负责人能审核，其他项目组成员只能查看与打印。
- **快照规则**：每份活动**建立时**记下当时的预算上限与人数下限（`ActivityPlans.ruleBudgetMax` / `ruleParticipantsMin`），
  之后修改设置不影响已存在的活动（草稿、待审核、已完成都按它自己的那一版）。
- **审核人**：待审核的活动换了负责人，自动切到最新负责人；已完成的审核记录保留当时的审核人，不随换人改变。

## 六、权限模型

**只有三种身份**：公众（不登录）、**团长账号**、**项目组账号**，
外加一个只在 CMS 后台用的 **admin 运营账号**（不是业务账号）。
**没有"普通成员"这一档**——注册进来就是团长（2026-10-25 第十三轮之四去掉）。

| 能力 | 公众 | 团长 | 项目组 |
| --- | :-: | :-: | :-: |
| 浏览公开内容 / 下载学习资源 | ✅ | ✅ | ✅ |
| 凭邀请链接注册（注册即成为团长） | ✅ | — | — |
| 提交活动方案（含经费） | ❌ | ✅ | ❌（项目组是审批方） |
| 审批方案 | ❌ | ❌ | ✅ |
| 提交活动反馈 | ❌ | ✅ | ❌（实施方是互助团） |
| 提交 / 核定报销 | ❌ | ✅ / ❌ | ❌ / ✅ |
| 上传资源 / 发布精选 | ❌ | 提名 | ✅ |
| 新建互助团 / 团成员管理 | ❌ | ❌ | ✅ |
| 设置年度预算 / 查看本团预算 | ❌ | 只读自己团 | ✅ |
| 重置团长密码（发一次性链接） | ❌ | ❌ | ✅ |
| 进入 Payload CMS 后台 | ❌ | ❌ | ❌（仅独立 ops 账号） |

**执行方 vs 审批方（2026-10-24 第五轮定稿）**

- 执行方 = 互助团：团长发起方案与报销、提交反馈、提名精选。
- 审批方 = 项目组：只批准活动、核定报销、登记到账；**不发起活动、不提交反馈、不提交报销**。
- 没有写权限的地方**照常能看**（同一个页面，入口按角色出现）。
- 写操作服务端再兜一次（`console/actions.ts` + 集合级 access），前端隐藏不是安全边界。

铁律：内部集合（方案、反馈、报销、付款、团成员）在集合层对未登录用户**全部关闭**；
公开页面只经 `publications` / `resources` 读取。
> ⚠️ 2026-11-05：`toolkits` / `opportunities` 两个集合全仓零读写、库里 0 行，
> 已连表一起删掉（见 `docs/collections-archive/README.md`）。

## 七、怎么跑、怎么验

```bash
npm install --registry=https://registry.npmjs.org   # 国内镜像源未同步 Payload 3.92.0
cp .env.example .env          # 填 POSTGRES_* 与 DATABASE_URI
docker compose up -d postgres  # 本地 PostgreSQL（5432 被占就在 .env 设 POSTGRES_PORT=5433）
npm run generate:types
npm run generate:importmap
npm run migrate            # 初始迁移已随仓库提供（src/migrations/）
npm run seed                   # 演示数据（5 个团 / 12 条成果 / 5 份资料 / 1 条走完全程的活动）
npx tsx --env-file-if-exists=.env scripts/seed-network.ts   # 全国网络：再补 318 个团（按真实盘落位）
npm run dev                    # 开发服务器（唯一入口：接管 3000 + 崩了自动拉起）
npm run dev:clean              # 先清 .next/dev 缓存再起（治 Turbopack 缓存过期）
                                # http://localhost:3000  ·  后台 /admin
```

> **端口 3000 只有一个实例，谁后起谁接管**（2026-10-30 修，用户反馈「每次都启动不起」；
> 2026-11-01 合并成单一入口）：
> `npm run dev` 经 `scripts/dev-run.sh`，启动前先**停掉本项目占着 3000 的旧实例**
> （含旧的守护实例），再接管 3000；端口被**别的程序**占着才报错，并说清是谁占的。
> **Next 16 的真实行为（2026-11-02 查 `node_modules/next/dist` 核实）**：
> Next 16 **没有** `Another next dev server is already running` 这个报错了（那是 Next 15 的老行为）。
> 它只会 warn 一句 `Port 3000 is in use by process X, using available port 3001 instead`，
> 然后**悄悄跑到 3001 去**。
> → 后果：旧实例继续在 3000 上服务，新实例在 3001，浏览器开的还是 3000，
>   **改代码看不到任何变化**——这就是「每次都启动不起 / 改了没反应」的真正来源。
>   所以这个接管脚本还得留：保证 **3000 上永远是最新的那个**。
> 公共逻辑在 `scripts/dev-common.sh`（识别端口占用 / 判定是不是本项目实例 / 接管 / 清死进程留下的锁）。
> ⚠️ 接管时**不许杀掉自己的祖先进程**（npm → sh → 脚本），`dev_ancestors` 负责排除。
> ⚠️ 判定「另一个守护实例」不能只靠 `pgrep -f dev-run.sh`：命令行里**提到**这个路径的
> 进程（编辑器、grep）与 `$(...)` 里的子 shell 都会被误认。`dev_is_supervisor` 逐个读
> `/proc/<pid>/cmdline`，要求**可执行文件是 bash/sh + 有一个词正好是脚本路径 + 工作目录是项目根**。

> **「每次 npm run dev 都很慢」怎么治的**（2026-11-02 实测后改，见 §8.84）：
>
> | 环节 | 改前 | 改后 | 怎么改的 |
> | --- | --- | --- | --- |
> | 到 `Ready` | 4.0s | **1.0s** | 接管不再死等 `sleep 1 + sleep 2`，改成**轮询**等端口空出来；守护实例也轮询 |
> | 首屏 `/` | 9.4s | **1.0s** | ① **不再每次清 Turbopack 持久缓存**（181MB，删了首屏要从头编译 5.2s）；② 后台预热（Payload 初始化 + 首页编译） |
> | 到能看首页 | ~13.4s | **~2.0s** | 上面两项合计 |
>
> - **缓存什么时候清**：旧实例收到 TERM 后**自己退了**（端口自己空出来）= 干净退出，
>   缓存是完整的，**保留**；没退、我们只能 SIGKILL 硬杀 = 缓存可能是半成品，**清**。
>   崩掉自动重拉那条路径（`dev-run.sh`）显式 `DEV_WIPE_CACHE=1`。
>   万一还是撞上 `module factory is not available`：`npm run dev:clean`。
> - **预热**（`dev_warmup`）：next dev 起来后**后台**打两发 ——
>   ① `/api/health`（只 `select 1`，不写库、无副作用）初始化 Payload
>   （连 Postgres + 加载 15 个集合，约 1.5 秒）；
>   ② 公众站首页 `/`，把最常打开的那条路由也提前编译好。
>   两条都在后台跑，**不阻塞用户**；日志里那条 `GET /api/health` 和 `GET /`
>   是预热请求，不是用户的访问（脚本会提前说明）。
>   ⚠️ ① 必须带 **CMS 域的 Host 头**——`/api/health` 在公众域是 404
>   （`src/proxy.ts` 的 `isPublicApi`），带错域就等于没预热。
> - **别再怀疑 Next 本身**：`next dev` 自己 262ms 就 Ready，慢的从来不是它。
>
> **热更新**：Turbopack 默认开着，实测改代码 → 重编译 **~30ms** → 刷新即见；
> 客户端组件走 Fast Refresh（浏览器不整页刷新）；**Payload 集合配置也会热更**
> （改 `labels` / 字段，后台导航立刻变，不用重启）。
> 启动日志里 `⨯ turbopackServerFastRefresh` 是 Next 打印的"默认值"提示，
> **实际生效为 true**（见 `node_modules/next/dist/server/lib/router-server.js`）。
> 偶发的 `module factory is not available` 是 Turbopack 持久缓存过期：
> `npm run dev:clean` 清掉 `.next/dev` 即可。

**三域名**（见 `docs/设计规范.md` §7.1，由 `src/proxy.ts` 按 `Host` 分流）：

| 域名 | 用途 | 谁进得来 | 本地访问 |
| --- | --- | --- | --- |
| 公众域 | 成果展示站，**不显示任何登录入口** | 任何人 | http://localhost:3000 |
| 工作台域 | 业务工作台 + 登录 / 邀请注册 | 团长 / 项目组 | http://connect.localhost:3000 |
| CMS 域 | Payload CMS 后台（数据工具） | **仅运维**（独立 ops 账号） | http://admin.localhost:3000 |

环境变量：`WORKSPACE_HOST`（工作台域，本地 `connect.localhost`）、`CMS_HOST`（CMS 域，本地 `admin.localhost`）。
**工作台路径不带 `/console` 前缀**，导航四项：活动 / 互助团 / **经费** / 资源
（资源与设置只给项目组；**经费**两项身份都看得到——项目组看全部互助团，团长只看自己那个团）。
工作台首页就是 `connect.localhost:3000/`（内部真实路径 `/home`，由 proxy rewrite），
其余是 `/activities/[slug]`（活动详情；**发起活动也在这里**：`/activities/new` 已删；
**活动列表已并入首页**，`/activities` 列表页已删；
网址里那一段是不透明随机串，见 §8.34）
`/budget`（经费：**两个视图**——各团年度预算 / 活动资金；项目组可统一设置、批量设置、单独设置，团长只读自己团。
  ⚠️ 首页原来的「资金」标签与资金分组已全部搬到这里，首页只留一个入口）
`/circles` `/circles/all`
`/circles/new` `/circles/<slug>` `/resources`（内部真实路径 `/assets`；团长点「我的互助团」进的也是 `/circles/<slug>`）
（互助团这几条的内部真实路径是 `/network/*`，由 proxy rewrite，URL 保持 `/circles`）
`/login` `/join` `/reset-password?token=…`（团长凭项目组发来的一次性链接设新密码；7 天有效、用过即失效）`/logout`。

⚠️ **proxy rewrite 到内部真实路径时，查询参数要一起带走**
（`target.search = request.nextUrl.search`）——
`/` → `/home` 与 `/circles` → `/network` 两条都踩过：查询参数一丢，筛选条件就传不到页面。
公众域访问这些路径与 `/admin` 一律 404；工作台域访问 `/admin` 跳 CMS 域。

> **账号体系分离**：Payload CMS 后台的登录源是独立的 `ops-users` 集合
> （`payload.config.ts` 的 `admin.user: 'ops-users'`），业务账号根本不在后台候选名单里。
> 后台账号在访问控制里按全局管理员处理（`access/index.ts` 的 `isManager = isProjectTeam || isOps`）。

演示账号：项目组 `admin@mulan.org` / `Mulan@2026`；团长 `lead@mulan.org`；
**后台运维 `ops@mulan.org` / `Mulan@2026`（只进 CMS 后台，业务账号进不去）**；
邀请链接 token `MULAN-8F3K2`（`invitation-links` 集合，绑定受邀邮箱 `new.sister@mulan.org`）。

**公众站验收清单**（每条都要在浏览器里实际点过）：

1. 公众域任意页面不出现登录 / 注册入口（含移动端与页脚）。
2. 公众域不出现任何内部术语与互助团规则（经费标准、审批流程、角色定义等）。
3. `/` 首页是**成果瀑布流**（不是分段博客）：首屏 ≥ 6 张成果卡、多列布局、类型筛选可用、数字指标在位。
4. `/activities/[slug]` 活动详情含日期、地点、署名与参与人数、纪实正文与现场照片（地址标识与工作台同一场活动相同）。
5. `/resources` 列出公开资源；`/resources/[slug]` 可匿名下载附件。
6. `/about` 只有项目介绍与合作入口，不含规则说明。
7. 管理域可登录并完成「方案 → 反馈 → 报销 → 付款」链路，发布后公众域成果流立即可见。
8. 公众域访问管理路径返回 404，且**页面是中文**（不是英文 `Not Found` 裸文本）。
9. `/` 的**两组筛选**（类型 / 互助团）都能用，能组合（`/?type=story&circle=hangzhou-ai`），URL 可分享。
10. `/circles/[slug]` 互助团详情页可打开：团是谁、做了什么、留下了什么；页面上的团名都点得进去。
11. 项目组「报销审核」通过后，活动**自动发布**到公众站（立即可见）；不通过则反馈退回团长修改（见 §8.52）。
12. `/contact` 是**合作联系页**（不是注册入口）：表单能提交，空表单被拒（400），页面无内部术语（见 §8.68）。

**可读性下限**（一并核对）：公众站正文 ≥ 17px、辅助文字与眉标签 ≥ 15px；
管理端按钮 ≥ 44px、输入框 ≥ 48px。

> ✅ **2026-10-24：以上 11 条 + 可读性下限已全部在真实浏览器里点过并通过**，
> 结果与截图见 `docs/验收记录.md`。跑完验收后用
> `npx tsx --env-file-if-exists=.env scripts/restore-demo.ts` 还原演示态
> （删验收账号与验收记录、恢复邀请链接可用、重算团成员数）。
>
> **验收脚本**：`scripts/verify-round.ts`（**在仓库里**，2026-10-25 起）——
> 三域边界 + 公众站规则 + 网址随机串 + 工作台权限 + 活动链路 + CMS 域，共 **123 项**
> （2026-10-30 起**全绿**：工作台 85 项 + 公众域 38 项）。
> 只验工作台：`VERIFY_SKIP_PUBLIC_CONTENT=1 npx tsx scripts/verify-round.ts`。
> 用法：`npx tsx scripts/verify-round.ts`（需要先 `npm run dev`）。
> 首页专项：`node scripts/verify-home.mjs`（筛选前置 / 视图切换走地址 / 关键词全局 / 联系页，11 项，只读）。
> 截图：`npx tsx scripts/screenshots.ts`（输出到 `docs/验收截图/r14-*.png`）。
> ⚠️ 旧的 `/tmp/acceptance/*.js` 在 2026-10-25 已随临时目录清空，不再存在；
> 本轮的断言改为**跟着结构与规则走**（不写死整句文案、不写死数字 id）。
> ⚠️ 断言要跟着文案走，别写死字符串。
> ⚠️ 活动详情页是**长文章 + 右侧处理栏 + 活动进度**：脚本直接找表单即可。
> ⚠️ 没有单独的「精选发布」了（§8.52）：报销审核通过 = 反馈采纳 + 自动发布。
> ⚠️ 活动反馈的照片**必须传 3 张**（SOP 3-5 张），少于 3 张服务端直接拒。
> ⚠️ 点击站内链接后要 `waitForURL(...)`，别只 `waitForTimeout`——会偶发读到上一页的文本。

## 八、交接执行结果（2026-10-24 已全部完成）

> 本节由接手人执行后回写。完整验收证据见 `docs/验收记录.md`（含 18 张截图），
> SOP 逐条校准结论见 `docs/系统设计.md` 第八节。

### 8.1 已完成

- ✅ **读 SOP 原文核对**（原待办 1）：结论已写回 `docs/系统设计.md` 第八节，并落到字段与校验——
  单场经费标准（人均 30 元 **或** 单场 500 元，口径见 8.2）、报销凭证必填形式（发票/收据/支付截图）、
  付款对账（流水号 + 金额一致）、邀请与注册口径、反馈必填项与 5 天时限。
- ✅ **补完遗留实现**（原待办 2）：
  - `RichTextBlock` 已换成 Payload 3.92 官方渲染器 `@payloadcms/richtext-lexical/react` 的 `RichText`
    （组件 `src/components/site/RichText.tsx`）。
    ⚠️ 3.92 已不再导出 `ReactRenderer` / `ReactRendererContextProvider`，官方入口就是 `RichText`。
  - `cohorts.memberCount` 改为在 `cohort-members` 的 `afterChange` / `afterDelete` 里自动统计，
    `cohorts.afterChange` 兜底重算（带递归保护）。
  - 工作台补齐站内上传控件：活动反馈可传照片 / 签到表 / 资金证明，报销每条明细可传凭证，
    学习资源可传附件（`src/lib/upload.ts` + `src/components/console/*Form.tsx`）。
  - `payload-types.ts` 已重新生成并通过 TypeScript 严格检查。
- ✅ **安装与运行**（原待办 3）：`npm install` → `generate:types` → `generate:importmap` → `migrate` → `seed` → `dev` 全部跑通。
- ✅ **构建验证**（原待办 4）：`npm run build` 通过，27 个路由全部生成，TypeScript 零报错，`npm run dev` 无报错。
- ✅ **逐条验收**（原待办 5）：本文档第七节 8 条清单**全部在真实浏览器里点过并通过**，记录见 `docs/验收记录.md`。
- ✅ **收尾**（原待办 6）：`README.md` 与本文件已同步更新。

### 8.2 本轮确定并写死的业务口径

| 项 | 口径 | 配置位 |
| --- | --- | --- |
| 单场经费标准 | 人均 ≤ 30 元 **或** 单场总预算 ≤ 500 元 → 本场可报上限 = `max(单场上限, 人均上限 × 人数)` | `ACTIVITY_BUDGET_CEILING_CENTS` / `ACTIVITY_BUDGET_PER_PERSON_CEILING_CENTS`（单位：分） |
| 超标处理 | 不硬拦提交，但**通过审批时必须写书面确认意见**，并全程留痕 | `reviewPlan` |
| 报销凭证 | 每行明细必填；形式限发票 / 收据 / 支付截图；凭证存 `finance-evidence`，仅项目组与本团可见 | `reimbursements.items[].receipt` |
| 付款对账 | 标记"已到账"必填流水号与付款日期；金额须与核定金额一致（容差 0.01 元） | `payments.externalRef` / `createPayment` |
| 反馈时限 | 活动结束后 5 天内提交，超期天数自动计算并在列表高亮 | `activity-reports.overdueDays` |
| 邀请与注册 | 公众免注册；团长凭邀请链接注册，链接绑定受邀邮箱，**注册即成为团长**并直接登录 | `/api/join` |

### 8.3 本轮修掉的阻塞性问题（回归时重点看）

1. `media` 集合原本**根本没定义**，所有文件字段 `relationTo: 'media'` 全部落不了地 →
   新增 `media`（公共媒体）+ `finance-evidence`（财务凭证）两个上传集合。
2. `cohorts` 误用 `internalRead`（其 where 是 `{cohort: {in: ids}}`，而 `cohorts` 没有 `cohort` 字段），
   团长在表单里看不到任何互助团 → 改为专用 `cohortsRead`。
3. `ReimbursementForm` 提交前 `data.delete('receipt')` 把已选凭证文件删掉 → 报销永远缺凭证。
4. `/api/join` 建号但不建会话，注册后被踢回登录页 → 改为注册后 `payload.login()` 并下发 Cookie。
5. 登出页用了 `DELETE /api/users/logout`，3.92 是 `POST`。
6. `payload.config.ts` 里残留 Payload v2 的 `nextPlugin()`（`@payloadcms/next/with-plugin` 在 3.92 不存在），
   `next.config.mjs` 里残留 `@payloadcms/next/with-payload`（3.92 是 `withPayload`）→ 均已改正。
7. 单场经费上限旧值 `500000` 分 = 5000 元，与 SOP 的 500 元差 10 倍 → 已按 8.2 口径改正。

### 8.4 仍待项目组拍板（不阻塞上线，已做成配置位）

1. 单场经费标准的**最终数值**（SOP 写"暂定，以最终通知为准"）——当前按 500 元 / 人均 30 元，改两个环境变量即可。
2. 报销凭证的**保留期限**与到期清理策略。
3. 付款对账清单的**导出格式**（基金会指定模板）。
4. 学习资源的**版权与外链策略**（当前站内托管 + 允许外链，未做外链失效提示）。
5. 精选内容的**审核级别**（当前项目组单级发布，`PUBLICATION_TWO_STAGE` 预留了两审开关位）。

### 8.5 前端重构（2026-10-24 第二轮）

第一轮把功能链路跑通后，前端整体推倒重做，规则见 `docs/设计规范.md`：

- **公众域重写**：删除 `/activities` `/stories` `/learn` `/cohorts` `/toolkits` `/opportunities`
  六个旧页面与全部解释性文案；公众域改为 `/` `/events` `/library` `/about` 四条路由。
- **视觉**：改为纯黑白灰（无品牌红、无圆角、无阴影），Display 用 Instrument Serif、UI 用 Inter；
  版式全部来自 `src/components/site/primitives.tsx` 的共享组件。
- **术语**：公众域用 circle / event / library / alumna（2026-10-24 第五轮起"互助圈"改称**互助团**），
  不出现"活动方案""报销"等内部术语。
- **双域名**：`src/proxy.ts`（Next.js 16 的官方约定，`middleware.ts` 已废弃）按 `Host` 分流；
  管理域承载 Payload 后台、工作台、登录与邀请注册；公众域对这些路径一律 404。
- **文案**：全部集中在 `src/content/site.ts`，改文案只改这一个文件。

### 8.6 第三轮：中文化 + 可读性 + 功能补全（2026-10-24）

- **全站改简体中文**：页面文案、导航、表单标签、报错、空状态，以及演示数据
  （互助圈名、活动标题与正文、资料标题与正文、附件文件名）。
- **字号与版式按 27–55 岁读者重排**：正文 17px / 辅助 15px，PC 容器放宽到 1680px，
  中文限宽从 `ch` 改为 `em`（≈一个汉字），display 阶梯按中文收紧。
- **交互控件"柔中带刚"**：唯一强调色（深砖红 `--accent`）只给按钮、焦点环、悬停；
  按钮 ≥ 44px、输入框 ≥ 48px、圆角 2px（版式直角原则的唯一例外）。
- **补全的功能**：活动类型筛选、活动现场照片画廊、邀请码管理、我的互助圈、
  按互助圈筛选方案、`sitemap.xml` 与 `robots.txt`。
- 详情见 `docs/验收记录.md` 第三节。

### 8.7 第四轮：成果瀑布流（2026-10-24）

用户反馈"像博客，不像社交的瀑布流；前端主要是展示大家的连接成果"，据此改造公众站：

- **首页 = 成果瀑布流**：`publications` 的每一条就是一张成果卡，CSS 多列实现，
  一屏 12 条；类型筛选（全部 / 活动 / 故事 / 模板）替代原来的分段叙事。
- **三种卡片形态混排**：照片卡（有现场图）/ 话语卡（无图，字大）/ 文件卡（可直接下载），
  靠形态差异制造高低错落。每张卡都必须带**归属**（圈名 / 城市 / 署名 / 参与人数）。
- **新增 `publications.byline`（署名）与 `publications.file`（可下载附件）**；
  成果类型扩展为 活动 / 故事 / 模板。
- **路由重构**：`/`（成果流）`/outcomes/[slug]`（详情）`/circles`（互助圈版图）
  `/library` `/about`；旧的 `/events` 改为 301 到 `/`。
- **封面素材换成照片感生成**（天空 / 柔光 / 地面 / 颗粒 / 暗角），纵向横向交替。
- 顺带修掉一个**真实产品缺陷**：Server Action 默认请求体上限 1 MB，
  上传现场照片必然报 `Body exceeded 1 MB limit` —— 已在
  `next.config.mjs` 里设 `experimental.serverActions.bodySizeLimit: '20mb'`。

### 8.8 第五轮：改称互助团 + 后台按角色分层（2026-10-24）

用户要求："改称互助团，不要叫小圈子；互助团核心成员的后台是一样的，只是根据权限不同，
可编辑操作的地方不同，没有编辑权限的地方大家都可以看本小组的内容；
项目组板块也能看各页面，只是不能发起活动，只能批准活动和批准报销；用语贴近中文语境。"

- **术语**：`src/` 内 26 处"互助圈"→"互助团"，清掉所有"圈子 / 个圈"残留；
  团名改为 `杭州 AI 互助团` / `北京产品互助团` / `成都民宿互助团` / `深圳内容互助团` / `西安服务互助团`。
- **访问控制**：`src/access/index.ts` 新增 `leadCreate`（仅团长可发起方案/报销）、
  `memberReportCreate`（非项目组可提交反馈）；三个集合的 create 规则随之切换。
- **后台分层**：管理端两套导航（互助团 5 项 / 项目组 10 项），方案/反馈/报销页的发起按钮按角色隐藏；
  `console/circle/page.tsx` 重写为"我能做什么"入口 + 本团只读内容。
- **文案**：`src/content/site.ts` 逐句改写（如"课上完了，互助开始""这些做法，本来就是留给下一个人的"）。

### 8.9 第六轮：把"点进去看"兑现 + 404 中文化 + 提名落地（2026-10-24）

用户说"你仔细想想"，据此补齐三处**真实缺口**（不是加装饰）：

1. **`/circles/[slug]` 互助团详情页**：此前 `getOutcomesByCircle()` 是死代码，
   而文案却写着"点进去，看每个团都做成了什么"——承诺与实现不符。
   现补详情页（团是谁 / 做了什么 / 留下了什么 / 别的团），
   并把首页、`/circles`、成果详情页的团名全部接上。
2. **首页两组筛选**：类型 + **互助团**，可组合（`/?type=story&circle=hangzhou-ai`），
   走 URL 参数 + 服务端渲染，不用客户端 JS。
3. **404 中文化**：原先公众域访问 `/console` 得到英文裸文本 `Not Found`。
   现改为 proxy 重写到 `/404` 页面（**状态码仍是 404**），根 `not-found.tsx` 兜底不存在的路径。
4. **「提名 → 发布」落地**：权限矩阵里的"团长：提名"此前没有实现。
   现由 `activity-reports.recommendedForPublish` 承担标记位，
   团长在反馈页提名 → 项目组在精选发布页一键转成公开成果（自动带出标题/摘要/日期/人数/现场照片/互助团）。
5. **修掉两条死链**：管理端 `/activities`、`/learn` 早已不存在 → 改指公开站绝对地址
   （`src/lib/site-url.ts`，管理域跳公众域必须用绝对地址）。
6. **补字段**：`learning-resources.relatedCohort`（资料归属哪个团）、`activity-reports.publishedAs`（防重复发布）。
7. **收紧一处越权**：`activity-reports` 的 update/delete 原为"登录即可"，
   改为 `internalUpdate`（项目组全部 / 核心成员限本团）。

### 8.10 第七轮：宽屏版式（2026-10-24）

用户反馈："前端和后台页面都采取页面宽屏，你目前的页面在网页两边留白太多了。"

- **容器放宽**：公众站与管理端统一 `2200px`（原 1680 / 1440），内边距 `20 / 32 / 48px`。
  1920 屏上内容**铺满**，2560 屏上两边各留约 `228px`。
- **宽屏多放一列**：≥1920px 时成果瀑布流与卡片网格升为 **4 列**——
  宽屏用来多放内容，不是把三列拉大。
- **首屏改两栏**（新增 `OutcomeHero`）：左边主张与数字，右边最新一条成果的现场图，可点进详情。
- **页头改两栏**：成果详情页左边标题摘要、右边档案表（新增 `MetaList`）；
  互助团详情页右边放三个数字。
- **统一顶部间距**：成果详情页首块由 `Section` 改为 `variant="flush"`，与首页一致。
- ⚠️ **宽屏断点必须用原生 CSS**（`.masonry` / `.grid-4up` 写在 `globals.css` 未分层样式里）。
  Tailwind v4 会把 `min-[1920px]:` 与 `--breakpoint-3xl` 排到 `xl` **之前**，
  结果被 `xl:columns-3` 覆盖——加 `!` 能糊过去但不可维护。

### 8.11 第八轮：三域分层 + CMS 账号隔离 + 工作台补建团（2026-10-24）

用户问："localhost 公共网页 / admin 工作台 / api 代替 Payload 后台，这样设计合理吗？
Payload 后台本来就是给项目组用的，但那个页面比较高冷。一般国际正规的软件是怎么规划的？"

结论与落地（规范见 `docs/设计规范.md` §7.1、§7.1.1、§4.5）：

- **三域分层**（按国际惯例，`admin` 留给最高权限的数据工具）：
  公众域 `localhost` / 工作台域 `app.localhost` / CMS 域 `admin.localhost`；
  `api.` 留给**真对外**的 REST/GraphQL（需要时才单开，独立 API Key）。
- **命名纠正**：Payload Admin 不是"API 页面"，是 CMS 后台（数据管理工具），
  它的"高冷"是设计意图——给少数运维用，不是一线业务界面。
- **账号体系分离**：新增 `ops-users` 集合，`admin.user: 'ops-users'`。
  实测：`ops@mulan.org` 能进后台（43 个集合入口），项目组与核心成员**都进不去**。
- **access 层**：`isOps`（靠 `user.collection` 判定）+ `isManager = isProjectTeam || isOps`，
  集合层 14 个文件的项目组判断统一换成 `isManager`（后台账号可修数据）。
- **proxy 多域表**：公众域管理路径 404；工作台域 `/admin` 跳 CMS 域；
  CMS 域 `/console` 跳工作台域（不制造死胡同）。
- **补工作台缺口**：`/console/cohorts/new`（新建互助团，团长自动入团）、
  `/console/cohorts/[id]/members`（加人 / 改团内角色 / 移出），
  入口挂在 `/console/circle`——项目组不再需要去 CMS 后台建团、拉人。

### 8.12 第九轮：工作台去 `/console` 前缀 + 域名改 `connect.`（2026-10-24）

用户反馈："`http://app.localhost:3000/console` 改成 `http://connect.localhost:3000/`，
反正每个网页都有 console 多余。"

- **域名**：`app.localhost` → **`connect.localhost`**（工作台域），CMS 域仍是 `admin.localhost`。
- **路径**：工作台所有页面**去掉 `/console` 前缀**（`/plans` `/reports` `/circle` …），
  导航、页面内链接、`revalidatePath` 一并改掉。
- **目录**：工作台页面从 `src/app/(admin)/console/` 移到 **`src/app/(admin)/(workspace)/`**，
  首页的真实路径是 `/home`（route group 不进 URL）。
- **首页对外是 `/`**：公众站已经占了 `/`，Next.js 不允许两个路由组提供同一路径，
  所以工作台首页由 `src/proxy.ts` 在工作台域把 `/` **rewrite** 到 `/home`（URL 不变）。
  其余页面都是真实路由，客户端导航不受影响。
- **兼容**：`/console` → rewrite 到工作台首页；`/cohorts` → 跳 `/circle`。
- **公众域**必须屏蔽工作台全部路径（`/home` `/console` `/plans` … `/logout`），一律 404。

### 8.13 第十轮：清掉全部兼容路径（2026-10-24）

用户规定："系统还没上线，不要什么兼容路径，一切勉强的操作都不要，统统改掉，并且记住这个规定。"

- **删旧路由**：`src/app/(site)/events/`（`/events` → `/` 的 301 兼容页）整目录删除。
- **删兼容跳转**：proxy 里的 `/console → 工作台首页`、`/cohorts → /circle` 全部去掉；
  proxy 现在只按域分工，不维护路径清单：CMS 域只服务 `/admin` 与 `/api`，
  公众域不屏蔽工作台路径（那些路径本就不存在，落到中文 404 页）。
- **删 `@deprecated`**：`access/index.ts` 的 `leadOrProjectTeamCreate` 兼容导出删除。
- **删别名账号**：`leader@mulan.org`（`lead@mulan.org` 的兼容别名）从种子脚本与文档里删除。
- **删清单里的死条目**：`robots.ts` 的 `/console`、`console-data.ts` 的 `ops-users`。
- **规定写进 AGENTS.md 第九节与设计规范 §7.3**：系统未上线，代码不留兼容路径；
  唯一例外是数据（用迁移脚本处理）。

### 8.13 第十一轮之二：CMS 后台的两处最小改动（2026-10-24）

用户问："payload没有独立的登录页面吗？现有的登录账号如果访问payload，应该提示的是无权访问。
不应该有登出的图标才对。你觉得呢。" 随后又反馈："你搞复杂了……用英文的原声页面提示无权访问就行了。
只是取消那个 login out 按钮就行。"

- **事实核对**（实测）：Payload 确实有独立登录页（`/admin/login`）；会话 cookie 的 domain 是
  精确主机名（`connect.localhost`），**不跨子域**，业务账号在 CMS 域没有会话；
  未登录时登录页本来也没有登出图标。
- **最终做法（按用户要求收敛）**：**完全用 Payload 原生界面**——英文、不汉化、
  不加任何提示、不做守卫页，只用 Payload 官方定制点改一处：
  `admin.components.logout.Button` → `src/components/payload/HideLogoutButton.tsx`：
  返回 null，**登出按钮消失**（Payload 渲染时用它替换默认 Logout）。
  权限边界靠**账号体系分离**（后台只认 `ops-users`）表达，不靠页面文案。
- **教训**：别自己造页面、别自己加文案。Payload 的原生界面 + 官方定制点就够了；
  用户要的是"去掉登出按钮"，不是"再写一段说明"。
- 自定义组件在 `payload.config.ts` 里必须写成 `{ path: '@/...' }`（直接传函数会让
  `generate:importmap` 报 "must be an object or a string"），组件签名要能接受 props。

### 8.14 第十一轮之二：业务端（工作台）视觉柔化（2026-10-24）

用户反馈："业务端的UI你使用的什么?看上去比较死板。比如用的是方框的。整体看上去一点都没有女性的那种柔。"

- **只改业务端**（工作台），公众站仍是"编辑排版"的直角 + 无阴影，两套语气分开。
- **暖白底**：`--color-console-bg: #faf7f4`、卡片纯白、分隔线暖浅（新增 `--color-console-*` 一组 token）。
- **圆角**：卡片 14px、表单块 16px、按钮/输入框 10px、状态标签与徽章胶囊 999px；
  页面里 43 处写死的 `rounded-none` 按用途批量换成对应圆角。
- **极淡暖阴影**（不是冷灰）：卡片 `0 1px 2px + 0 12px 28px -14px rgba(84,56,48,.12)`，
  列表项悬停轻微上浮。
- **字体**：`ui-rounded` 优先（macOS 的 SF Pro Rounded），无则回退。
- 强调色仍是深砖红——**靠形状与光影给温度，不靠粉色**。

### 8.14 第十一轮之三：业务端换成现成组件库（2026-10-24）

用户反馈："你用的是自己研究的ui吗？为什么不用tailwilnd?你这个自研的。
比如下拉选项的输入框就下拉框至很丑。你应该全面使用人家现成的而不是自研。"

- **装上真正的组件库**：shadcn/ui（Radix UI 底层），
  组件在 `src/components/ui/*`（Button / Input / Textarea / **Select** / Label / Card /
  Badge / Alert / Dialog / DropdownMenu / Table / Tabs / Separator / Avatar / Tooltip）。
  `components.json` 已建好，以后 `npx shadcn@latest add <组件>` 可直接加。
- **自研的 `ui-btn` / `ui-input` / `ui-badge` / `ui-error` 全部删除**，
  业务端代码改用组件；`globals.css` 里对应的自研 utility 也一并清掉。
- **下拉框全部换成 Radix `<Select>`**：23 处原生 `<select>` → `FormSelect`
  （`src/components/console/FormSelect.tsx`：Radix Select + 隐藏 input 承载 FormData，
  因为 Radix 是受控组件、不参与原生表单提交）。
- **主题接线**：shadcn 的 CSS 变量指向业务端暖色基调（`--background: #faf7f4`、
  `--primary: #b4463c` …），组件库与柔化调子不冲突。
- ⚠️ **两个坑**：
  1. **命名冲突**：我们的 `--color-muted`（文字色）与 `--color-accent`（强调色）早于 shadcn 存在，
     shadcn 同名变量会把 `text-muted` 变成近白色。已把 shadcn 的改为
     `--console-muted` / `--console-accent`（组件里用 `bg-console-muted` 等）。
  2. **不要在 `@theme` 里自造 `--spacing-*`**：Tailwind v4 一旦看到 `--spacing-*`，
     就会把所有数值类改读 `--spacing-<数字>`（我们原来的 `--spacing-12: 5rem` 让
     `h-12` 变成 80px，输入框失控）。**间距一律用 Tailwind 默认的 4px 基准**。
  3. shadcn CLI 认不出 Tailwind v4 的 CSS-first 配置 → 手写 `components.json`；
     组件里 `import { cn } from "cn"` 要改成 `@/lib/utils`；自定义组件在 config 里
     必须写成 `{ path: '@/...' }`。

### 8.15 第十一轮：活动 + 邀请链接 + 资源（2026-10-24）

用户要求："团长创建活动后，互助团核心骨干都可以编辑同一份方案，然后由团长提交活动申请（内容中包括预算），
项目组收到申请后进行审批、团长及成员编辑活动反馈（包括实际预算）、项目组审批报销并精选发布。
这是一个很顺畅的流程，互助团和项目组都可以查看这个完整流程的每个页面环节。只是编辑权限的区别。
独立办完一场活动算一条。项目组则可以查看全部互助团的。所以不需要工作台上面的很多标签tab页。
在互助团页面，项目组可以邀请创建，通过设置邀请链接的形式创建。不要搞邀请码。
学习资源改为资源，包括项目VI、视频、文本、图片等。资源都是公开的。不用区分什么公开不公开。"

- **工作台导航压到三项**：活动 / 互助团 / 资源。原来的
  `/plans` `/reports` `/reimbursements` `/reviews` `/payments` `/publications` `/invitations` 全部删除。
- **活动 = 一条完整记录**：新增 `/activities`（列表）与 `/activities/[id]`（详情），
  详情页一屏看完 ① 方案 ② 审批 ③ 反馈 ④ 报销 ⑤ 付款 ⑥ 精选发布，各环节按角色显示可编辑的表单。
- **编辑权分层**（新增 `memberPlanCreate` + `internalUpdate`）：
  骨干与团长**共同编辑同一份方案**（`updatePlan`），**只有团长能提交申请**（`submitExistingPlan`，
  并在集合钩子里挡住"非团长直接 PATCH status=submitted"的越权）；反馈（`updateReport`）成员与团长都能编辑。
- **集合改名**：`invitations`（邀请码）→ `invitation-links`（邀请链接，`token` + `purpose`）；
  `learning-resources` → `resources`（新增 `type` / `url`，去掉 `visibility`——**资源全部公开**）。
  迁移脚本：`scripts/migrate-rename-collections.ts`、`scripts/rebuild-invitation-links.ts`。
- **公众站 `/library` → `/resources`**，文案"资料库"→"资源"；工作台资源页在 `/assets`（避免与公众站同路径）。
- **邀请链接**：`/join?token=xxx` 支持两种用途——`create-cohort`（对方成为团长）与 `join-cohort`（加入指定团）；
  项目组在「互助团」页点「邀请创建互助团」生成链接。**不用邀请码**。
- **工作台页面**从 `src/app/(admin)/console/` 迁到 `src/app/(admin)/(workspace)/`，路径全部去掉 `/console` 前缀。

### 8.16 第十一轮之四：组件库收尾 + 流程修复（2026-10-24）

用户追问"有些地方是不是没有完全改到？"——扫描后发现三处**没改到**和两处**真问题**。

- **勾选框补齐**：3 处原生 `<input type="checkbox">` → `FormCheckbox`
  （`src/components/console/FormCheckbox.tsx`：Radix Checkbox + 隐藏 input）。
  Radix 的 Checkbox 是 `<button role="checkbox">`，**不参与原生表单提交**，所以必须配隐藏 input；
  服务端统一按 `=== 'on'` 判定。触控区 44×44（方框本体 24×24），标签 15px。
- **组件尺寸按规范调大**（shadcn 默认是 36px/14px，全部不合规）：
  Select 触发器 48px、Tabs 44px、下拉项 44px、Label/Badge/Table/Tabs/Dialog/Alert/Tooltip 字号 15px；
  业务端另有 85 处 14px 小字 → 15px。
- **自研样式块换成组件库**：23 处手写错误块（`rounded-xl bg-surface`）→ shadcn `Alert`；
  2 处手写表单外壳（`rounded-2xl border bg-white`）→ `Card`；重复明细卡 → `Card`；
  活动列表写死的 `rgba(...)` 悬停阴影 → Tailwind 阴影 token。
- **删死代码**：`CohortForm` + `createCohort`（建团早已改走邀请链接，组件没人引用）。
- **接回断掉的一环**：`PublishRecommendationForm`（「转成精选内容」）**没有被任何页面挂载**，
  团长提名后项目组在活动页看不到一键发布。现挂到 ⑤ 精选发布阶段（仅当团长已提名且尚未发布），
  并在项目组视角的反馈区显示「公开提名」。
- ⚠️ **修掉一个真 bug（回归重点看）**：`src/app/(admin)/(workspace)/actions.ts` 里 9 处
  `payload.create/update` **漏传 `user`**，集合 `beforeChange` 钩子拿不到 `req.user`，
  于是 `isManager(req.user)` 恒为 false → **项目组「采纳反馈」永远失败**（前端只显示"操作失败"）。
  其余环节因为 Payload 本地 API 默认 `overrideAccess: true` 侥幸通过。已全部补上 `user: user as any`。
  **教训：写 server action 时，`payload.*` 一定要传 `user`，否则钩子里的角色判定形同虚设。**

### 8.17 第十一轮之五：公众站并入组件库 + 全站动效（2026-10-24）

用户要求"WWW.页面也用 shadcn/ui 统一一致吧，包括动效"——此前公众站与工作台是两套语气
（公众站纯白底 / 直角 / 衬线大标题 / 无阴影 / 几乎没动效），工作台暖白底 / 圆角 / 柔阴影。

- **全站一套 token**：`--color-bg` 由纯白改暖白 `#faf7f4`、`--color-rule` 改 `#efe7e0`、
  `--color-surface` 改 `#f4efea`；新增 `--radius-card: 14px` / `--radius-control: 10px` /
  `--shadow-soft` / `--shadow-lift` / `--ease-soft`；
  `--font-display` 与 `--font-sans` 同栈（**全站一套 Inter**，Instrument Serif 已卸载）。
- **组件库接上公众站**：`site/primitives.tsx` 重写——`Chip` 用 `Badge`（新增 `inverse` 变体）、
  `ArrowLink` 用 `Button` 的 link 变体、`Rule` 用 `Separator`、
  成果卡 / 互助团卡 / 资源卡 / 版图页 / 资源详情的相关推荐全部改用 `Card`。
- ⚠️ **动效之前根本没生效**：`tw-animate-css` 没装，shadcn 组件里的
  `animate-in` / `fade-in-0` / `zoom-in-95` / `data-[state=open]:…` **全是空类**，
  下拉与弹层是"啪"一下出现的。已装上并 `@import 'tw-animate-css'`。
  **教训：换组件库要把它的动画依赖一起装，否则"看起来没动效"。**
- **内容层动效**：新增 `src/components/site/Reveal.tsx`（滚进视口时渐显 + 轻微上移）。
  纯增强：**没有 JS 时内容照样可见**（服务端 HTML 不带隐藏态），
  刷新时已在视口的元素不参与动画（避免闪一下）。
- **顺手清掉的空类**：`py-section`（对应的 `--spacing-*` 阶梯早已删除）、
  `--section-space`（定义了但没人用）、`globals.css` 里的 `.ui-label` / `.ui-notice`。

### 8.18 第十一轮之六：互助团网络地图（2026-10-24）

用户要求把工作台 `/circle` 改成"一张最新中国地图，可下钻到区县，每个县域标记互助团数量"，
并按**加油木兰 / AI豆计划 / 民宿管家 / 追风计划**四类筛选，右侧按团名首字母排序。

- **数据模型**：`cohorts` 新增 `category`（四类枚举）与 `location` 组
  （省 / 市 / 区县各存一个 6 位 adcode）。地图逐级下钻靠 adcode 定位。
- **地图数据**：DataV.GeoAtlas（阿里云公开区划，areas_v3 为最新一版）。
  `scripts/fetch-geo.ts` 预取到 `media/geo-cache/`；
  `/api/geo/[adcode]` 先读缓存、没有就现拉并落盘（**首次点开某省要联网**）。
- **地图组件**：`src/components/console/ChinaMap.tsx`（ECharts 按需引入）。
  三级下钻 全国 → 省 → 市 → **区（县）为最小单位**；只标有互助团的区域（数量 + 地名），
  否则 35 个省名会互相压住。
- **页面**：`/circle` = 类别筛选行 + 左地图 + 右列表（拼音排序）+ 「邀请创建互助团」；
  **不展示活动**。原来的"我的团"（成员 / 反馈 / 报销）移到 `/circle/mine`，功能不丢。
- **页头**：工作台左上角标题由「校友会工作台」改为「数字木兰校友会」。
- **筛选走 URL**（`?category=fuel,ai-bean`），服务端渲染，链接可分享。

### 8.19 第十一轮之七：按全国真实盘模拟互助团网络（2026-10-24）

用户问"如果互助团多了怎么显示？根据目前全国真实的项目情况，模拟那么多互助团"。

**真实盘（来源：民政部 / 中国日报 / 公益时报 / 河北省文旅厅 等公开报道，2024—2025）**

| 项目 | 真实规模 |
| --- | --- |
| 数字木兰系列计划 | 覆盖全国 **27 个省区市**（2019.1—2025.10 实施周期），投入 6.52 亿元，惠及 560 万乡村女性 |
| 加油木兰（公益保险） | **18 个省份、62 个欠发达县域**，559 万份保障 |
| AI豆计划 | **16 个县域数字就业中心**（甘肃积石山、陕西清涧 / 宜君、贵州万山 等），7500+ 人次在地就业 |
| 民宿管家培训 | **16 个省份**、8600+ 名民宿管家（全国已办到第 334 期） |
| 追风计划（乡村校园女足） | 支持 **200 支**乡村小学女子足球队、6000 名乡村女孩 |

**模拟规模**（`scripts/seed-network.ts`）：加油木兰 62 · AI豆计划 16 · 民宿管家 120 · 追风计划 120
= **318 个互助团**，落位用**真实行政区划**（DataV 的 2840 个县级单位，优先中西部县 / 自治县），
报道点名的真实县域（织金县、东乡族自治县、积石山县、清涧县、宜君县、万山区、蔚县、绥宁县…）
一律落在它们真正的位置上。

**互助团多了以后，界面这样扛**：

- **地图不画点、只画数量**：一个区域一个数字，团再多也只是计数；
  逐级下钻（全国 → 省 → 市 → 区/县）天然完成聚合。标签用 `labelLayout: { hideOverlap: true }` 防重叠。
- **列表分段落 + 可搜索 + 可排序**：默认 30 条，"显示更多"继续加载；搜索按团名 / 城市 / 区县 / 类别即时过滤
  （搜索框带一键清空，Esc 也能清）；排序可切「团名（拼音，默认）/ 成员数 / 类别」。
- **地图与列表联动**：点列表里的一个团 → 地图自动下钻到那个区县并高亮（砖红 + 白字）；
  点地图 / 面包屑 → 取消高亮。两者共用 `CirclePoint`（`src/lib/circle.ts`），
  联动状态放在客户端容器 `CircleNetwork.tsx` 里。
- **两栏定高 680px，列表在自己框里滚动**：否则 300+ 行会把整页撑到 5000px 高，地图画布被拉长、国土缩成一小块。
- **筛选走 URL**（`?category=fuel,ai-bean`，逗号连写），服务端渲染，链接可分享。
  类别是**直接切换**：点一下选中，再点同一个就取消它；「取消筛选」一次性清空全部。
  ⚠️ 逗号连写时服务端要按逗号拆开（`raw.flatMap(v => v.split(','))`），
  否则第二个类别会被当成一个不认识的整串，筛选看着"没生效"。
- **模拟团不在公众站展示**（`isPublic: false`）：公众站的"五个城市，五个互助团"要和数据对得上；
  工作台的网络图对所有角色完整可见——为此把 `cohortsRead` 放宽为"登录后可见全部在运转的团"
  （团名与所在地不是敏感信息，`isPublic` 只决定**公众站**是否展示）。

### 8.20 第十一轮之八：邀请链接重做 + 团长转移 + 路由改名（2026-10-24）

用户要求：互助团**只要团长一人**；邀请链接只做 3/7/14 天、用过即失效；注册填
姓名 / 地域（省市区）/ 项目类别 / 手机 / 邮箱；管理页要显示注册信息、状态管理、团长转移
（老团长信息保留、记在任时间区间）；**不解释、不要复杂**。

- **路由**：`/circle` → `/circles`（工作台域）、`/cohorts/new` → `/circles/new`、
  团成员页 → `/circles/<slug>/manage`（按钮文案「管理成员」→ **「管理」**）。
  ⚠️ 公众站本来就有 `/circles`（互助团版图），同一个路径不能有两个页面，
  所以工作台这边用**内部路径 `/network` + proxy rewrite**，浏览器里的地址仍是 `/circles`
  （与工作台首页 `/` → `/home` 同一套做法）。
- **邀请链接**：只有两种用途 —— `create-cohort`（建团，对方成为团长）、
  `transfer-lead`（团长转移，对方注册后自动接管）。**有效期固定 7 天**（不再有三档），用过即失效。
  链接指向**工作台域**（公众域的 `/join` 一律 404）。
- **注册表单**：姓名、所在省 / 市 / 区县（`RegionPicker` 三级联动，走 `/api/geo/[adcode]`）、
  项目类别（那四类）、手机号、邮箱、密码。团名按"区县 + 类别"自动生成。
- **管理页**：团信息（创建时间 / 成立时间 / 状态 / 类别 / 所在地）+ 团长注册信息
  （姓名 / 地域 / 类别 / 手机 / 邮箱 / 注册时间）+ 状态管理（运行中 / 暂停 / 已解散）+
  团长转移（生成转移链接）+ **团长任期**（每一任与在任时间区间，老团长信息保留）。
- **数据模型**：`cohorts.leaderTerms`（任期区间）、`users.region`（省市区 + adcode，
  替掉原来的 `city` 文本）、`invitation-links.validDays`。
- ⚠️ **两个真 bug**（都是本轮顺手修掉的）：
  1. 注册页一直在读一个**不存在的接口**（`/api/invitation-links?...`）→ 链接查询必然失败、
     注册页永远显示"链接不存在"。已补 `GET /api/invitation-links/[token]`（只按 token 查，不列表）。
  2. `users.city` → `users.region_*` 改名会让 Payload 的 SQLite 自动 push 弹**交互式确认**并卡住服务；
     按惯例用一次性脚本改表（`scripts/migrate-user-region.ts`）。
- **公众站 robots**：`/circles` 与 `/resources` 是公众站**自己的页面**（在 sitemap 里），
  不能屏蔽；旧的 `/circle`、`/cohorts` 已从屏蔽清单里删掉。

### 8.21 第十一轮之九：一个团只有团长（2026-10-25）

用户："一个团就一个团长就够了，因为只需要他维护活动即可。"
——**成员概念整个去掉**，一个团 = 一个团长 + 一堆活动。

- **删掉** `cohort-members` 集合、`cohorts.memberCount`、`CohortMemberManager` 组件、
  三个成员管理 action（加 / 改角色 / 移除）、公开站与工作台的所有"成员数"展示。
  库里那张表也一并删掉（`scripts/migrate-drop-members.ts` 一次性改表）。
- **角色简化**：`团长`（维护自己那个团的活动）、`项目组`（审批 / 核定 / 付款 / 发布）、
  `已注册（还没带团）`——**这一档已删**：现在注册进来就是团长。
  "骨干能编辑不能提交"这个中间态没有了——**团长对自己那个团全权维护**。
- **权限口径**：`canActForCohort` 从"是不是这个团的成员"改成
  **"是不是这个团的团长"**（`cohorts.leader === user.id`）；
  集合 access 的 `create` 也换成了 `leadPlanCreate` / `leadReportCreate`
  （按 `data.cohort` 判：这个团的团长才能在这个团里起草）。
- ⚠️ **本轮挖出的一个真问题**：Payload 的**本地 API**（`payload.find({ overrideAccess: false })`）
  **并不会真的按集合 access 拦查询**——同一个用户走 REST 是 403，走本地 API 照样把数据全返回。
  所以"按团隔离"必须**显式写进查询条件**（`ownCohortWhere(user)`），
  页面里再叠一层 `where`。集合 access 只能当第二道防线。
- ⚠️ **proxy rewrite 会把查询参数吃掉**：`new URL('/network', request.url)` 不带 search，
  工作台的 `/circles?category=…` 到服务端就没了筛选条件（类别筛选整个失效）。
  rewrite 时要 `target.search = request.nextUrl.search` 一起带走。
- **公开站**的数字指标从"成员数"改成**参与人次**（成果里的参与人数之和）；
  团卡片与团详情页显示**团长**而不是成员数。

### 8.22 第十一轮之十：互助团"更多"页 + 团详情页重做（2026-10-25）

用户要求：互助团点「更多」跳到一个新页面（全部互助团列表）；列表里的「管理」改成「查看」；
**单个互助团页面按 shadcn/ui 重做，并加入活动信息**。

- **新增 `/circles/all`**（内部 `/network/all`）：全部互助团名录。
  323 个团铺成一列有 48000px 高，改成**三列紧凑网格**（`CohortDirectory`）→ 15000px，
  带搜索（团名 / 城市 / 区县 / 类别 / 团长）。类别筛选条抽成共享组件 `CategoryFilter`。
- **列表行动入口**：「管理成员 →」改「**查看 →**」，指向 `/circles/<slug>`。
- **团详情页重做**（`/circles/<slug>`，内部 `/network/[slug]`）：shadcn/ui 的 Card / Badge / Button，
  三块内容——**团信息**（团名 / 类别 / 所在地 / 创建时间 / 成立时间 / 状态 / 简介）、
  **团长**（姓名 / 所在地 / 类别 / 手机 / 邮箱 / 注册时间 / 团长任期区间）、
  **活动**（这个团的每一场活动，带方案 ✓ 反馈 ✓ 报销 ✓ 环节标记，点进去是活动详情）。
  项目组额外看到**状态管理**与**团长转移**（原 `/circles/<slug>/manage` 的内容并入此页，该旧页删除）。
- 提醒：改路由时**入口按钮的 href 也要一起改**——上一轮就漏了"邀请创建互助团"按钮，
  页面文字没变但链接还指着已删的旧路径，点下去 404。验收项要**实际点击**才抓得住。

### 8.23 第十一轮之十一：活动页改成"按状态推进"的步骤条（2026-10-25）

用户要求：活动列表**按项目类型划分**；活动详情页做成**步骤推进型**（像从左到右的 tab），
"这个页面应该是根据状态来推进，而不是一下把页面全部显示出来"，同时要体现
**每一次推进的内容**、**提交/审批进度**、以及**数据（人数、经费）**。

- **活动列表**：按互助团的类别（加油木兰 / AI豆计划 / 民宿管家 / 追风计划）分组，每组一个标题 + 数量。
- **活动详情**：顶部**关键数据带**（预计参与 / 预算 / 实际参与 / 实际支出 / 核定金额），
  下面**六步步骤条**（方案 → 审批 → 反馈 → 报销 → 付款 → 发布）：
  - 当前这一步摊开写；走过的可点回去回顾；**还没到的锁住**（灰、不可点）；
  - 每步带自己的关键数据（人数、经费、提交人、审核人）。
  - 新组件 `src/components/console/ActivitySteps.tsx`（客户端，步骤状态由服务端算好传进来）。
  > ⚠️ 这一版的步骤条已在第十二轮之二换成「左信息 + 右侧环节导航」，见 §8.26；本节留作过程记录。
- **修掉一处自造的流程死角**：步骤的"锁定条件"一开始比表单自身的条件严
  （④报销、⑥发布都锁在「反馈已被采纳」之后，而表单只要"有反馈"），
  结果团长提交完反馈就点不到报销那一步。已把锁定条件改回与表单一致：
  ④报销 / ⑥发布 的前置都是「有活动反馈」。规则写进 `docs/设计规范.md` §4.5。
- 步骤按钮加 `data-step="<key>"`，验收脚本按属性定位（不硬匹配中文标题）。
- **默认展开哪一步改成按角色算**（`landingStep`）：原来取「第一个 active 步」，
  结果项目组采纳反馈后被落到一个**空的报销步**，而他们真正待办的是最后一步发布精选。
  现在由服务端按"这个人现在有事要做"算好再传给步骤条（规则见 `docs/设计规范.md` §4.5）。
- 验收脚本跟上步骤条：run2 / checkbox 改为"先点开那一步再断言"（`gotoStep`）；
  circle-flow 的「管理 →」改成「查看 →」（上轮改了文案，脚本没跟）。
- **演示数据走完整条流程**：种子原来只到"报销核定"，没有付款记录，步骤条上会出现
  「⑤ 付款未登记、⑥ 精选已发布」的倒挂。已在种子补一条已到账付款，
  并回写反馈的 `publishedAs`（原来精选建了但没回写，团长对着已公开内容还看得到提名框）。

### 8.24 第十二轮：团详情页改左信息右活动（2026-10-25）

用户看的是 `http://connect.localhost:3000/circles/sim-homestay-513231-89`（一个模拟团），
要求"左侧改成互助团信息，右侧改成活动列表，最新活动排在最上面"。

- 原版式：团信息（2/3 宽）+ 团长（1/3 宽）横排一行，活动列表整行铺在下面。
- 现版式：**左窄右宽两栏**（`lg:grid-cols-3`）：
  - 左栏 1/3：团信息 → 团长（含任期区间）→ 项目组才有的状态管理与团长转移；
  - 右栏 2/3：活动列表，每场活动一张卡（方案 ✓ 反馈 ✓ 报销 ✓ 标记 + 状态徽标）。
- **活动按活动日期倒序**（`plannedAt` desc，同一天按 `createdAt` desc）——
  `findForUser` 默认按 `-createdAt` 排，那是"记录创建时间"，不是"活动新旧"。
- 活动卡加 `self-start`，不跟着左栏高度拉伸出大片空白。
- 改动文件：`src/app/(admin)/(workspace)/network/[slug]/page.tsx`。

### 8.25 第十二轮之二：活动详情页改「左信息右导航」+ 发布闸门（2026-10-25）

用户看的是 `http://connect.localhost:3000/activities/1`，要求：
"左侧大部分是活动信息，一共分成活动方案、审批、活动反馈、报销；
活动反馈右上角存在一个精选发布，报销通过后显示可用，报销未通过则置灰（置灰不可通过 api 强行发布）；
左侧往下滚动时，右侧固定显示每个环节审批状态，类似一篇文章的导航。"

**这是把上一轮的「六步步骤条」整个换掉**：

- 新组件 `src/components/console/ActivitySection.tsx`（区块：标题 + 状态徽标 + 右上角操作 + 可展开面板）
  与 `src/components/console/ActivityOutline.tsx`（右侧 sticky 环节导航 + 滚动联动高亮）。
- **旧的 `ActivitySteps.tsx` 已删**（不再有 `data-step` 属性，验收脚本相应改了）。
- 左边四块：① 活动方案 ② 审批 ③ 活动反馈 ④ 报销。
  顶部保留关键数据带（人数与经费）。
- 右侧 `lg:grid-cols-[minmax(0,1fr)_272px]`，导航 `sticky top-6`，
  高亮按**阅读线**（视口 30% 处）判定——固定 140px 在窄屏上会失真。

**发布闸门（关键）**：

- 前置 = 反馈已采纳 **且** 报销已核定（approved / paid）；不满足则按钮置灰并说明原因。
- ⚠️ **闸门在服务端**：`publishContent` / `publishFromReport` 都要查报销状态
  （`actions.ts` 的 `reimbursementApproved`），前端置灰只是提醒。
- 活动页里 `PublishForm` 的「关联活动方案」锁成隐藏字段——不给"不关联"的口子，
  否则把 relatedPlan 清空就能绕开闸门。
- 实测：报销未核定时强行提交 → 服务端返回「这次活动的报销还没有核定，不能发布精选」。

### 8.26 第十二轮之三：按 SOP 原文重核活动各环节要素（2026-10-25）

用户给了 SOP 原件《数字木兰校友会互助团SOP-AI豆计划 (2026年10月）.pdf`，要求
"把活动各环节的要素按文件要求重新核对一遍，再修改网站内容，重新优化活动详情页面"。

**核对结论**（逐条写进 `docs/系统设计.md` 第八节）：

- 原来已经对齐的：《活动申请表》八项、《活动反馈表》大部分（签到名单 / 总结 200 字 / 成员感受 /
  照片 / 资金证明照片 / 签到表）、审核两态、报销凭证必填、单场经费标准、5 天反馈时限。
- **本轮补上的三处缺口**：
  1. **活动开展时段**——SOP 反馈表第三项要写到「14:00-16:00」，原来只存日期。
     新增 `activity-reports.actualStart` / `actualEnd`。
  2. **必要物料与价格**——SOP 反馈表第八项的文字部分原来只有照片证明。
     新增 `activity-reports.materials[]`（name / price / note）。
  3. **现场视频**——SOP「务必保留证据……现场视频」。新增 `activity-reports.videos[]`，
     `media` 的 mimeTypes 加 `video/*`，视频用 `visibility=internal`（不进公开站）。
- **收紧一条**：活动照片从「至少 1 张」改成 SOP 要求的**至少 3 张**（服务端 `submitReport` 硬拦）。
- **顺带修一个既有 bug**：`updateReport` 没保存 `theme`，编辑反馈时"活动主题"改了不生效。

**活动详情页按 SOP 表单字段顺序重排**（新建 `src/components/console/ReportDetail.tsx`）：

- ① 活动方案：按《活动申请表》顺序（互助团名称 / 申报时间 / 申报人 / 主题 / 时间 / 地点 / 人数 …）
- ③ 活动反馈：按《活动反馈表》八项 + 签到表，照片/感受/签到名单/物料清单全都看得见
- ④ 报销：补**明细与凭证表** + **循环启动**（付款完成后给"筹备下一场活动 →"）
- 新增验收脚本 `sop-check.js`（9 条）

### 8.27 第十二轮之四：工作台导航 + 活动页吸顶 + 去冗余 + 热启动（2026-10-25）

用户三条意见：
"整个业务端系统的导航做得比较差"；
"页面滚动时候，活动主标题及右侧页面导航应该一直在顶端固定"；
"页面的内容存在太多重复和冗余以及排版层次和布局不平衡"；
后来又加了一条"加入热启动。改代码随时可以编译"。

**导航**（`layout.tsx` + 新组件 `src/components/console/WorkspaceNav.tsx`）：

- 顶栏 `sticky top-0`（半透明底 + 背景模糊）；三块：品牌+角色 ｜ 主导航 ｜ 公开站 + 用户 + 退出。
- 导航项做成**药丸按钮**，当前项 `bg-fg text-inverse-fg`（填色深字）——
  ⚠️ 判定用 `usePathname`，**`/circles`（内部真实路径 `/network`）两个都要匹配**，否则在互助团页不亮。
- 页头统一用新组件 `src/components/console/PageHeader.tsx`（左标题右操作）；
  各页"怎么用"式的解释段落删掉。
- ⚠️ **吸顶偏移不许靠猜**：顶栏写死 64px、标题条写死 56px，
  偏移量放在 `globals.css` 的 `--workspace-header-h` / `--workspace-bar-h` / `--workspace-stack-top`。
  之前用 `top-16` 而顶栏实际 72px，标题条每次滚动都往顶栏底下钻 8px。
- ⚠️ **页面不要再自带 `py-6`**：`main` 的 `py-8` 已经够，两层叠加会在导航下面空出 56px。
- 右栏环节导航的容器用 `lg:self-start` + 自己的 `sticky`，
  不要把空盒子拉满整列来撑吸顶（否则右栏是一条几千像素高的空柱子）。
- ⚠️ **工作台里必须有自己的 404**（`src/app/(admin)/(workspace)/not-found.tsx`）：
  不放的话会落到全局那个——它带的是**公众站的页头页尾**，
  点进一个已删除的活动，工作台导航会整个换成公众站的（人当场迷路）。
- 顶栏与标题条都用**不透明底色**（`bg-background`）：半透明 + 模糊会让滚过去的内容透上来，
  看着像"它在动"。
- ⚠️ **工作台页面取用户要用 `requireUser()`**，不能写 `(await currentUser())!`：
  Next.js 的 layout 与 page 是**并行渲染**的，layout 里的 `redirect('/login')`
  拦不住 page 自己解引用 `user.id`——会话失效（比如验收脚本把账号删了、
  浏览器还带着旧 cookie）时页面直接 500。`requireUser()` 自己兜住并跳登录页。

**吸顶**：

- 活动详情页主标题条 `sticky top-16`（紧贴顶栏下面），右侧环节导航 `sticky top-32`。
- 区块要 `scroll-mt-36`，否则锚点跳转后标题被吸顶条盖住。
- 主标题条用**负 margin 撑满容器**（`-mx-5 md:-mx-8 xl:-mx-12` + 同值 padding），
  否则 >2200px 屏上内容会从容器两侧的空白里透出来。

**去冗余**（写进 `docs/设计规范.md` §4.5 的"同一个数字只出现一次"）：

- 删掉顶部"关键数据带"——预计参与/预算在方案区，实际参与/实际支出在反馈区，
  核定金额在报销区，**同一个数字只出现一次**。
- 「活动主题」= 页面主标题（吸顶那行标着「活动主题」），方案区不再重复列一行。
- 反馈区的主题/地点/时间收成**一行**（字段名照 SOP 写，不铺成五行）。
- 经费明细表 `max-w-2xl`（不横跨 1200px）；方案区改两列字段网格。

**热启动**：

- Turbopack 的热更新**本来就是开的**（日志里 `⨯ turbopackServerFastRefresh` 是默认值提示，
  实际生效为 true，见 `next/dist/server/lib/router-server.js`）。
  实测：页面重编译 ~30ms、客户端组件走 Fast Refresh、**Payload 集合配置也热更**（后台导航立刻变）。
- 新增 `scripts/dev-watch.sh` + `npm run dev:watch`（守护：崩了自动拉起，
  非正常退出先清 `.next/dev`）、`npm run dev:clean`（清缓存再起）。
- 治「module factory is not available」：Turbopack 持久缓存过期，清 `.next/dev` 即可。

### 8.28 第十三轮：去掉「闭环」说法与「基金会付款」（2026-10-25）

用户两条："移除闭环的说法，移除基金会付款相关信息"。

- **「闭环」全站去掉**（`grep -rn 闭环 src/` 已无输出）：工作台首页与各页文案、
  团详情页的「N 次闭环」→「N 次活动」、各组件注释、AGENTS / 设计规范。
  公众站本来就没有这个词（公众站不许出现内部术语）。
- **「基金会付款」整块从活动详情页删掉**：④ 报销里原来的"基金会付款"小节
  （标题 + 「项目组登记到账，闭环完成」+ 状态/收款方/金额/流水号卡 + 付款登记表单）。
  ④ 报销现在只剩：报销单信息 + 报销明细与凭证 + 项目组核定 + 循环启动。
- 随之**删掉失去调用方的代码**（不留死代码）：
  `src/components/console/PaymentForm.tsx` 与 `actions.ts` 的 `createPayment` action
  （付款登记改由财务侧在 CMS 后台的「付款记录」集合里登记）。
- 报销状态文案：`paid` 与 `approved` 都显示「已核定」（页面不再区分到账）。
- 「循环启动」改挂在**报销核定**之后，文案改成「报销核定了，按年度计划开始筹备下一场活动」。
- **保留** `payments` 集合与种子里的付款记录（财务侧的账，要留痕）；
  也保留**蚂蚁公益基金会**这个项目身份（公众站的 about 与页脚说的是"数字木兰是蚂蚁公益基金会的项目"）。
- 验收脚本 `run2.js` 跟着改：第 7.6 步从"登记付款"改成"页面已无付款登记环节，核定状态为 approved"。

### 8.29 第十三轮之二：发起活动只给团长 + 发起页重做（2026-10-25）

用户："发起活动只有团长才能有这个功能，把项目组的发起活动的按钮和相关后端移除；
`/activities/new` 页面重新设计一下。"

**权限收紧**（其实 AGENTS 早就写死了"项目组不发起活动"，是**实现没跟上**）：

- `submitPlan` 早就只认 `cohortLead`；集合的 `leadPlanCreate` 也会拒项目组。
  本轮补的是**界面**：
  - 活动列表页的「发起活动」按钮**只对团长显示**（`isCohortLead`）；
  - `/activities/new` 对非团长**直接拦下**并说明原因（项目组看到"发起活动是团长的动作"，
    没带团的人看到"你还没有担任团长"），不再让他们填一表单再被 action 拒绝。
- 顺带发现并修掉一个**渲染 bug**：`Alert` 是 `grid-cols-[0_1fr]` 的两列网格，
  裸 `<p>` 子元素会**自动落进宽度为 0 的第一列**——文字竖着排，还跟第二段叠在一起
  （经费标准那块糊成一团就是这个原因）。正确用法是 `AlertDescription`（自带 `col-start-2`）。
  全库只有 `PlanForm` 一处是裸 `<p>` 塞进 `Alert`，其余都用对了。

**页面重做**（`PlanForm` + `activities/new`）：

- 吸顶标题条（与活动详情页同一套 `top-[var(--workspace-header-h)]`）。
- 表单按《活动申请表》分三块：**① 基本信息 ② 活动经费明细 ③ 存为草稿**。
- 经费明细改成**表格**（类别 / 金额 / 说明 / 操作，有表头），以前是三列无表头的输入行。
- 按钮文案改成**「存为草稿」**（原来写"提交给项目组审批"，但 `submitPlan` 其实是存草稿，误导）。
- 一个互助团时不再显示下拉，直接显示团名（隐藏 input 带值）。
- 合计只在表格下方出现一次，提示框里只说人均与标准（去掉重复）。

**发起页改宽屏**（`/activities/new` 改成 `lg:grid-cols-[minmax(0,1fr)_360px]`）：

- 左栏：① 基本信息（字段按四列排）＋ ② 活动经费明细（带表头的表格）。
- 右栏：**这次能不能过标准**（预算合计 / 人均 / 本场可报上限 / 经费标准，填金额时实时更新）
  ＋ **存为草稿**，右栏 `sticky`——填左边时右边的数字一直看得见。
- 表格里**不再放合计行**：合计只在右栏出现一次。

### 8.30 第十三轮之三：资源页归项目组独占（2026-10-25）

用户："`/assets` 互助团团长不给资源相关功能，直接移除。另外再优化项目组的该页设计，
且不要留后台编辑按钮。"

- **导航按角色给**（`layout.tsx`）：「资源」只出现在**项目组**的导航里——
  不是显示出来再禁用，是根本不出现；团长与成员的导航只有 活动 / 互助团。
- **`/assets` 对非团长直接 `redirect('/')`**：原来给的是一张"资源由项目组统一上传与管理"的
  卡片，那也是资源相关内容，一并去掉。
- **去掉两个"在后台管理/在后台编辑"链接**：它们指向 CMS 后台（`/admin/collections/resources`），
  而**项目组的业务账号根本进不去 CMS**（CMS 只认独立 ops 账号）——给了也是死路。
  改成页头一个「公开站资源页 →」的绝对地址链接。
- **项目组的资源页改宽屏两栏**：左边「已有资源（N）」列表（标题链到公开站那条资源、
  类型 / 分类 / 首页推荐徽标、附件与外链），右边 `sticky` 的「上传资源」表单。
  列表在上传表单上面——先看有什么，再传新的。

### 8.31 第十三轮之四：发起活动与进度页合并 + 去掉普通成员账号（2026-10-25）

用户两条：
"发起活动页面其实可以与活动进度页面融合到一起，没必要保存草稿后又跳转到活动进度页。"
"不设普通账户，只需要项目组账号、团长账号和 admin 运营账号。不要其他成员账号。"

**发起 = 进度，同一页**

- 活动列表的「发起活动」→ 新 action `createActivity` 建一条**空草稿** → 直接落在
  `/activities/<id>`，**「① 活动方案」区就是发起表单**。
- `/activities/new` 独立页与 `PlanForm` 组件**已删**，`submitPlan` action 也删了（没调用方）。
- `PlanEditor`（① 区）补齐发起能力：预算行**可增删 + 有表头**（原来只能改一行，
  加第二条要去旧页）、右栏实时显示 预算合计 / 人均 / 本场可报上限 / 经费标准，宽屏两栏且吸顶。
- `plannedAt` / `goals` 在**数据库层改成非必填**（表单里仍必填）——否则空草稿建不出来。

⚠️ **server action 里不要用相对 `redirect()`**：
`redirect('/activities/1')` 会被服务端拿去**内部渲染目标页**，而那个地址取自
`NEXT_PUBLIC_SERVER_URL`（= 公众站 `localhost:3000`）→ 工作台的页面被 proxy 拦成
**公众站的 404 页**（页头页尾都是公众站的）。做法：action 只返回 id，客户端 `router.push`。

**只剩三种身份**

- `Role` 类型只剩 `cohortLead` / `projectTeam`；**没有"普通成员"这一档**，注册进来就是团长。
- 改的地方：`users` 集合的角色选项、`/api/join` 授予的角色、种子的演示账号、
  首页的"核心成员"分支、`access/index.ts` 的 `Role` 与 `isCoreMember`（删）。
- 存量数据：1262 个用户里 **1256 个模拟用户本来就是各团的团长**（`seed-network.ts` 建的），
  角色从 `coreMember` 改成 `cohortLead`；演示账号 `member@mulan.org` 删除。
- 公开站不登录就能看，所以"公众"不算一种账号。

### 8.32 第十三轮之五：工作台首页统计重做（2026-10-25）

用户："首页的统计功能重做，需要考虑不同项目类型、地域、时间段、互助团筛选统计，默认是当年的数据。"

- **待办与统计分开**：顶部四张卡是「我要动手的事」（项目组：待我批准/待我核定；团长：待提交申请/待填写反馈），
  下面才是「统计」。
- **筛选条**（新组件 `src/components/console/StatsFilters.tsx`，客户端）：
  年份（**默认当年**）· 季度 · 月份 · 地域（省）· 互助团 · 项目类型（药丸多选）；
  全部写进 URL（`?year=&quarter=&month=&category=&province=&cohort=`），筛完的地址可分享。
- **统计口径**：活动场次 / 参与人次 / 预算合计 / 实际支出 / 核定金额，
  外加「互助团维度资金看板」（预算 vs 实际 vs 核定，按预算额取前 12 个团，其余合并成"其他 N 个团"）。
  时间锚点统一用**方案的 `plannedAt`**——三个金额同源，柱状图才可比。
- 顺带修了两处：
  1. **proxy 把 `/` rewrite 成 `/home` 时丢了查询串**（`new URL('/home', request.url)` 不带 search）
     → 筛选条件根本传不到页面。已改成 `target.search = request.nextUrl.search`
     （跟 `/circles` → `/network` 那条一个道理）。
  2. `Card` 基础样式是 `flex flex-col`，只写 `flex flex-wrap` 覆盖不掉方向 →
     卡片变成竖排且居中。横排卡片要写全 `flex flex-row`。

### 8.33 下一位接手的人注意

- 本地 npm 镜像源**尚未同步 Payload 3.92.0**，装依赖请加 `--registry=https://registry.npmjs.org`，
  **不要为了绕过它而降版本**。
- `npm install` 后若 esbuild / sharp 的安装脚本被 npm 拦截，执行
  `npm install-scripts approve esbuild sharp && npm rebuild esbuild sharp`。
- 验收跑完后用 `npx tsx --env-file-if-exists=.env scripts/restore-demo.ts` 还原演示态
  （删验收账号与验收记录、恢复邀请码、重算团成员数）。
- **重建数据库前先停掉 dev server**：dev 进程会持有 SQLite 文件句柄，
  否则"重建了却看不到变化"，还会读到旧数据。顺序：
  `停 dev → 重建库 → migrate → seed → 起 dev`。
- `docs/验收记录.md` 第七节列了 13 条踩坑记录，动手前先读。
- **停 dev server 用** `ps -eo pid,cmd | awk '$2 ~ /^next-server$/ {print $1}' | xargs -r kill`，
  `pkill -x next-server` **杀不掉**（进程名是 `next-server (v16.4.3)`）。
  ⚠️ **2026-11-01 起 `npm run dev` 本身就是守护实例**（崩了自动拉起），
  重建库、跑 build 之前**必须先停掉它**，否则它会立刻把服务器拉起来：
  `pkill -f 'scripts/dev-run.sh'`（⚠️ `pkill -f 'next dev'` 会连执行命令的 shell 一起匹配掉，
  容易把自己也杀掉——按 PID 杀更稳）。
- 重新 seed 后如果图片显示的是旧内容，清掉 `.next/dev/cache/images`（Next 图像优化器按 URL 缓存）。
- **改集合字段后 dev 启动可能报 `index xxx already exists`**：Payload 的 SQLite 自动 push 不是幂等的，
  新字段的列与索引会被建好，但会再撞一次已存在的索引，导致 dev 进程持续 500。
  处理：停 dev → `DROP INDEX <冲突索引名>` → 重启 dev（索引会被重新建好）。
  一次不行就再重启一轮，最多两三轮收敛。
- **域名与路径换过两轮，验收脚本里的管理端地址要跟着改**：`/tmp/acceptance/*.js` 里的
  `ADMIN` 常量现在是 `http://connect.localhost:3000`（工作台），
  页面路径不带 `/console`；登录后的等待条件是"域名 connect.localhost 且路径是 /"。
- **两个路由组不能提供同一路径**：公众站和工作台都想用 `/` 时，Next.js 直接编译报错，
  只能用 proxy 的 rewrite 落到内部真实路径（工作台用 `/home`）。
- **Playwright 的 `request` 上下文不解析 `*.localhost`**：`ctx.request.get('http://admin.localhost:3000/...')`
  会 ENOTFOUND。要在页面里用 `page.goto` / `page.evaluate(fetch)` 测子域。
- **改路由后要 `npx next typegen`**：`.next/types/validator.ts` 仍引用已删的旧路径，
  TypeScript 会报一片假错。
- **改了组件类名要同步验收脚本**：瀑布流从 `columns-*` 换成 `.masonry` 后，
  `/tmp/acceptance/run2.js` 里的 `main [class*="columns-"]` 会查不到元素并误报"列数 0"。
- **验收脚本里别写死文案**：`/tmp/acceptance/run2.js` 曾断言 Hero 含"培训结束"，
  改文案后必然误报 FAIL——断言要跟着 `src/content/site.ts` 走。

### 8.34 第十四轮：展示名与网址标识分离（2026-10-25）

用户："活动和团名还是用中文表示，我说的是网址里面用字符串……页面还是该文字用文字。"

上一轮（没收尾的那版）把**展示名本身**也换成了随机串（团名显示成 `K7M3QX9B`、
活动标题显示成 `T6Q2XM9C`）——那是错的。本轮改正：**页面上一律中文人话，
地址栏里是不透明随机串**。

> ⚠️ **随机串只在地址栏里，页面上一个字都不露**：
> 活动详情页不显示「地址标识」字段、页头不挂那串字符、精选发布与资源上传表单也不让人手填。
> 页面上一律是中文人话。

| 对象 | 展示名（页面看到） | 地址标识（网址里那一段） |
| --- | --- | --- |
| 互助团 | `杭州 AI 互助团` | `pk6dj67bz2jtpn` |
| 活动 | `AI 工具共学工作坊（第 3 期）` | `d3sm7dn2vqax6z` |
| 精选成果 | `从一句话到一条工作流：杭州周六工作坊` | `eg4caq9gm56se7` |
| 资料 | `数字就业政策速查` | `qq87a4vdaggaxa` |

**为什么用随机串（国际惯例，理由写在 `src/lib/code.ts` 注释里）**：
防枚举（语义串能被顺序爬）、防泄漏（URL 会进历史与日志，语义串等于广播"哪个城市有什么团"）、
名称会变而标识不能变（链接已被转发与收录）、免重名（不用 `-2`/`-3` 后缀）、可传播。

**14 位怎么定的**：字符表 31 个（小写字母去掉 `i/l/o`、数字去掉 `0/1`），
`31^14 ≈ 69.4 bit` 熵，落在 bit.ly（~42 bit）与 ULID / UUID（~130 bit）之间。
**业界没有"14 位"这个标准**，关键是熵不是位数；要更贴主流就换 26 位 ULID。

**⚠️ 链接失效时页面会「闪一下」——已修**：原来 `/join` 是**客户端组件**，
挂载时先渲染表单，再去查链接，查完才换成失效提示，所以表单会闪一下。
现在改成**服务端查链接**（`src/lib/invitation.ts` 的 `lookupInvitation()`）：
首屏渲染出来就是最终状态——链接没了就只输出那句话，压根没有表单进过 DOM。
实测：失效链接的服务端 HTML 里**没有**表单，只有「链接不存在或已失效」；
用 MutationObserver 记录整个加载过程，**没有出现任何中间内容**。
表单部分拆到 `join/JoinForm.tsx`（客户端），只为了倒计时；
倒计时的初值用**服务端时间**传下去，hydration 不会对不上。

**⚠️ 直辖市的地点会重复——已修**：直辖市（北京 / 上海 / 天津 / 重庆）**省和市是同一个名字**，
拼出来是「北京市 · 北京市 · 朝阳区」。加了一个 `formatPlace(省, 市, 区)`（`src/lib/format.ts`）：
**省和市相同就只留一个**。用到的地方全部改掉——团详情页的所在地、邀请页的「你要接管的团」、
注册建团写入的 `region`、全国网络种子写入的 `region`、公众站团页的地点（走 `region`）。
现在北京的团显示「**北京市 · 朝阳区**」，公众站显示「北京市」。

**落地**：

- `src/lib/code.ts`：`randomCode`（真随机，线上新建用）、`uniqueCode`（查重）、
  `deterministicCode`（由固定键派生，**种子脚本用**，保证脚本可重复运行）。
- `src/lib/slug.ts`：`generateSlug(collection)` → 集合的 `beforeValidate` 钩子，
  谁建的对象都自动补上随机标识（CMS 后台手建的、种子建的、接口建的，一个不漏）。
- 挂钩子的集合：`cohorts` / `activity-plans` / `publications` / `resources`
  （`toolkits` 2026-11-05 已下线）。
- 工作台路由 `/activities/[id]` → **`/activities/[slug]`**（原来用自增数字 id，能被枚举）。
- **精选发布 / 资源上传表单不再让人手填标识**，由钩子生成；
  活动详情页也**不显示**那串字符（页头不挂、字段表里不列）。
- 注册建团：团名按「区县 · 类别互助团」生成（如「织金县 · 加油木兰互助团」），标识随机。

**踩坑（回归时重点看）**：

1. **同一个集合里不能有两个 `hooks:` 键**——JS 对象字面量后面的会覆盖前面的。
   `Publications` / `Toolkits` / `ActivityPlans` 本来就有 `beforeChange`，
   加钩子必须并进同一个块，否则原来的钩子会被静默覆盖。
2. **线性同余取低位做随机串是个坑**：LCG 在模 2 的幂下低位周期极短
   （取 % 32 时周期恰好是 32），字符只有 32 种取值，**第 33 个团必然撞码**。
   上次就是这样炸的（`无法为 sim-go-mulan-610925-31 生成唯一字符`）。改用 sha256 派生。
3. **迁移文件要跟着集合重生成**：加字段后旧的 `src/migrations/*.json` 快照还是老 schema，
   `npm run migrate` 建出来的表缺列 → 种子直接报 `no such column`。
   本轮做法：删旧迁移文件 → `npx payload migrate:create` → `npm run migrate` → 重跑种子。
4. **`payload migrate:create` 在非 TTY 下会卡住**：drizzle 要问"这张表是新建还是从别的表改名"；
   **空库 + 无旧迁移**时才不提问（有旧库时会进交互式，脚本直接挂死）。
   `migrate:refresh` 也要求库里有迁移记录，否则空转。
5. **种子必须幂等**：标识改成随机串后不能再"按 slug 查再建"（每次都是新串 → 重复创建），
   所以种子统一用 `deterministicCode(固定键)`，同一个键永远同一串。

**本轮顺带修掉的**：

- 上次中断时留下的是**空库**（18:00 重建后没跑种子），已重建并补齐数据。
- 删掉 5 个已被新迁移覆盖的一次性脚本（`rename-categories` / `migrate-drop-members` /
  `migrate-rename-collections` / `migrate-user-region` / `rebuild-invitation-links`）：
  它们在新库上跑会破坏 schema。

**已知遗留**：CMS 后台（admin 域）控制台有一条 hydration 报错——根布局渲染了
`<html lang="zh-CN">`，Payload 自己的 `RootLayout` 又渲染一个 `<html lang="en">`，
两个 html 嵌套。**功能正常**（React 自动重新渲染恢复），
要修得把根布局下沉到 `(site)` / `(admin)` 两个路由组，动的是路由结构，留给下一轮。

### 8.35 第十四轮之二：互助团两个页面的信息层级（2026-10-25）

用户对工作台 `connect.localhost:3000/circles` 与 `/circles/all` 提了一串具体要求，
逐条落实：

| 要求 | 落地 |
| --- | --- |
| 类别筛选**不要英文** | `CategoryFilter` 去掉 `labelEn`，只留中文名 + 数量（`加油木兰 64`） |
| 「共 323 个互助团」删掉 | 数量**搬进标题**：`互助团（323）` |
| 「更多（全部互助团）→」删掉 | 整行删除（原来它和统计行是同一块） |
| 地图下方的说明删掉 | 「标数字的地方是互助团所在的区（县）……」整段删除（`ChinaMap`） |
| 右侧下滑框显示**全部**互助团 | `/circles` 传 `pageSize={2000}`，一次列出全部 323 条，不再分页 |
| 「显示更多」改成「全部互助团」并跳转 | `CohortList` 新增 `allHref`：列表已全列出时，底部给一个「全部互助团 →」链接 → `/circles/all` |
| `/circles/all` 标题带数量 | `全部互助团（323）`，并删掉下面的「共 X 个互助团」说明行 |
| `/circles/all` 的「共 323 个」删掉 | `CohortDirectory` 里那行计数删除 |
| 「回到互助团网络」 | 改名「回到互助团」（首页标题已改） |

**地图的「返回上一级」按钮**：从一开始就**给它预留高度**（按钮位是 `h-11` 的空盒子），
否则按钮一出现就把地图顶下去，页面跳一下。顺带加了 `ResizeObserver`：
ECharts 只听 `window.resize` 不够，容器尺寸变了也要 `chart.resize()`。

> ⚠️ **类别英文还在另外三处**：活动页的类别分组（`activities/page.tsx`）、
> 注册页的类别选择（`join/page.tsx`）、工作台首页统计筛选（`StatsFilters.tsx`）。
> 本轮只按用户点名改了两个互助团页面，这三处暂留（官方英文名是专有名词），
> 要一起去掉说一声。

### 8.36 第十四轮之三：互助团详情页重做（2026-10-25）

用户对工作台 `connect.localhost:3000/circles/<标识>` 提了 11 条，逐条落地：

| # | 要求 | 落地 |
| :-: | --- | --- |
| 1 | 标题与顶部间距要和【互助团】页一致 | 详情页改用 `PageHeader`；`PageHeader` 的标题行**底对齐**（`items-end`）——徽标（38px）比标题（32px）高，居中会把标题顶偏 3px，底对齐后两页标题都在 108px |
| 2 | 「河北省 · 衡水市 · 淡旺季定价…」这行删掉 | 页头副标题整行删除（地区在团信息里、主题在【关于】里） |
| 3 | 团名就是团名，不加区县 | 种子与注册流程的团名改成「<类别>互助团」；`cohorts.name` 不再带区县（所在地单独一行三级显示） |
| 4 | 类别不要英文 | 徽标与字段都用 `COHORT_CATEGORY_LABEL`（纯中文），不再用 `categoryLabel()`（它带英文） |
| 5 | 所在地用省市区三级 | 从 `cohorts.location` 取 省 · 市 · 区（县） |
| 6 | 第一次创建的时间就是创建时间，不留成立时间 | **删掉 `foundedAt` 字段**（集合、迁移、种子、公众站一起清），统一用 `createdAt`；公众站的「成立于」也改成「创建于」 |
| 7 | 状态用【运行中、解散】两态左右滑动 + 解散时间 | 状态枚举从 4 个收成 2 个（`active` / `closed`）；`CohortStatusForm`（下拉）换成 `CohortStatusToggle`（滑动开关）；新增 `dissolvedAt` 字段，切到「解散」时出现解散时间（默认当天，可改），切回「运行中」自动清空 |
| 8 | 「安平县的姐妹一起在做民宿管家…」改成【关于】 | 团信息卡底部一个 **【关于】** 段落（简介 + 主题） |
| 9 | 团长信息不要所在地 / 项目类别；团长转移并到团长卡 | 团长卡只留姓名 / 手机号 / 邮箱 / 注册时间 + 任期 + **团长转移**（项目组才看得到） |
| 10 | 右侧活动后面跟（数量） | 标题改成 `活动（N）` |
| 11 | 团长自己那个团，「N 次活动」改成【发起活动】 | 是本团团长时，右上角换 `CreateActivityButton`（点一下建一条空草稿并进详情页） |

**第十四轮之四（同日再改）**：

- 状态开关**移到「状态」后面**（团信息卡里，不再单开「状态管理」块），
  **点一下即生效**（没有「保存」按钮），**解散时间 = 切换那一刻**（服务端记，不让人手填）。
  非项目组看到的仍是文字状态。
- 团长转移**删掉文字描述**，只留「有效期 + 生成团长转移链接」；
  `InviteCohortForm` 加 `plain` 参数，可以嵌在卡片里不再套一层卡片。
- 团信息卡：去掉**团名**与**类别**两行（标题与徽标已经给了，不重复列），
  留下 所在地 / 创建时间 /（解散时间）/ 状态（带开关）/【关于】。
- 团长卡：团长名字提到卡片上方当主角（`font-display text-title`），
  下面才是手机号 / 邮箱 / 注册时间，再是任期与团长转移。

**第十四轮之五（同日再改）**：

- 状态开关**点一下即生效**（没有「保存」按钮），**解散时间 = 切换那一刻**
  （服务端记时间，不让人手填）；`dissolvedAt` 的表单字段取消。
- 团长转移**再简化**：删掉说明文字，按钮文案改成「生成团长转移链接」；
  `InviteCohortForm` 加 `plain` 参数——嵌在卡片里时不再套一层卡片。

**第十四轮之六（同日再改，两张卡片的行节奏）**：

- 团信息卡与团长卡里，**每一项都是同一套「行」**（标签左 / 值右 / 下面一条分隔线 / 同样的间距）：
  【关于】、团长任期原来各自另起一段（`mt-6 border-t pt-4`），间距比其它行宽一大截——现在都收进行里。
- **团长转移压成一行**：左边标签、右边一个「生成链接」按钮；有效期固定 7 天，**不再让人选**。
- 生成后**直接把链接复制到剪贴板**，并提示「链接已复制，有效期 2026年10月25日 至 2026年11月1日」——
  不再弹一个链接框让人自己拷（复制失败时才把链接摆出来兜底）。
  `ActionResult` 加了 `data` 字段，`createInvitationLink` 把有效期起止一并带回。

**第十四轮之七（同日再改，行顺序与按钮反馈）**：

- 团信息卡：**状态提到第一行**（一眼看到这个团在不在运转）→ 所在地 / 创建时间 /（解散时间）/【关于】。
- 团长卡：**团长转移提到第一行**，按钮改成「**复制转移链接**」——
  点一下生成 + 复制，按钮随即变成「**已复制**」（2.5 秒后复原），**不另写有效期文案**。
  有效期固定 7 天，`createInvitationLink` 不再接收 `validDays`。
- 团长卡**加回「姓名」行**（之前把名字提成了大字，与"每项一行"的节奏不一致）。

**第十四轮之八（同日再改，丢掉「我的互助团」专用页）**：

- 团长点「我的互助团」→ **直接进自己那个团的详情页**（`/circles/<slug>`），和看别人的团**同一个页面**。
- **旧的 `/circles/mine` 页整个删掉**（`src/app/(admin)/(workspace)/network/mine/` 目录已删）：
  那页是另一套版式（成员名单 / 反馈记录 / 报销记录），和别的团的详情页长得不一样；
  这些内容在团详情页与活动详情页里都能看到。未上线，**不留兼容跳转**——`/circles/mine` 现在直接 404。
- `findMyCircle()` 补上 `slug` 字段（原来只有 id / name 等，够不着详情页地址）。

**顺手修掉的一个真 bug**：**点一次「发起活动」建出两条空草稿**。
`CreateActivityButton` 的 `<form action={...}>` 写的是内联箭头函数，
组件重渲染会换掉 action 的身份，React 19 可能把动作再跑一遍。
改成 `useCallback` 固定引用 + `useRef` 提交锁（`started.current`）——
**表单 action 一律要稳定引用**，别写成内联箭头。

**连带改的**（不改会自相矛盾）：

- `access/index.ts`：状态过滤从 `['active','draft','paused']` 收成 `['active','closed']`。
- 公众站只展示运行中的团；工作台两个列表**两种状态都列**，解散的团在列表里标「解散」。
- `CohortStatusForm.tsx` 删除（被 `CohortStatusToggle.tsx` 取代，不留两个组件）。
- 迁移重新生成（字段有增删），库重建，种子与全国网络重跑（318 团）。

### 8.37 第十四轮之九：邀请注册页重做（2026-10-25）

`/join?token=…`（团长转移 / 创建互助团）原来是**一条单列长表单**：
姓名 → 所在地三级 → 项目类别 → 手机号 → 邮箱 → 密码，挤在 `max-w-lg` 一张卡里。
问题有三个，都是实打实的：

1. **团长转移时不该问"所在地"和"项目类别"**——那是**团**的事，团已经有了；
   表单里却标着必填在问人。接口本来也不要求（`/api/join` 只有 `create-cohort` 才校验地区）。
2. 类别还带着英文（`GO Mulan` / `A-Idol` …），与工作台其它页面不一致。
3. 宽屏下左边一大片空白，表单没有层次。

**重做后的结构**（`src/app/(admin)/(auth)/join/page.tsx`）：

- **左栏说明 / 右栏表单**（`lg:grid-cols-[1fr_1.1fr]`）：
  左栏是「这是什么 + 接下来会发生什么（三步）」；转移时多一张
  「你要接管的团」卡片（团名 / 项目类别 / 所在地，来自邀请链接接口新加的 `cohortCategory`、`cohortPlace`）。
- **表单按用途分开**：
  - 建团：姓名 / 所在省市区 / 项目类别 / 手机号 / 邮箱 / 密码；
  - 团长转移：**只有**姓名 / 手机号 / 邮箱 / 密码（不出现地区与类别）。
- 类别只留中文；表单分成「你的信息 / 联系方式 / 账号」三段。
- **链接失效是一张专门的状态卡**（不再是页面顶部一行小字）：说明为什么不能用、
  提醒"一次性 + 有有效期"，并给「去登录」入口。
- 团长转移时，新账号的 `program` **跟着那个团**（`/api/join` 里按团的类别写，
  不再默认 `go-mulan`）。

**顺带修掉的一个真 bug**：`scripts/restore-demo.ts` 还原时删不掉验收账号——
Payload 删账号会去解除 `cohorts_leader_terms` 关系，而 `user_id` 是 NOT NULL，
解除关系等于置空 → `SQLITE_CONSTRAINT_NOTNULL`。
**Payload 干不了"删关系行"这件事**，改用 `node:sqlite` 直连 SQL 删任期行，再删账号。
另外还原脚本原来靠 **slug 前缀**认验收建的团——地址标识改成随机串后这条规则失效了，
改成**看团长是谁**（团长是验收账号的团：新建的删掉，被接管的还给上一任团长）。

### 8.38 第十四轮之十：邀请链接的三条规则（2026-10-25）

用户定的规则：

1. **有效期过后自动失效**，访问时**只提示「链接不存在或已失效」**——别的文案一句都不要。
2. **有效期内，页面显示有效期截止时间与剩余时间（到时分秒）**，剩余时间每秒走一格。
3. **链接默认自创建起 7×24 小时截止**。
4. 接管团页面的「你要接管的团」**后面加上项目类别的名称**。

**落地**：

- **过期自动失效**：注册页**在服务端**查（`lookupInvitation(token)`），判定"不存在 / 撤销 / 已使用 / 已过期"
  （⚠️ 2026-11-05：`GET /api/invitation-links/[token]` 这个接口已删 —— 注册页早改成服务端直查，没人调它了）
  时**一律返回同一句话**，并把过期那条的 `status` 改成 `expired`（后台看到的是真的）。
  页面只显示这一行，连"去登录"入口都不给。
  页面自己也会盯着倒计时——**剩余时间归零的那一刻，页面当场变成失效状态**。
- **截止时间 + 剩余时间**：左栏说明下面一行
  「有效期至 2026年11月1日 21:05 · 剩余 6 天 23 小时 45 分 12 秒」，
  倒计时用 `setInterval` 每秒重算（`formatRemain()`，天/时/分/秒）。
- **7×24 小时是唯一口径**：`validDays` 字段**删掉**（原来有 3/7/14 三档，
  但界面已经不让人选了，留着就是死字段），
  真正说了算的只有 `expiresAt`——`createInvitationLink` 里
  `VALID_MS = 7 * 24 * 60 * 60 * 1000`，种子里的链接同样 7×24 小时。
  字段有增删 → 迁移重生成、库重建、种子与全国网络重跑。
- 「你要接管的团」标题变成「**你要接管的团 · 加油木兰**」，
  卡片里原先单独那行「项目类别 · X」删掉（已在标题上）。

### 8.39 第十四轮之十一：资源页支持 PDF 与视频（2026-10-25）

用户："资源主要是品牌 VI，看一下是不是放到下载里面去，还是就放在资源里。
另外就是上传 PDF、视频……参考国际设计吧，简单点，有播放器就行。"

**先回答那个问题：品牌 VI 不另开「下载」页，就放在资源里。**
国际做法（Google Brand Resources、Dropbox Brand、Atlassian Brand）都是在**资源库里用分类区分**
品牌资源，而不是多开一页——多一页等于多一次跳转，而且"下载"不是一个内容维度（VI 本身也是文件）。
真正的差别是：**VI 类的详情页要"先预览、后下载"**。

**落地**：

- **公开站 `/resources`**：顶部按**分类**筛（全部 / 品牌 VI / 工具模板 / 操作指南 / 政策速查 / 视频 / 图片素材），
  走 URL 参数 `?category=`；卡片底部一句话说明**进去能干什么**（进去播放 / 进去直接读 / 进去下载）。
- **公开站 `/resources/[slug]`**：新增 `ResourceMedia` 组件（`src/components/site/ResourceMedia.tsx`）——
  - **视频** → `<video controls preload="metadata">` 播放器（站内 video 文件，或外链是视频直链；16:10）；
  - **PDF** → **内嵌阅读**（iframe，像 Drive / Dropbox 那样直接翻），旁边给下载；
  - **图片** → 大图；其它 → 下载。
  - 外链是"页面地址"（B 站那种）就不内嵌，只给「在外部打开」。
- **工作台 `/assets`**：上传表单加上 `accept`（PDF / 视频 / 图片 / Word / 表格 / 文本）与体积提示；
  列表里显示附件名 + 大小，外链只显示「外链」两个字（原来把整条 URL 摊开，难看）。
- **上传体积上限** 20MB → **100MB**（视频要能传得动）。
- 标签统一：`RESOURCE_CATEGORY_LABEL` / `RESOURCE_TYPE_LABEL` 收到 `src/lib/labels.ts` 一处
  （原来公众站用的那张表**缺 vi / video / image**，公开站会直接显示 `vi`、`video`、`image` 原文）。
- **演示数据**加了两条：品牌 VI（**PDF 附件**，手写最小 PDF 生成的色卡手册）与一条视频（外链 mp4 + 封面）。

⚠️ 手写 PDF 只能用标准 14 号字（**中文排不进 PDF**），所以演示那份 VI 手册是
"英文短句 + 色块"——色块才是 VI 的主角；正式手册由项目组自己上传。

### 8.40 第十四轮之十二：资源类型只留「文档 / 视频」，工作台资源页重排（2026-10-25）

用户："类型只区分文档（docx\PDF\PPTX\其他 cdr ps 等）视频"＋"该页面布局重新设计，
删除废话的文字描述，比如'全部公开，任何人不用登录就能看、能下载'，以及其他处废话"。

**类型与分类正交**（这一版把模型理顺了）：

| 字段 | 说什么 | 取值 |
| --- | --- | --- |
| `type`（类型） | **文件形态** | `doc` 文档 / `video` 视频 |
| `category`（分类） | 这份资源**干什么用** | 品牌 VI / 工具模板 / 操作指南 / 政策速查 |

- docx / PDF / PPTX / CDR / PS / 图片……**都算"文档"**；
  具体是什么格式由附件的 mimetype 决定（页面上显示 PDF / Word / 表格…）。
- 原来的 `vi / video / text / image / file` 五个类型收成两个；
  分类里与类型重复的「视频 / 图片素材」删掉。
- 字段有变 → 迁移重生成、库重建、种子与全国网络重跑。

**类型由文件判定，不是让人手选**（这是这一版最关键的改动）：
传了视频文件、或外链是视频直链 → 类型就是「视频」；其余一律「文档」。
人手选**只能把"页面链接的视频"标成视频**，选不了一个视频文件成文档——
原来让人在下拉框里选类型，迟早选错（第一版就出现过：上传了 mp4，类型标成"文本"）。
表单里的「类型」下拉因此**取消**，改成一行只读的「类型：视频 / 文档」，
选了视频文件自动跟着变。

**工作台 `/assets` 重排（第十四轮之十三，再改一次版式）**：

上一版还是"自研"：手搓的表格式行、手搓的上传卡、间距自己拍。
这一版**全部换成现成组件**，并照工作台的版式规范（`PageHeader` → `mt-8` → `Card`）来：

- **上传收进 `Dialog`**（shadcn）：右上角一个「上传资源」按钮，弹窗里是表单。
  上传是偶尔做的事，**页面正事是清单**，表单不该占着正位置。
- **清单用 `Table`**（shadcn）：标题（带摘要）| 分类 | 类型 | 文件 | 大小 | 发布时间，
  一行看完，不用点开才知道是什么。比卡片适合"管理"。
- **类型筛选用 `Tabs`**（shadcn）：全部 / 文档 / 视频，带各自分类数量；客户端切换，不跳页。
- 新增 `src/components/console/ResourceBrowser.tsx`（清单 + 分页签）与
  `ResourceUploadDialog.tsx`（上传弹窗），`ResourceForm` 加 `onDone` 回调
  （传完关弹窗、刷新清单）。

**工作台 `/assets` 重排**：

- **上传表单提到上面、全宽一张卡**：标题 / 类型 / 分类一行，简介一行，文件 / 外链一行。
  原来塞在右边 380px 的窄列里，文件选择框是挤的。
- **资源列表改成轻量行**（分隔线 + 两栏），不再是一个个大卡片。
- **删掉的废话**：页头那句"全部公开，任何人不用登录就能看、能下载"、
  上传卡里的"选好类型再传：项目 VI 传色卡与版式…"、空状态"还没有上传资源。右边传一份试试。"
  ——页头只留标题 + 一个「公开站资源页 →」。

### 8.41 第十四轮之十四：上传弹窗压到最简，文件限额 1GB（2026-10-25）

**弹窗**：压到最简——**没有可见描述**（只留一条 `sr-only` 给读屏软件），
表单只留 标题 / 分类 / 简介 / 文件 / 外链；类型那行只读的「类型：文档 / 视频」
也去掉了（类型本来就是由文件判出来的，摆在那儿只是多一行字）。
字段的提示直接写进**标签**里：「文件（≤1GB）」「外链（视频在线版这类）」，
不再另起一行小字。页面从"表单 + 列表"两块变成**只有清单**。

> `src/components/ui/dialog.tsx` 的关闭按钮无障碍文案是 shadcn 默认的英文 `Close`，
> 已改成「关闭」（全站中文）。

**1GB 限额怎么做的**（这是关键）：

⚠️ **大文件不能走 Server Action**。Server Action 会把**整个请求体缓冲进内存**
（`bodySizeLimit` 只是上限，不是流式），1GB 的视频会把进程撑爆。
所以资源文件改成**浏览器直传**媒体接口：

1. 浏览器 `POST /api/media`（multipart，**流式落盘**，不受 action 体积上限管）；
2. 拿到媒体 id，再把 id 交给 Server Action 建资源（action 只处理几十字节元数据）；
3. `createResource` 认 `mediaId`（**必须是数字**——FormData 只能带字符串，
   字符串 id 会被 Payload 判成"非法关系"），没有 `mediaId` 时才退回经 action 传文件。

`next.config.mjs` 的 `serverActions.bodySizeLimit` 因此回到 **20mb**
（照片与凭证够用），1GB 走的是另一条路。
**限额三处都守着**：客户端先拦（`file.size > 1GB` 直接报错）、
媒体集合 `beforeValidate` 再拦一次（`filesize > 1GB` 抛错）。

### 8.42 第十四轮之十五：页面顶边对齐（2026-10-25）

用户发现 `/activities` 与其它页面的标题离顶边距离不一样，追问"没有统一容器布局吗"。
用 Playwright 逐页量了 `h1` 与首行文字的 `getBoundingClientRect`，量出三处真问题：

1. **工作台标题会跳 12px**：`PageHeader` 原来用 `items-end` 把标题跟右侧 44px 的操作按钮**底对齐**，
   于是"有按钮的页"（活动 / 互助团 / 资源 / 详情页）标题在 **108px**，
   "没按钮的页"（工作台首页自己写的 `h1`）在 **96px**。翻页面标题就上下跳。
   → 改成外层 `items-start` + 标题 `self-start` 钉在行顶，徽标仍与标题视觉居中。
   **现在工作台每一页的 `h1` 顶边都是 96px**（480–1920px 全宽度一致）。
2. **公众站有 6 套顶边**：首页与成果详情 56px、互助团详情 80px、资料详情 96px、
   内页页头与 404 各 112px。→ 用户拍板"全部 56px"，六个页头块统一
   `pt-10 pb-8 md:pt-14 md:pb-10`；眉标签到标题的间距也统一 `mt-6`
   （成果详情首行是 chip 行、比眉标签高，用 `mt-2` 补平）。
   **现在公众站每一页的页头块都从 128.4px 开始，`h1` 顶边 173.2–174.2px**。
3. **404 页与内页不一致**：404 原本 `md:pt-32`，比其它内页低 16px → 并入统一节奏。

> 量法（可复用）：`scripts/` 下临时脚本用 Playwright 取 `getBoundingClientRect`，
> 按 480/768/900/1100/1280/1440/1600/1920 八个宽度各量一遍，
> 顺带用 Range 取文字**墨盒**（元素框相同不代表墨迹相同）。
> 结论写进 `docs/设计规范.md` §3.1.1「页面顶边：一条线，不许跳」。

**同轮还做了两件事**（用户在同一批指令里要求的）：

- **活动页瘦身**：删掉页头说明行（"你所在互助团的活动"）、类别去掉英文名、
  分组标题改成「AI豆计划（2 次活动）」、活动名称不再重复出现两次。
- **全站类别只露中文**：`StatsFilters`（工作台首页的类别筛选）去掉英文副名，
  `src/lib/labels.ts` 里随之变成死代码的 `labelEn` / `COHORT_CATEGORY_LABEL_EN` /
  `categoryLabel()` 一并删掉。英文名只留在 CMS 后台的下拉项里，供运维对照官方项目名。

### 8.43 第十四轮之十六：活动详情页瘦身（2026-10-25）

用户对着 `/activities/<随机串>` 一次提了七处，全是"重复 / 多余"：

1. **吸顶栏的「活动」重复**：`← 活动` 后面又跟了一个「活动」标签 → 删掉后面的。
2. **删掉【循环启动】整块**（"报销核定了，按年度计划开始筹备下一场活动。回到活动列表"）。
   ⚠️ 那块里还有个死链 `/activities/new`——那个路由第 8.29 轮就删了（发起活动已并进 `/activities`），
   页面上的按钮点了会 404。删掉整块后 `Button` 变成未引用，一并去掉 import。
3. **右侧「环节」→「活动进度」**（`ActivityOutline`，`aria-label` 同步改成「活动进度导航」）。
4. **吸顶栏右上角的【已实施】徽标移除**：状态在① 活动方案那块和右侧进度里都有，
   吸顶栏不必再挂一个。（注意：**§ 活动方案小节标题旁的「已实施」是环节状态，要留着**。）
5. **「经费明细」→「预算明细」**，并按**能直接拿去核预算的表**重做：
   `序号 / 预算科目 / 用途说明 / 金额 / 占比`，合计行给 `预算合计 ¥480 / 100%`。
   序号是为了讨论时能指着说"第几项"；占比按预算合计算（240→50.0% / 140→29.2% / 100→20.8%）。
   同步改了 `PlanEditor`（编辑态）的「活动经费明细 → 活动预算明细」、
   `actions.ts` 的两条校验提示、以及 CMS 集合里的字段标签。
6. **删掉「预算合计 ¥480 未超出本场可报上限 ¥540（单场上限 ¥500 · 人均上限 ¥30 · 预计 18 人）」**
   —— `budgetStandardNote` 这段判定说明不再在页面上显示。
   （字段本身保留：它是审批时留下的判定记录，写进 `budgetStandardNote`，
   超标方案该走的书面确认流程不受影响。）
7. **删掉底部重复的已发布卡片**（"从一句话到一条工作流：杭州周六工作坊 已发布 · 2026/9/21"）：
   ③ 活动反馈那块右上角已经有「精选发布（置灰）+ 在公开站看 →」，底下那张卡是重复。

> 「经费」与「预算」的口径：**预算 = 打算怎么花（表）**，经费 = 可用的钱（池）。
> 页面上一律叫「预算明细」，只描述这笔钱怎么分配。

### 8.44 第十四轮之十七：互助团地图的报错与两个真 bug（2026-10-25）

用户在 `/circles` 上撞到运行时错误（dev overlay）：

```
Runtime TypeError: Cannot read properties of null (reading '0')
    at ChinaMap.useEffect (src/components/console/ChinaMap.tsx:240:53)
```

第 240 行是 `new ResizeObserver(() => chart.resize())`——**错误出在 ResizeObserver 回调里的
`chart.resize()`**（dev overlay 后面那段 `ChinaMap.useEffect` 是 React 的组件栈）。
先查了 ECharts 6 的源码：`ECharts.prototype.resize` 开头就判 `this._disposed` 并直接返回，
所以**不是"对着已销毁的图表 resize"**；能走到内部抛错，说明图表还活着、但内部状态不一致。
本机**没能稳定复现**（这台机器拿不到新的地图边界，见下），所以按"展示件不许把页面带崩"的原则加固，
同时把这条路径上查到的两个**真 bug**修掉：

1. **图表生命周期**（`src/components/console/ChinaMap.tsx`）
   - `resize` 前先判 `chart.isDisposed()`；再包一层 `try/catch`（失败只在 console 留一笔 `warn`）——
     地图是工作台里的展示件，**重画失败绝不能把整个页面带崩**。
   - 卸载时 `chartRef.current?.dispose()` **之后必须置 `null`**：
     不置空的话，重新挂载（路由切回来、或开发时热替换）会复用上一个**已经销毁**的实例。
2. **换层级时边界数据没清**（真 bug）
   `fetch` 边界前先 `setGeo(null)`。不清的话，旧边界会被 `registerMap(新adcode, 旧边界)`
   注册成新层级的地图，地图与层级对不上；拉取失败时更会一直错下去。
3. **直辖市的伪市级层**（真 bug，用户点北京就能撞上）
   数据里北京的 `cityCode` 是 `110100`——**那个 adcode 在 DataV 上并不存在**，
   原来的代码会下钻到它，`/api/geo/110100` 直接 502，地图停在半路还盖着报错。
   现在按 `MUNICIPALITY_CODES`（110000 / 120000 / 310000 / 500000）跳过市级层，
   直辖市直接落在"省 → 区"。

> ⚠️ **这台机器拉不到新的地图边界**：`media/geo-cache/` 只有全国 + 省 + 市三级，
> 区（县）一级没有缓存，`/api/geo/区级adcode` 会 502（DataV 要外网）。
> 所以"下钻到区"在这里必然失败——这是环境限制，不是代码问题。

### 8.45 第十五轮：活动方案三处收口 + 工作台「首页」导航 + 整站移动端适配（2026-10-25）

用户提了 5 件事，全部落地：

1. **人数没填时不计算，显示「—」**
   - `PlanEditor`：人均那一栏原来是「填了人数才算」→ 改成 `—`；
     人数输入框的初值改成 `plan.participants ? String(...) : ''`（填了 0 等于没填）。
   - 活动详情页只读字段「预计参与」与活动列表的元信息：`participants` 为 0 时显示 `—`，
     不再显示「0 人」。
   - ⚠️ `collections/ActivityPlans.ts` 的 `buildStandardNote()` 里的「预计人数未填」
     **保留**——那是写回数据库的审批留痕，不是页面展示。
2. **交换「保存草稿 / 提交活动申请」的配色**
   保存是「先存着」，提交才是「往前走一步」→ **提交用主色，保存用次要色（outline）**。
   按钮文案顺手从「保存方案」改成「保存草稿」（与 SOP 状态机 `draft` 对齐，也与用户的说法一致）。
   同时删掉按钮下方那段解释文案（「保存后确认无误，再点「提交活动申请」交项目组审批。」/「提交申请请团长来。」）。
3. **活动进度：已完成的环节加打勾图标**
   `ActivityOutline` 的状态胶囊里，`tone === 'done'` 时前面加一个 lucide `Check`（`aria-hidden`）。
   lucide-react 0.545 已在依赖里，这是它第一次被用。
4. **工作台导航新增「首页」，排在「活动」之前**
   行为与点左上角 logo 一致（都是 `/`）。工作台首页的内部真实路径是 `/home`（proxy rewrite），
   所以 `match` 写 `['/', '/home']` 两个都匹配，否则在首页不高亮。
5. **整站移动端适配**
   详见 `docs/设计规范.md` §3.1.2。要点：
   - 工作台顶栏窄屏**两行**且**不吸顶**；桌面仍是一行 64px 常驻吸顶。
     活动详情页的标题条同理（窄屏不吸顶）——否则 112px 的顶栏 + 56px 的标题条
     在 844px 的屏上只剩一半能看内容。
     ⚠️ 360px 小屏上「数字木兰校友会工作台」全称会把顶栏顶成三行（160px），
     窄屏改用短名「数字木兰工作台」，360px 下顶栏回到 112px 两行。
   - 触控目标全部拉到 ≥44px。**坑**：行内链接的实测高度是**字体墨盒**（17px 正文只有 20px），
     只加 `py` 不够，得显式 `min-h-11`。
   - 修掉 `/circles/all` 的横向溢出（31px）：根因是 `<ul className="grid gap-3 sm:grid-cols-2">`
     **没写 `grid-cols-1`**——不写就是 `auto` 轨道，会被最宽那条撑开。
   - 地图画布窄屏 420px（`.map-canvas` 媒体查询，桌面用 `--map-canvas-h`）。

**验收脚本跟着结构改了两处**（`scripts/verify-round.ts`）：
- 地图画布的选择器从 `div[style*="min-height"]` 改成 `.map-canvas`（内联样式换成了 CSS 变量）。
- 点列表行触发地图下钻，从「点 `ul li` 的几何中心」改成 `[data-circle-row]`。
  ⚠️ **几何中心是错的**：行里既有「点这一行 → 地图定位」，又有「查看 →」链接，
  44px 的链接会把几何中心盖住，点中心就跳走了、不会下钻。
  为此给 `CohortList` 的行加了 `data-circle-row={slug}`。

> ⚠️ 用户给的 `3cqvdx2gbxmf6a` 这个活动网址**现在打不开（404）**：
> 那是上一轮验收留下的「未命名活动」草稿，已被 `restore-demo.ts` 清掉。
> 演示态里的活动网址是 `/activities/d3sm7dn2vqax6z`。

### 8.46 第十五轮之二：移动端按国际标准重做（2026-10-25）

用户判定上一版移动端"做得不好"，要求**按国际软件标准 + shadcn/ui 标准**重做。
用户拍板两件事：**主导航用汉堡 + 侧边抽屉（Sheet）**、**活动进度收进底部抽屉**。

> 上一版的问题：只做到了"不横向溢出 + 触控目标够大"，**排版还是缩小版桌面**——
> 导航硬塞一行、宽表靠横向滚、页面里套可滚动框。

**新增 shadcn/ui 组件**
- `src/components/ui/sheet.tsx`：shadcn 官方 Sheet（基于项目已有的 `radix-ui` 统一包的
  Dialog primitive，**不用装新依赖**）。`side="left"` 给导航、`side="bottom"` 给清单；
  底部面板带拖拽把手、`85dvh` 上限、内部滚动、`env(safe-area-inset-bottom)` 留白。
- 宽表在窄屏摊成卡片流：**表格自己加 `.resp-table`**（CSS 换排版），不再有包装组件。
- `src/components/site/SiteNav.tsx`、`src/components/console/WorkspaceMenu.tsx`：
  抽屉里的导航（与桌面横排共用同一份 items 与"当前在哪"的判定）。

**布局改动**

| 域 | 窄屏 | 宽屏 |
| --- | --- | --- |
| 公众站顶栏 | 61px（logo + 汉堡），导航进抽屉（< 768px） | 77px（logo + 横排导航） |
| 工作台顶栏 | 57px（logo 短名 + 汉堡），导航进抽屉（**< 1024px**） | 65px（logo + 导航 + 公开站/退出） |
| 活动进度 | 正文上方一行紧凑状态条 + 底部抽屉 | 右侧固定栏（不变） |
| 宽表 | 卡片流（`.resp-table`） | 表格 |
| 弹层 Dialog | 底部面板 | 居中模态 |
| 地图 | 300px | 620px |

⚠️ **工作台为什么用 `lg`（1024px）而不是 `md`（768px）**：768–1023px 之间，
logo + 四个导航 + 公开站/退出合计约 750px，挤不进 704px 的内容宽（实测会挤爆）。

⚠️ **表单里的表格不能渲染两份 DOM**（FormData 会出现重复字段，提交上去金额翻倍）：
所有表（只读与带 input）都用 `.resp-table` 的
CSS 换排版，字段名靠 `data-label` 显示。

⚠️ **去掉"页面里套可滚动框"**：互助团列表在窄屏不设高度（跟着页面滚），
桌面才是固定高度的侧栏。手机上的嵌套滚动会卡（滚到边界推不动页面）。

**其他**
- `Input` / `Textarea` 字号 16px → **17px**（正文下限；仍 ≥16px，iOS 不会自动放大）。
- 按钮加 `active:opacity-90`；`body` 关掉系统的点击高亮块（`-webkit-tap-highlight-color`）。
- `min-h-screen` → `min-h-dvh`（iOS Safari 的 `100vh` 比可见区域高）。
- `MetaList` 窄屏改为标签在上、值在下。

**验收**：`scripts/verify-round.ts` 113 项全绿；390px 13 个页面横向溢出 0、
触控目标 < 40px 的可点元素 0；360/390/768/900/1024/1280/1440/1920 八档
页面溢出与顶栏内溢出全为 0。

> 规范见 `docs/设计规范.md` §3.1.2（移动端六条硬规矩）、§4.0.1（移动端容器）。

### 8.47 第十五轮之三：下拉面板的宽度与位置（2026-10-25）

用户指出「**下拉选项出来的宽度都没调整好**」。查下来是两处：

1. **`SelectContent` 的 `position` 被改成了 `"item-aligned"`**（shadcn/ui 官方默认是 `"popper"`）。
   - `"item-aligned"` 是**把选中的那一项盖在触发器上**（macOS 原生下拉的行为）：
     手机上就是"弹层压在输入框上"，看着像错位；
   - 而且弹层宽度由**选项内容**决定（`min-w-[8rem]` + 内容宽度），
     **和触发器宽度对不上**（实测 触发器 313px / 弹层 178px）。
   - 改回 `"popper"`：面板落在触发器正下方（下方放不下就翻到上方），
     宽度由 `--radix-select-trigger-width` 定。
2. **宽度还差 2px**：shadcn 把 `min-w-[var(--radix-select-trigger-width)]` 放在 **Viewport** 上，
   而 Viewport 在 Content 的 1px 边框**里面** → 弹层比触发器宽 2px。
   改成：**宽度定在 Content 上**（`w-[var(--radix-select-trigger-width)]`，border-box），
   Viewport 用 `min-w-0`。

顺手把下拉的字号提到正文下限：触发器 16px → **17px**，选项 15px → **17px**。

**第二轮（用户指出「工作台首页的下拉怎么还是没改」）**：上一轮只改了组件库里的
`SelectContent`，**漏了工作台首页那 5 个筛选下拉——它们是原生 `<select>`**，
样式与弹层宽度根本不受组件库控制。现已全部换成组件库版：

- `StatsFilters` 里的 `Select`（原生）→ `FilterSelect`（Radix `<Select>`）。
  ⚠️ **Radix 的 `<SelectItem>` 不接受空串**（会抛错），「全部省份 / 全年」这类占位项
  用哨兵值 `__all__`，在 `onValueChange` 里映射回空串。
- 弹层宽度从「固定等宽」改成 **min-width**：
  `min-w-[max(8rem,var(--radix-select-trigger-width))]`。
  固定等宽会**裁掉长选项**（互助团名很长），min-width 才能「不窄于触发器、长选项可撑宽」。
- `align` 从 `"center"` 改成 **`"start"`**：面板左边缘与触发器左边缘对齐，
  比触发器宽时只往右扩，左边始终是一条线。

**校验口径**（`tmp-final-select.ts`）：逐个点开全站下拉，量
「左边缘差 == 0」「弹层不窄于触发器」「触发器高 ≥ 44px」「无横向溢出」——
工作台首页 5 个（移动 + 桌面）、邀请注册页 3 个全部通过，无页面报错。

> ⚠️ 测的时候踩过一个坑：`scrollIntoViewIfNeeded` 遇上 `html { scroll-behavior: smooth }`
> 会**平滑滚动**，脚本必须等滚动结束再点，否则量到的是滚动途中的位置。

> 规范见 `docs/设计规范.md` §4（下拉框的硬约束）、§3.1.2（移动端六条硬规矩）、§4.0.1（移动端容器）。

### 8.48 第十六轮：整站从 Radix 迁到 Base UI（2026-10-27）

用户确认："Base UI 更好，整站其他地方也全改"。这是对 §二 技术栈的**有意调整**（已取得同意）。

- **依赖**：装 `@base-ui/react@1.9.0`；卸载 `radix-ui`、`@radix-ui/react-*`、`cmdk`。
- **ui 组件**（`src/components/ui/*`）：button / badge / select / dialog / sheet / popover / checkbox /
  radio-group / tabs / separator 改为 Base UI；label 改为原生 `<label>`（Base UI 无此原语）。
  删除无人引用的 `avatar` / `dropdown-menu` / `tooltip` 与 `command`（cmdk）。
- **可搜索下拉**：`SearchSelect`（互助团）与 `RegionSelect`（地域）改用 Base UI `Combobox`：
  按钮触发 + 弹层内搜索框，锚点自动落在触发按钮上。地域的「选省 / 市后保持弹层打开」
  靠 `onOpenChange` 忽略由选择引起的关闭（`keepOpen` 标记）。
- **调用方**：`asChild` 全部改为 `render`（约 20 处）；Select 的 `value` 用 `null` 表示未选；
  Select 需要 `items` 才能在未展开时显示已选项；`--radix-*-trigger-width` 全部改为 `--anchor-width`；
  `data-[state=…]` 改为 `data-[open]` / `data-[closed]` / `data-[checked]` / `data-[active]`。
- **表单**：`FormSelect` 传 `name` 给 Base UI Select，由它渲染隐藏 input（不再手写）；
  `FormCheckbox` 仍用隐藏 input（它由自己的状态控制，并且服务端按 `=== 'on'` 判定）。
- **已修的回归**：
  1. SheetClose 渲染 `<a>` 时控制台报 `nativeButton` 警告 → 加 `nativeButton={false}`。
  2. 地域下拉选省后城市列表异步加载，加载期间用户只看到「不限城市」→ 加「正在加载…」。
  3. 地域下拉的 `null` 值类型问题（StatsFilters / FormSelect）。
- **验证**：`tsc` 无错误；`npm run build` 通过；浏览器实测 22 项全部通过（年份 / 地域下钻与搜索 /
  互助团联动 / 资源页标签 / 上传弹窗 / 窄屏抽屉 / 通知弹层 / 链接型按钮），控制台无报错。
- ⚠️ **未完成**：`scripts/verify-round.ts` 有 52 项断言仍按旧版公众站写（首页要「成果列表 ≥ 6 条」，
  当前首页只有 Hero 与三张入口卡），在它处失败，不是本次迁移造成的；需要单独更新断言。
- ⚠️ `components.json` 仍是 `"style": "new-york"`（Radix 版）。之后用 `npx shadcn add` 新增组件时，
  要先确认 registry 的 Base UI 样式，否则会生成 Radix 版本。

### 8.49 第十六轮之二：首页与活动列表合并 + 一屏布局 + 资金排行（2026-10-27）

用户要求：**所有内容在一屏内**（页面不滚动）、左侧可以更宽、右侧模拟 20 条活动保留、
资金维度可切换（预算 / 报销 / 对比）、要能扛住六七十个互助团同时存在。

- **一个页面**：`/home`（对外 `/`）同时是统计与活动列表。**`/activities` 列表页已删**，
  `/activities/[slug]` 详情保持不动；导航为「首页 / 互助团 / 资源 / 设置」，
  首页同时匹配 `/activities/*`（详情页仍高亮首页）。
- **一屏**：页面容器 `lg:h-[calc(100dvh-var(--workspace-header-h)-4rem)] lg:overflow-hidden`，
  **只有右侧活动列表和左下的资金排行各自内部滚动**，页面本身不滚。
  窄屏（<1024px）不强制一屏，正常纵向滚动。
- **左侧 30rem**：一张卡里放「5 个关键数字（一行五列）+ 筛选（时间一行三列、地域/互助团一行两列）」，
  下面再一张卡放资金排行。合并成一张卡是为了省下一层卡片内边距和间距，否则左栏高过一屏。
- **左栏不吸顶**：内容本来就占满一屏，吸顶没有意义，还会出现栏内第二个滚动条。
- **项目类型筛选在列表上方**（`CategoryToggles`）：它本来就是列表的筛选维度；
  与左栏共用 `filterHref()`（从 `StatsFilters` 抽出），保证清除/跳转口径一致。
- **资金排行替代了柱状图**（`FundBreakdown`）：
  - 原 ECharts 柱状图在 60–70 个团时横轴放不下，且**悬停/重渲染容易整块消失**（canvas 实例被复用）；
  - 改用国际后台常见的「排行条」：每行 团名 · 区县、金额、按比例画出的条；
  - 三个口径用 Tabs 切换：**预算 / 报销（核定）/ 对比**（对比＝上预算下报销，同一刻度）；
  - 列表可滚动，几十个团也只是一列行，不需要聚合「其他」。
- ⚠️ **必须按团 id 汇总，不能按团名**：现在团名统一是「<类别>互助团」，几十个团同名，
  按名称分组会把它们并成一个。展示名用「团名 · 区县」（有区县就不重复城市）。
- **待办不跟筛选走**：单独按角色范围取数（团长只算自己那个团），否则筛到别的年份会看到 0 待办。
- **统计与列表同源**：同一次查询算出 5 个数字与分组列表；项目组的统计**不再计入草稿**。
- `revalidatePath('/activities')` 全部改为 `'/' `；404 与详情页的「回到活动列表」改指首页。
- **演示数据**：另造了 20 条活动（跨 19 个团，含反馈与部分报销），用于验证多数据下的展示，**保留不删**。
- **所有页面一屏**（1440×900 实测 `scrollHeight - innerHeight ≤ 1px`）：
  首页、`/circles`（地图+列表）、`/circles/all`（323 个团名录）、`/assets`、`/settings`、
  活动详情（文档栏自己滚动，右侧处理与进度常驻）都不再整页滚动。
  ⚠️ 详情页靠 `lg:grid-rows-[minmax(0,1fr)]` + 文档栏 `min-h-0 overflow-y-auto`
  才收得住长文档——只给 grid 高度、不加 `grid-rows` 时行高仍按内容撑开，页面照样滚。
- **验证**：1440×900 下 `scrollHeight - innerHeight = 1px`（页面不滚）、列表内部可滚（20 行）、
  资金排行 19 个团可滚、Tabs 三档可切、无 canvas；390px 无横向溢出；22 项浏览器回归全通过；
  tsc 与 build 通过。

### 8.50 第十七轮：工作台全面诊断（安全 · 品牌色 · 交互 · 移动端）（2026-10-28）

用户授权"打破原有规定、交付完美作品"，主色取自上传的「数字木兰 DIGITAL MULAN」标识。

**安全（最重要，回归时先看）**——诊断发现 REST 接口能绕过全部业务校验：
- 团长 `PATCH /api/activity-plans/<id> {status:'approved'}` 能**自己批自己**；
  `PATCH /api/reimbursements/<id>` 能改**任何团**的报销金额与状态（id 是自增数字）；
  能把别团凭证的 `cohort` 改成自己团再读走发票；能替换公开站封面、把内部视频翻成公开。
- 修法：方案 / 反馈 / 报销 / 付款凭证 / 精选 / 互助团 / 邀请链接 / 用户的 REST 写入改为 `opsOnly`
  （`src/access/index.ts`）；媒体 REST 创建只给项目组（资源页大文件直传）。服务端动作走本地 API
  不受影响；`lib/upload.ts` 改为 `overrideAccess: true` 并在内部再校验文件类型。
- 上传类型显式列出（`MEDIA_MIME_TYPES` / `RECEIPT_MIME_TYPES`），**不收 SVG**（同源存储型 XSS）。
- 停用账号：`beforeLogin` 拒登 + `currentUser()` 视为未登录。会话 3 天、生产 `secure` cookie。
- 公众域只开放 `/api/media/file/*` 与 `/api/contact`；`/api/ops-users`、GraphQL 只在 CMS 域；
  未登录不能列媒体库；登录 / 注册 / 邀请查询 / 联系表单按 IP 限流（`lib/rate-limit.ts`，单进程）。
- 安全响应头 + `poweredByHeader: false`；生产环境 `PAYLOAD_SECRET` 过弱拒绝启动（构建期不拦）。
- **有意不配 Payload 的 `csrf` 名单**：配上后无 Origin 的请求要靠 `Sec-Fetch-Site` 认 cookie，
  iOS Safari 16.4 以前不发——老 iPhone 每页都会掉登录。理由写在 `payload.config.ts`。
- 逻辑漏洞：`submitReport` 可重复提交（双份反馈 + 双份报销）→ 先查重；
  `updateReport` 凭证**按位置对行**（原来滤掉空文件框后错位挂到别的明细行）→ `filesByPosition`；
  报销已通过后反馈不能再改；`reviewReport` 只处理待处理且未发布的反馈；
  邀请 token 改 `crypto.randomInt`（16 位）并校验邮箱 / 团；注册**先占用链接再建号**，失败回滚；
  反馈钩子只把「已通过」的方案推进到「已实施」；已解散的团不能再发起活动。
- 验收：`sec-test.sh` 28 项全过（REST 写入 403、公众域白名单、限流 429、响应头）。

**品牌色**：`--accent #7c3aed`（白字 5.7:1）、渐变 `#9b5cf6 → #4f7cf7`；中性色从暖棕改冷调微紫；
`faint` 从 3.1:1 提到 4.9:1（全站标签 / 日期在用）；新增 `success / warning / danger` 状态色。
所有对比度都用脚本实测过（不是估的）。标识组件 `BrandMark`，登录页左侧品牌渐变面。

**组件**：
- `Button` 默认 44px / 16px，outline / ghost 悬停改 `console-accent`（原来紫底黑字 2.8:1）。
- `Tabs` 52px、选中态白底紫字（原来与底色几乎分不出）。
- `Dialog` 描述 17px。
- `StatusBadge` 统一全站状态色（原来"未开始"用 3.1:1 的浅灰）。
- 导航选中态改浅紫。

**交互**：
- `ConfirmDialog` 二次确认：解散互助团、精选发布、提交活动申请、审核与采纳（驳回用红色按钮）。
- 审核 / 驳回的必填意见改在弹确认之前拦。
- 「采纳 / 要求补充」原来两个按钮长得一样、看不出选中了哪个，已修。
- 登录报错分类：密码错 / 锁定 / 停用 / 太频繁；显示密码开关；成功后按钮保持 loading。
- 通知：时间（北京时间，避免水合不一致）+ 全部已读。
- 工作台 `error.tsx` 兜底页。
- ⚠️ **工作台不放 `loading.tsx`**：流式渲染开始后 `redirect()` / `notFound()` 改不了状态码，
  团长访问 `/assets` 会先看到资源页骨架再被客户端踢走、404 变成 200（试过，已撤）。

**移动端**：活动详情 390px 横向溢出 156px 的两个根因——进度条 flex 子项缺 `min-w-0`；
公文表格 `table.data` 没有滚动容器（窄屏改为表格自身横向滚动）；`table.fields`（标签|值×2）
窄屏改两列网格（原来日期被挤成一字一行）。另给五处只在 `lg:` 才有列的网格补 `grid-cols-[minmax(0,1fr)]`。

**验收脚本**：`VERIFY_SKIP_PUBLIC_CONTENT=1 npx tsx scripts/verify-round.ts` 跳过已过时的公众站内容断言
（公众站改版后需单独更新），工作台 + 边界 85 项全过；清理空草稿改用 ops 账号、且只清本次由该团长新建的
（原来按"团长看不到的草稿"去删，会误删别团草稿——本轮发现时删掉过 2 条 id>20 的历史空草稿，20 条演示活动完好）。

### 8.51 第十七轮之二：清掉 8.50 的遗留（2026-10-28）

- **CMS 后台水合报错已修**：`app/layout.tsx` 删除，改为**多个根布局**——
  `(site)/layout.tsx` 与 `(admin)/layout.tsx` 各自用 `src/components/RootDocument.tsx`（`<html lang="zh-CN">` + 字体 + globals.css），
  `(payload)` 用 Payload 自己的 `RootLayout`。现在每页只有一个 `<html>`，后台不再报错，
  而且公众站的 Tailwind 基础样式也不再渗进 CMS 后台。
  404 分三处：`app/global-not-found.tsx`（不存在的路径，需 `experimental.globalNotFound`）、
  `(site)/not-found.tsx`（公众站页面里 `notFound()`）、`(admin)/not-found.tsx`（工作台路由在公众域被访问）。全部中文、无登录入口。
- **活动照片发布前不公开**：`media` 加 `cohort`（所属互助团）字段与迁移 `20261027_181419_media_cohort`（幂等）。
  读权限：公开文件人人可看；内部文件只给项目组与**所属团的团长**（文件下载地址同样受控）。
  反馈里的现场照片上传为 `internal` + 团归属，`publishFromReport` 发布时才把这些照片转 `public`；
  视频、签到表、资金证明不进公开站，保持内部。PDF 导出从磁盘内联图片，不受影响。
  存量数据核对过：被反馈引用的 6 个文件都必须公开（已发布活动的画廊 / 演示数据复用的公开资源文件），可见范围不变，只补了归属。
  实测：本团团长 200、项目组 200、别团团长 403、匿名 403；发布后匿名 200。
- **公众站验收断言按现结构重写**（首页 = 介绍 + 入口；项目及活动 → 成果 / 互助团详情；资源；关于；合作），
  `verify-round.ts` 不加开关跑完整 **125 项**全过。
- **公众站文案去掉内部术语**：关于页「每个团有 1 名团长和若干骨干成员」「项目组为互助团提供活动专项经费」、
  合作页「项目组会收到 / 发送给项目组」——都是规则与内部角色，已改写（`src/content/site.ts`）。
- 8.50 里误删的 2 条空草稿：所有备份与回收站里的 30 份旧库都早于它们，**无法恢复**。

⚠️ **测试时不要按「关系行 id」删数据**：Payload 每次保存文档会删掉并重建它的关系行（`*_rels`），
id 会被复用。本轮发布测试按 id 删临时照片，误删了反馈 3 的一张照片（已按备份恢复，全表比对一致）。

⚠️ **仓库根目录出现了 `muse/`**（另一个项目「muse-app」，Alipay Muse / evjs，有自己的 package.json 与 tsconfig），
2026-10-28 02:30 放进来的，不是本轮改动。根 `tsconfig.json` 包含 `**/*.ts`，所以 `npm run build` 的类型检查会被它卡住；
排除 `muse` 后本项目类型检查通过。是否把它排除出根 tsconfig（或移出仓库）待确认。

**已知遗留**：演示数据里多个团共用同一批公开照片文件，所以这些演示照片没有团归属（新上传的照片都有）。

### 8.52 第十八轮：反馈并入报销审核 + 女性化主题 + 首页三标签重做 + 公众站参照朋友平台重做（2026-10-28）

用户要求：把朋友的 `muse/` 前端设计融进来、接现有后端；修标签栏竖向滚动条；反馈审核并入报销审核
（不通过 = 反馈退回，通过 = 自动发布，不再有「精选」）；首页进度改图形、环节名进表头；整站更女性化；
图片体验（灯箱 / 悬停放大 / 布局 + 关键词搜索）；资金看板加指标。

**流程（回归先看）**
- 删掉 `reviewReport` / `toggleRecommendation` / `publishFromReport` 与对应组件（推荐 / 反馈审核 / 精选按钮）。
- `reviewReimbursement`：通过 → 报销核定、反馈 `accepted`、内部函数 `publishReport` 建公开成果并把现场照片转公开；
  不通过 → 报销 `rejected`、反馈 `revision_required`，审核意见写进 `revisionNote` 给团长看。
- ⚠️ 更新反馈状态时**必须带 `user`**：`ActivityReports` 的 beforeChange 按 `req.user` 判「仅项目组可以采纳」，
  不带就抛错（本轮第一次实测就踩了，报销已改、反馈没改——两个写入不在一个事务里，顺序上先写报销）。
- 团长能改反馈的条件：反馈被退回 / 报销被驳回 / **还没有报销单**（旧演示数据里有反馈已采纳却没报销单的，
  保存一次就会补交报销）；报销审核中、已通过时不能改（服务端 `updateReport` 同样拦）。
- 实测：通过 → 公众站 `/outcomes/<新串>` 200、团长收到通知；不通过 → 反馈退回且带意见。测试数据已按内容还原。

**主题（`globals.css`）**：梅子墨字 `#2b2035`、樱粉白底 `#fcf8fb`（极淡粉色圆点纸纹）、新增木兰粉
`--color-rose #b8336a`（白字 5.65:1，浅粉底 5.0:1，实测）/ `rose-soft` / `rose-light`；圆角卡片 20 / 控件 12；
粉紫调阴影；`bg-blush` 柔光底；按钮与标签栏改胶囊；字体阿里巴巴普惠体（`RootDocument` 引外链 CSS，
按 unicode-range 分片）。导航加图标（`WorkspaceNav` 的 `NAV_ICONS`，服务端布局只传键名）。
`rose` 用于点缀、图表第二系列、悬停底；交互主色仍是紫色 `accent`。

**工作台首页**：进度列表头写「申请 / 审核 / 反馈 / 报销」，行里只有圆点 + 紫→粉渐变连线（窄屏卡片带字）；
图片标签：关键词搜索（`?q=`，搜活动名 / 团 / 地点 / 总结）、瀑布流、悬停放大、`PhotoGallery` 灯箱
（左右键、计数、下载；键盘事件挂在弹层上——挂 window 会被弹层拦下）；资金标签：预算 / 实际报销 / 结余或超支 /
人均成本四个 KPI、待审核报销队列、按费用类别（预算 vs 实际）、超出预算的活动。

**公众站**：首页 = 轮播（最近活动现场，5 秒切、悬停暂停、减少动态时不自动切）→ 标题 + 四个数字 →
最新活动（搜索 + 按项目）→ 互助团风采（封面卡）→ 入口；`/projects?q=` 关键词搜索。`HomeHero` 已删。
没有用 muse 里的外链轮播图（alipay imageProxy 地址会失效），用的是自己库里的现场照片。

**其他**：`lib/seed-env.ts` 加 `MULAN_LOCAL_SCRIPT=1`，`payload.config.ts` 的生产密钥检查对本地脚本放行——
否则 §8.50 加的检查会让 `npm run seed` 与所有 seed-env 脚本直接报错。通知角标改 15px 木兰粉。
`tsconfig.json` 排除 `muse/`。

**验证**：tsc / build 通过；verify-round 125/125；浏览器回归 22/22；安全 28/28；布局审计全部通过。

> ⚠️ §8.52 里的「公众站首页重做」已被 §8.53 整体替换。

### 8.53 第十九轮：公开站逐页复刻 muse，接本系统数据（2026-10-28）

用户：「在 connect 站（后端 / 数据）的基础上，加上 SOP 文件，复刻 muse 文件夹下的前端，与 API 结合，
做出与 muse 一样的前端，再优化。」用户明确说**别管以前公众站的规则**（不出现内部术语那条已取消；
**不放登录入口仍保留**）。

**页面对照**（muse → 本站）：
| muse | 本站 | 说明 |
| --- | --- | --- |
| layout（顶栏 + 蓝色页脚） | `(site)/layout.tsx` + `SiteHeader` / `SiteNav` / `SiteFooter` / `BackTop` | 窄屏导航改成抽屉（muse 原版是一排小图标） |
| Home | `/` | Banner 轮播 → 三个数字 → 最新活动（公益项目 + 类别快速筛选）→ 互助团风采 → 「互助团这样办起来」 |
| ActivityList | `/outcomes` | 项目 / 区域 / 关键词 / 时间 / 类别筛选（写进地址栏，服务端过滤）+ 9 条一页 |
| ActivityDetail | `/outcomes/[slug]` | Banner、胶带批注卡、正文、相册（灯箱可翻页下载）、相关活动 |
| TeamList | `/circles` | 搜索 + 按项目筛选 |
| TeamDetail | `/circles/[slug]` | Banner、关于我们、骨干成员（SOP 角色，团长显示姓名）、活动时间轴、留下的资料 |
| —（docx 内容） | `/about`「关于数字木兰校友会」 | 内容在 `content/site.ts` 的 `site.about`，**逐字取自 `docs/SOP/about&contactpages.docx`**（2026-11-02 第三十四轮）：校友会是什么 / 三个关键词 / 互助团 / 姐妹收获 / 项目组支持 / 落地路径流程图（`components/site/AboutFlow.tsx`） |
| — | `/resources`、`/contact`（联系我们）、404 | 统一成 muse 样式 |

- **配色**：muse 的蚂蚁蓝 + 木兰粉 + 暖白点阵底，token 是 `mountain` / `magnolia` / `primrose` / `ink` / `page` / `line` / `tape`
  （`globals.css`），**只在公开站用**，工作台仍是紫色。蓝、粉各加深一点：白字对比度从 3.9:1 提到 5.3:1（实测）。
  纸片阴影 `shadow-card` / `shadow-card-hover` / `shadow-paper`、`tape`、`hand-note`、`muse-page` 都在 `globals.css`。
- **活动类别**（技能提升 / AI素养 / 健康科普 / 生活成长，来自 SOP §7）：
  2026-10-31 起**在《活动申请表》里选**（`activity-plans.kind`，放在「活动主题」之后，必填，单选）；
  发布成果时把它写进 `publications.kind`，公开站按这个字段筛。
  ⚠️ `lib/activity-kind.ts` 的关键词归类**只作旧数据回退**（没有 `kind` 时才用），不要再让标题措辞决定类别。
  存量已回填（1 份方案 + 19 条成果）。
- 共享组件在 `components/site/muse.tsx`（ActivityCard / TeamCard / ResourceCard / EmptyState / Pager / museButton）；
  筛选在 `ActivityFilters.tsx`，过滤在 `lib/public-filter.ts`。
- 删掉：`/projects`、`/projects/[category]` 与旧的 OutcomeCard / CircleCard / CircleTile / ProjectCard / HomeEntryCard /
  LibraryCard / ResourceTile / Reveal / site/PageHeader / site/ActivityCard。
- 没用 muse 的外链图片（alipay imageProxy 会失效）：Banner 用库里的活动照片，不足 3 张用文案补位；团 Logo 用所在城市首字。
- `verify-round.ts` 的公众站断言按新结构重写（123 项）。

**验证**：tsc / build 通过；verify-round 123/123；安全 28/28；1440 / 390 两档各页无横向溢出、无控制台报错。

### 8.54 第二十轮：公开站「高级 · 温馨」调优（2026-10-28）

用户：在 §8.53 基础上做得更高级、更女性温馨，参考国内外高级站点；**不抛弃现有东西，只调整优化**；两边留白再少一些。
结构与数据接口不变，只调气质：
- **版心** 1152 → **1440px**（`Wrap`：左右 20 / 32 / 48px），顶栏、页脚同宽。列表页宽屏（≥1536px）4 列，活动列表一页 12 条。
- **配色**（token 名不变，全站一起变，对比度实测 ≥4.6:1）：底色暖奶油 `page #fbf7f4`、梅子墨 `ink #2a2433`、柔靛蓝 `mountain #2f55c9`、
  木兰粉 `magnolia #c2335f`、浅樱粉辅助面 `primrose / blush`，新增 `lilac` / `peach`。页面顶部一团樱粉 + 薰衣草柔光（`muse-page`）。
- **质感**：阴影从「纸片错位」改成多层柔光；卡片照片**内嵌**（四周白边、圆角套圆角 24/18px）；按钮全部胶囊；
  标题用细字重大字 + 粉色荧光笔强调（`Heading mark` / `mark-soft`）；章节眉标签前加一枝线描木兰（`Sprig` / `Eyebrow`）。
- **首页**：圆角大画幅轮播（照片缓慢推近、01/05 计数 + 进度条、「看看这场活动」）→ 数字浮在 Banner 下沿的毛玻璃卡 →
  「从各忙各的到互相搭把手」+ 三个为什么 → 最新活动 → 互助团风采（柔光面板）→ 六步 → 结尾的话（樱粉→薰衣草渐变）。
- **详情页**：Banner 收进圆角画幅；活动详情改**两栏**（正文 46em + 右侧吸顶「活动档案」卡），互助团详情改两栏（时间轴卡片 + 右侧数字 / 骨干成员 / 资料）。
- **页脚**：靛蓝→梅子夜幕渐变 + 两团柔光 + 一行淡淡的大字落款「一朵木兰 · 千万姐妹」。顶栏毛玻璃，右侧「合作联系」胶囊。
- 新共享件都在 `components/site/muse.tsx`：`Sprig` / `Eyebrow` / `Heading` / `SectionHead`；工具类 `glow-panel` / `mark-soft` 在 `globals.css`。

**验证**：tsc / build 通过；verify-round 123/123；1440 / 390 各页无横向溢出、无控制台报错。

### 8.55 第二十一轮：公开站换官方标识色 + 删掉多余的说明文案（2026-10-28）

- **配色取官方标识**（紫 `#c07bff` → 蓝紫 `#8a62f2` → 蓝 `#4a72ff`）：`globals.css` 公开站 token 全部换成紫蓝系——
  `magnolia #6b4ae6`（交互主色，白字 5.6:1）、`mountain #3558e0`、`page #faf8ff`、浅面 `blush / primrose #f1ecfe`。
  新增 `bg-mulan`（原渐变，只放大字）与 `bg-mulan-deep`（加深一档，可放小字）；`--gradient-brand` 也改成官方渐变（工作台标识同步）。
  公开站文件里写死的粉色十六进制已全部替换。
- **首页数据**：数字不再压在轮播图上，改成轮播下面一条独立的官方渐变色带（左一句话，右三个数字）；轮播保留。
- **版心** 1440 → 1600px。
- **删掉的文案**：页头的诗意批注（「每一场相聚都值得被记住」等）、「图文 / 某某团」、「点击图片查看大图…」、
  「按活动时间倒序 · 仅展示本互助团活动」、两处页面导语、页脚「让每一份善意都被看见」、顶栏副标题改为 `DIGITAL MULAN`。
  `PageIntro` / `SectionHead` 的 `note` 改为可选。

### 8.56 第二十二轮：首页互助团分布地图换成官方边界的填色图（2026-10-29）

- ⚠️ **官方文件一个字都不改**（不裁剪、不简化、不删要素）。「境界线」31 段全部绘制，线型照官网前端代码：
  默认实线细描；官网对 5 个 gb 编码用虚线（`dashArray 5,5`、weight 2）——156980000（深港）蓝色虚线，
  156970000（新疆西端帕米尔）**白色虚线**（白线压掉省界实线，看起来就是虚线）。其余 3 个编码省级数据里没有。
- ⚠️ **下载的 GeoJSON 清空了「境界线」的 `gb`**（服务端接口里有），所以按「段数×点数」的几何签名认回来：
  `7x22`→156980000、`1x312`→156970000（见 `src/lib/china-geo.ts` 的 `SPECIAL`）。
- **数据**：天地图**开发者中心**「行政区划可视化」下载的省级 GeoJSON（`media/geo-www/cn-provinces.geojson`，
  34 个省级面 + 8 段「境界线」），审图号 **GS (2026) 4921号**，数据更新 2026-10。
  ⚠️ 注意：天地图**公开服务 API**（`v2/administrative`）只给名称与中心点，**不给边界**；
  边界与填色只能用这个工具下载的 GeoJSON。文件原样保存，**不改边界**。
- **组件**：新增 `src/components/site/ProvinceChoropleth.tsx`（ECharts `geo` + `custom` 叠加九段线），
  只改填充色与数量标签；`roam: false`（不让人拖拽缩放，避免把国土裁缺角）。
  九段线用 `custom` 系列而不是 `lines`——`lines` 会另开一层 canvas（出现两块画布）。
  StrictMode 下要用 `getInstanceByDom` 复用实例、只在容器 `isConnected === false` 时才 dispose。
- **数据层**：新增 `src/lib/china-geo.ts`（读文件 + `shortProvinceName`，省名「浙江」↔「浙江省」互认）。
- **首页**：地图卡左、数字与省份排行右；图下注明「地图数据：天地图 · 审图号 GS (2026) 4921号」。
  旧的 `ProvinceMap.tsx`（天地图 JS API 气泡图）与 `NEXT_PUBLIC_TDT_KEY` 一并删除，公众站不再需要地图 key。
- 想下钻到市/县时，**分别下载对应层级的 GeoJSON**（各带审图号），不要把省图放大裁切。
- **两屏节奏**：轮播高度 `calc(100dvh-6.75rem)`（窄屏）/ `calc(100dvh-7.25rem)`（≥640px），
  **顶栏下方与屏底各留同样 20/24px**，第一屏只放轮播（不会露半截地图）；
  分布区 `lg:min-h-[calc(100dvh-3.5rem)]`，滚一屏正好是地图与数字，底部同样贴齐 24px。
- **地图卡去掉了白底/边框/阴影**（透明浮在页面底纹上）；地图高度 `calc(100dvh-9rem)`，撑满第二屏。
  右侧**不要底色卡片**：3 行「大字数字 + 小标签」（数字 `clamp(3.75rem,6.6vw,7.5rem)`，渐变字，
  标签 17/20px），整块在右栏内水平居中（`justify-self-center`），标题、省份清单都不写。
- **顶栏品牌区**（2026-11-04 起，换新版标识）：官方组合标换成 `public/brand/mulan-logo.svg`
  （1018.1 × 137.5，约 **7.4 : 1**，记号 +「数字木兰校友会」，蓝 `#007efa` + 深灰 `#333`）。
  - 公开站顶栏：**只放组合标**。标识本身已经写了「数字木兰校友会」，
    原来的「｜竖线｜校友会」**已删除**，别再加回去。
    尺寸（2026-11-04 用户定的口径：**标识要比导航正文大一点、但不能压过导航**）：
    <640px 用 24px；**≥640px 用 30px**。
    换算依据：标识里「数字木兰校友会」的墨迹占画布 80%，所以**显示高度 × 0.8 = 字的墨迹高**；
    30px → 字高 24px，导航正文 16px（`--text-small: 1rem`）→ 1.5 倍。
    （试过的档位：52px 太大、44/36px 仍偏大、24px 偏小，**30px 是用户点头的那档**。）
    导航胶囊保持原本的 `px-4`（logo 变小后放得下了，不用再为它收紧）。
  - 工作台顶栏：**整条组合标 +「工作台」**（原来的「｜竖线｜校友会工作台」改成
    「标识 工作台」；**不再挂角色徽标**）。
    尺寸：<640px 用 20px（且不写「工作台」两个字，手机上横排放不下）；**≥640px 用 30px**
    （同公开站：字高 24px，是导航正文 16px 的 1.5 倍）。
    ⚠️ 1024–1279px 那一段还是塞不下 36px（实测右侧「公开站 / 退出」会折行、
    品牌文字被截断），所以那一段用 32px（配套把工作台导航胶囊收到 `px-2.5`，
    `xl` 段回 `px-4`，顶栏行间距 `lg:gap-x-3`）。
  - **标语「AI时代 木兰同行」**（2026-11-04 用户加）：**只放公开站顶栏**，在**标识后面**，
    `public/brand/slogan.svg`，用 `BrandSlogan`（`src/components/console/BrandSlogan.tsx`）渲染，
    **28px 高（宽 141px）**，**1280px 起才出现**（1024–1279px 那段顶栏放不下：标识 + 标语 + 五个导航会超宽）。
    2026-11-05 用户定的口径：标语要**够大、看得清**（别缩成小字）—— 28px 时字高 21px，
    和标识的字高（23.5px）基本同一量级。
    **管理端（工作台）不放标语**（用户定的：工作台只要「标识 + 工作台」）。
    ⚠️ **位置要手动配平**（现为 `translate-y-[4px]`）：标语是斜体、盒高比标识小，
    纯靠 flex 居中会显得低；往下挪一点才和标识的字身基线齐平。
    （换算口径：标识 30px → 字的基线在 45.5px；标语 28px + 偏移 4px → 基线 45.0px，
    基本齐平；行字的拖尾自然垂到基线以下。）
    ⚠️ **这个文件不是矢量**（2026-11-04 用户决定：**保持原样**，不要描摹）：
    SVG 外壳里内嵌了一张 1560×310 的 PNG（透明底、base64 内嵌，178KB、0 条 path），
    所以缩到顶栏的 101px 宽时边缘是位图软边（比矢量标识毛）。
    ⚠️ 曾经描摹过一版真矢量（路径 + linearGradient，17KB），留档在
    `docs/brand/slogan-vector-traced.svg`，**没有启用**——用户决定还是用设计给的原图。
    原图的 PNG 留档在 `docs/brand/slogan-source.png`。
    （将来若要让设计给「转曲」的矢量版，导出来直接替换 `public/brand/slogan.svg` 即可。）
  - 登录 / 注册页：只放组合标（宽屏 44px、窄屏 40px），深色底上变白。
- **标识看着「糊」不是分辨率问题**（2026-11-04 记）：SVG 是矢量，浏览器按显示尺寸重新栅格化，永远清晰。
  新版标识**字重很粗**，同样高度下笔画挤在一起、字内空隙被堵上，才显得糊成一团。
  解法是**把字高调到跟导航正文一个量级**（桌面 24px → 字高 19.2px，导航正文 16px）：
  再大会压过导航（试过 52px，明显过），再小笔画就粘连（1× 屏上最细笔画会掉到 2 设备像素以下）。
  ⚠️ 已逐条验过「文件太大导致糊」的三种猜想，结论都是**不是**：
  ① 缺固有尺寸 → 浏览器退回默认 300×150 画布再缩放（这条**确实会糊**，已补
  `width`/`height`/`preserveAspectRatio`）；② 加 `shape-rendering="geometricPrecision"`
  → 边缘锐度 22.13 → 22.13、半灰像素 1565 → 1565，**无差别**；
  ③ 渲染宽取整数（296px）而非分数（296.17px）→ 半灰像素 1565 → 1561，**无差别**。
  文件本身很干净：5.7KB、17 条矢量路径、0 张位图、0 个文本节点，墨迹把画布占满（四周空白各 0.5 单位）。
- **标识文件**：根标签必须带 `width="1018.1" height="137.5" preserveAspectRatio="xMinYMid meet"`
  （**换新文件后记得补回来** —— 设计重新导出时通常不带这三个属性）。
  少了它们，浏览器会退回默认 300×150 画布对象来算尺寸（Chrome 实测画面一样，
  但个别内核会先按 300px 栅格化再缩放，那就是真的糊）。
- **标识**：`BrandMark`（`src/components/console/BrandMark.tsx`）只按高度缩放、宽度按原图比例，
  不再画渐变底；深色底上（登录页左栏）传 `className="brightness-0 invert"` 变白。
  站点图标是 `src/app/icon.svg`（同一份记号）。
- 公开站页脚只剩一行：`更多 · 蚂蚁公益基金会 ↗`（官方链接）+ `©2026 数字木兰校友会`；
  `html` 的 `scroll-behavior` 必须是 `auto`，否则 Next 路由切换会把「回到顶部」拉成一段平滑滑动。
- **地图说明与悬停**：图下两行——「互助团全国分布图」+「地图数据：天地图 · 审图号 …」。
  悬停提示按省列出「市 + 区/县**全称** → 团名」（用 `CircleSummary.placeFull`，如「成都市青羊区」，
  按全称排序）。⚠️ 地名过长时**只让地名自己折行**（`flex:1;min-width:0`），
  团名 `flex:none;white-space:nowrap` 永远留在同一行右侧。数字用**准确值**，不加「+」。
  ⚠️ geo 区域的 tooltip **只认 `geo.tooltip.formatter`**（根节点 formatter 不生效），
  且不可用 `backgroundColor` 等配置改样式——统一用 `className: 'chor-tooltip'` + `globals.css` 覆盖。
  ⚠️ 这个 tooltip 容器**常驻 DOM、空着也有尺寸**：底色 / 圆角 / 内边距必须加在内层
  `.chor-tooltip-inner` 上，外层保持透明——否则地图下方会多出一条黑色圆角长条。
- **活动卡底部固定两行**（首页与 /outcomes 同一套）：第一行「日期 + 地点」，第二行「团名 + 人数」；
  地点与团名单行省略、悬停看全文，人数不折行。筛选条里项目那一栏的标签只写「项目」。
- **覆盖范围措辞**：首页数字下写「已覆盖 N 个省级行政区 · M 个县级行政区」——
  不写「省 / 县」，因为还有自治区、直辖市、自治县、旗。
- **设置页**（项目组）默认**只读**：一行一项（预算上限 / 人数下限 / 两位负责人），右上角「编辑」才出现表单；
  保存成功回到只读并提示「已保存」，失败留在编辑态报错。卡片与「个人信息」同宽（`max-w-2xl`），不再是整屏表单。
- **工作台首页问候**：按**北京时间**分时段——`<5 夜深了` / `<12 早上好` / `<14 午安` / `<18 下午好` / 其余「晚上好」
  （muse 站原话是「午安」，这里按大陆习惯改成「中午好」）；整行左侧留白 32px（`PageHeader` 的 `titleClassName="pl-8"`，
  不是塞全角空格——行首空格会被 HTML 吃掉）。
  ⚠️ `Intl` 必须用 `en-GB`：`zh-CN` + `hour:'numeric'` 会返回「13时」，`Number()` 得 NaN。
- **互助团主页大图**：用 `cohorts.cover`（原本就有这个 upload 字段，只是标签从「封面」改成「主页 Banner 大图」；
  ⚠️ 别再新增同名字段——`DuplicateFieldName` 会让整个后台 500）。工作台「团信息」卡片顶部显示这张图，
  团长 / 项目组点「更换图片」即可（`updateCohortCover`：图片进 `media` 公开、写回 `cover`）；
  公开站 `/circles/<slug>` 的 banner **优先用它**，没设才回落到最近一场活动的现场照片。
  工作台团详情页头另有「公开主页」按钮（`publicCircleUrl`，`_blank` 新开）。
- **设置页卡片宽度**与「个人信息」一致：`mt-8 max-w-2xl` + `p-4 sm:p-6`（实测都是 672px / 左边 48px）。
- **骨干成员**：`cohorts.team`（group：副团长 / 资源对接员 / 材料整理员 / 拍摄宣传员，**只存名字**）。
  工作台团详情页有「骨干成员」卡片，本团团长与项目组可填（`updateCohortTeam`），**直接覆盖、不记历史**——
  这几个角色不进权限系统、不参与审批，团长变更已有 `leaderTerms` 留痕，分工换人频繁，存历史只是噪音。
  公开站团主页的「骨干成员」显示「团长（账号姓名）+ 四个名字」，**没填的不显示、不写职责说明**。
  头像：五个都是 **lucide 线性图标**（1.6 线宽、22.4px），团长=UserRound（一个人）、副团长=UsersRound（前后两个重叠的人）；
  资源对接员=Link2、材料整理员=FolderOpen、拍摄宣传员=Camera。区分靠**圆底**：团长实心紫底白标，
  其余淡紫粉底 + 紫标（不再用实心图标，避免与线性风格打架）。
- **邀请链接同一时间只有一条有效**：`createInvitationLink` 在创建前先把同范围的 `active` 链接置为
  `revoked`——`create-cohort` 全局唯一，`transfer-lead` 按团唯一（每团一个转移链接）。
  邀请页按钮 `size="sm"` + `self-start`（Card 是 flex-col，不加会把按钮拉满整行）。
- **团长看别团：不给他团团长手机 / 邮箱**（三层，**不是前端藏一下**）：
  1) `users.read = selfOrProjectTeam`——关系填充时别人的 leader 只剩 id，REST 也读不到；
  2) `users.phone` 字段级 read = 本人或管理者（`isManager`）；
  3) 工作台团详情页按 leader id 单独取 `{name, phone, email, joinedAt}`（`overrideAccess` 仅限服务端），
     非本人且非项目组时把 `phone/email` 置空，页面显示「—」。
  实测：团长 `GET /api/users/<他人>` → 404；`/api/cohorts?depth=2` 的 `leader` 只有 id；页面显示「姓名 + 手机 — + 邮箱 —」。
- **活动详情两栏**：正文占满左栏（`1fr`，**不加 max-w**）+ 侧栏 `22rem` + `gap-16`，
  间距恒为 64px；图片与相册跟着栏宽按比例放大。之前给正文加 `max-w-[46em]` 会在宽屏上
  把余量全堆成正文与侧栏之间的空白（1920 实测 370px），已去掉。
- **内页顶边统一**（2026-10-29）：`/circles` `/outcomes` `/resources` `/about` `/contact` 一律
  `pt-10 sm:pt-14`——**顶栏下方 40px（手机）/ 56px（桌面）**，五个页面首块顶边实测一致。
  首页第一屏是轮播，不套这条。
- **用词**：顶栏导航「活动」（2 字，与资源 / 关于并列）；页面 H1「所有活动」（旁边是「共 N 场活动」）；
  活动详情返程链接「返回所有活动」。界面里不再出现「活动列表」。

### 8.57 第二十三轮：删掉追风计划 + 换成 54 个真实落点的互助团（2026-10-30）

- **追风计划整个删掉**：集合选项、`lib/labels`、`site.projects`、`/api/join` 的枚举、`ProjectTag` 配色、
  种子里的类别全部移除；库里 120 个追风计划模拟团删除，原误标为追风计划的「深圳内容互助团」归到 AI豆计划。
- **模拟盘清空，换成真实落点**（`scripts/seed-network.ts` 重写）：
  - AI豆计划 **17** 个（用户提供的落点：万山 / 遵义 / 清涧 / 子洲 / 延川 / 绥德 / 宜君 / 永和 / 朔州 /
    积石山 / 银川 / 平安 / 张北 / 永靖 / 兰考 / 铜川 / **金昌**；四川九龙按要求排除）
  - 加油木兰 **15** 个（甘肃东乡、渭源、贵州织金、纳雍、云南镇雄、会泽、四川昭觉、宁夏西吉、青海化隆、
    山西大宁、内蒙古卓资、河南卢氏、广西都安、河北康保、湖南桑植）——**按项目省份选点，非官方逐县名单**
  - 民宿管家 **22** 个（16 个项目省份、各 1–2 个乡村旅游县）——同样是**代表选点**
  - 每个团 `isPublic=true`（公众站有主页），团长账号 `real-*@mulan.org`（密码 Mulan@2026）；
    一共 **54 个真实团**，**每三个团发一条公开成果**（≈办过一场活动），
    公众站现在有 54 个真实团主页 + 18 条活动（外加 5 个原演示团、14 条演示成果）。
- ⚠️ **后补落点只能 append 到 `EXTRA`（列表末尾）**：`slug` 与团长邮箱都带 list index，
  往中间插会让后面所有团的地址标识整体错位（已发出去的链接就断了）。金昌就是这样补进去的。
- **清掉 1136 个遗留 `sim-*` 团长账号**（模拟盘删团后账号成了孤儿，仍可登录）：
  ⚠️ 删账号前要先删 `notifications`（`recipient_id` 是 NOT NULL，Payload 删用户会去置空它 →
  `SQLITE_CONSTRAINT_NOTNULL`，跟 `restore-demo.ts` 踩的是同一个坑）。
- **删团要先删依赖**：`payments → reimbursements → activity-reports → publications → activity-plans → cohorts`
  （`cohort_id` / `plan_id` 是 NOT NULL，直接删团会撞约束）；
  **跑种子前必须先停 dev**（SQLite 会 `SQLITE_BUSY`）。
- **设置页与其它页对齐**：`PageHeader` 标题行加 `min-h-11`——右侧有按钮时行高 44px、
  没有时本来只有 32px，下一块内容会差 12px（实测 `/assets` `/settings` `/account` 现在都是 108px）。
- **团名**：真实盘用「地名 + 项目 + 互助团」（如「万山AI豆计划互助团」），否则 54 个「AI豆计划互助团」无法区分。
  ⚠️ 自治县名去掉民族名后可能为空（东乡族自治县），`Entry.shortName` 兜底。

**第二十三轮之二：5 个早期演示团全部清掉（2026-10-30）**

用户："总的 AI豆只有 17 个啊" "我们民宿是贫困地区的，你搞北京？"

- 删掉 `杭州 AI` / `北京产品` / `成都民宿` / `深圳内容` / `西安服务` 五个虚构团，连同它们的团长账号、
  14 条演示成果（带 `杭州 / 北京 / 成都 / 深圳 / 西安` 字样的那些）、测试垃圾成果（「AI科普活动」「测试」）。
  现在**网络里一个虚构团都没有**：AI豆 17 / 加油木兰 15 / 民宿管家 22 = **54**。
- **走完全程的那场演示活动迁到「万山AI豆计划互助团」**：`activity-plans` 的 `cohort`、
  反馈的 `location`、报销的 `cohort`、公开成果的 `relatedCohort` / `byline` / 标题（杭州→万山）一并改；
  `lead@mulan.org` 改为万山团长（`leaderTerms` 换人，原 `real-520603-0` 账号删除）。
- **种子跟着改**：`src/seed.ts` 不再建「杭州 AI」，改为建/复用**万山**（slug 与 `seed-network` 同键
  `real-a-idol-520603-0`，两个脚本不会各建一个）；演示活动的场地、签到表单位、付款收款方全部改成万山。
  `src/seed/showcase.ts` 的 5 个演示团与演示成果改为**开关控制**（`MULAN_SEED_SHOWCASE=1` 才写入），
  资料库拆成 `seedLibrary()` 由 `npm run seed` 照常写入。
- 结果：公开成果 19 条（18 条「第一场共学」+ 万山那场走完全程的），`fill-outcome-covers.ts` 给 18 条补了封面。
- ⚠️ **删演示团前先查依赖**：`publications.related_cohort_id` 不会自动清空，先删成果再删团；
  删团长账号若报 `cohorts_leader_terms.user_id` NOT NULL，说明任期行还挂着，用 SQL 删 `cohorts_leader_terms` 行即可。

**就地编辑：三处卡片统一（2026-10-30）**

用户：「个人信息 / 设置 / 互助团骨干成员，编辑效果不统一，编辑时跳出框体把行距撑高，卡片闪动」。
参考 shadcn 官方 `Field`（`orientation="horizontal"`，标签与控件同一行）的做法，抽了共享骨架：

- `src/components/console/InlineFields.tsx`：`InlineEditHeader`（标题左 + 「编辑」/「取消 保存」右，
  `min-h-11` 固定 44px）、`InlineFieldList`（`divide-y divide-rule`）、
  `InlineFieldRow`（**固定 `h-14` = 56px**，标签 15px `text-faint` 左、值/控件 17px 右）。
- **查看态与编辑态共用同一行骨架**：编辑只是把右边那格换成控件，行高、行数、卡片高度都不变
  （实测三处 326 / 326、517 / 517，卡片不再跳动）。
- 控件沿用组件库默认高度 48px（`Input` h-12、`SelectTrigger` h-12），**不要再手动压成 h-11**：
  手写 `h-11` 与 Select 的 `data-[size=default]:h-12` 同时生效，行高会变成 57–61px。
- ⚠️ **`Card` 默认 `gap-6`**：卡片里塞「表头 + 列表」两个直接子元素时会被撑出 24px 间隔，
  查看态就比编辑态高（账号页曾差 24px）。两侧都用**单一子元素**包一层即可。
- 骨干成员的标题从页面挪进组件（页面不再自带 `<h2>`），三处的标题字号统一 `text-base font-bold`。
- **控件宽度统一**：三处编辑态的输入框/下拉一律 `w-full max-w-56`（224px），右边缘与只读态的数值列对齐；
  行里的 `dd` 是 `flex flex-1 items-center justify-end`，窄屏自动收窄（390 实测无横向溢出）。

**工作台控件收口（2026-10-31）**

- 首页不再自造三件套：搜索框 → `UrlSearchField`（SearchField + 300ms 防抖写地址，**没有「搜索」按钮**）、
  视图切换 → `LinkTabs`（Tabs，地址驱动）、分页器 → `console/Pager`。
  ⚠️ **函数不能从服务端组件传给客户端组件**：`UrlSearchField` 收的是地址骨架 `baseHref`（字符串），
  关键词在客户端拼进 URL（第一版传 `hrefFor` 函数，直接报「Functions cannot be passed directly…」）。
- 删除长期未引用的 `components/console/FormCheckbox.tsx`、`components/console/ResponsiveTable.tsx`、
  `components/ui/radio-group.tsx`；窄屏宽表统一用 `Table` + `.resp-table`（CSS 换排版），不再有包装组件。
- AGENTS 与 `docs/设计规范.md` 里指向这两个组件的描述同步改掉。
- **筛选框按内容长短给宽**（`StatsFilters` 的 `W`）：年份 / 月 134（与经费页「年度」同宽）/ 项目 144 / 地域 192 / 互助团 240，
  移动端统一两列。**项目类型改成下拉**（「全部项目」+ 三项，单选；只给项目组，团长看不到），
  原来那排 chips（`CategoryFilter`）在首页撤掉。筛选块上下都留白，搜索框不再贴住下面的分隔线。
- **待办进标题**：`夜深了，数字木兰项目组，你有 3 项待办`（0 时写「目前没有待办」），
  顶上只留三张数字卡；说明文案（「当前筛选范围内」这类）一律去掉。
- ⚠️ **`currentUser()` 必须带 `collection: 'users'`**（2026-10-31 修）：
  集合访问控制用 `user.collection` 区分业务账号与后台账号，`Notifications.update` 还要求它等于 `users`。
  少了它 → 「通知未读标不掉」（update 被静默拒绝，铃铛里 `await` 的失败又被吞掉）。
  任何新写的 `currentUser()` 包装层都不要裁剪这个字段。
- **「首页」改名「活动」**（2026-10-31）：工作台第一项导航、页面 `title`、帮助标题、兜底页按钮都叫「活动」；
  这一页本身就是活动清单（待办在标题里），不再单设一层「首页」。内部真实路径仍是 `/home`，`/` 由 proxy rewrite。
- **页头 mark 可以在标题任意位置**：`PageHeader` 不再要求 `mark` 是标题结尾（首页把「名字」垫成
  紫色荧光条，其它页仍是结尾那几个字）。
- **顶栏「公开站」新标签页打开**（`target="_blank" rel="noreferrer noopener"`，桌面与窄屏抽屉一致）。

### 8.58 第二十四轮：地图点击 → 右侧列表联动 + 筛选条改成 shadcn 写法（2026-10-30）

用户提了两件事：「/circles 左侧点地图，右侧不同步筛选，请实现」「筛选的清除按钮 UI 很差，
参照 shadcn 官方优化」。**只做这两件，没顺手改别的。**

- **地图 → 列表联动**（`ChinaMap` / `CircleNetwork` / `CohortList`）：
  - 点地图上的省 / 市 / 区（县）→ 右侧列表**立刻筛到这一片**，标题的计数变成「N / 总数 个」。
  - 筛选中的地域以**标记**的形式写进右侧列表的**搜索框里**（用户定的位置：
    「直接把右侧列表的筛选变化词直接放在搜索框里」），点标记上的 ✕ 清除。
  - **点列表的一行只做"地图定位"，不筛列表**——否则点一下行列表就只剩那一行，反而找不到别的团。
  - 「返回上一级」与面包屑把筛选范围带到对应层级；回到「中国」= 不按地域筛。
  - 地图层级（`path`）改成**受控**：父级 `CircleNetwork` 拿着 `path` + `scope`，
    这样「清除地域筛选 → 列表回全部 + 地图回全国」才能一次做完。
  - 匹配口径：一个团同时登记了省 / 市 / 区县三个 adcode，命中任意一个即算在这个地域里。
  - 选中的地域在地图上**高亮**（`scope.adcode` 参与高亮判断）；区（县）不能再下钻时高亮它。
- **筛选条改成 shadcn 官方写法**（`CategoryFilter`）：
  - 类别是**可切换的 Button**：选中 = `variant="default"`（实心主色）、未选 = `variant="outline"`。
  - 清除是**独立的 ghost 按钮**（`✕ 清除筛选`，44px 高），不再是一行小字链接。
  - 仍是**服务端渲染 + URL 查询参数**（`?category=a,b`），链接可分享。
- **新增 `src/components/ui/input-group.tsx`**（shadcn 官方 `input-group` 的做法）：
  `InputGroup` / `InputGroupAddon` / `InputGroupInput`——外层画框、内层无边框输入框，
  前 / 后缀位放筛选标记与清除按钮。框高 48px、字号 17px，与 `Input` 一致。
  顺手把列表搜索框里那个手写的圆圈「×」换成 `InputGroup` 后缀位上的 ghost 图标按钮。
- ⚠️ **`Button render={<Link/>}` 的可访问角色是 `button` 不是 `link`**（Base UI 给非 button 元素
  加了 `role="button"`）——写验收脚本时按 `getByRole('button')` 找，别按 `getByRole('link')`。
- ⚠️ **新加的 `InputGroupInput` 必须写 `!outline-none`**（2026-10-30 用户当场指出"输入框里有一个方框"）：
  globals.css 的全局 `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px }`
  **不在 Tailwind 分层里**，普通 `outline-none` 压不住它——
  点进搜索框会在**框里**画出一个紫色方框（因为内层 input 的 outline 落在框内、且紧贴占位文字）。
  焦点提示由外层 `InputGroup` 的 `focus-within:` 环承担；
  同样的坑项目里早就踩过：`SearchSelect` 的 `COMBO_INPUT` 早就写了 `!outline-none`。
  ⚠️ **但描边不能一起删**：用户明说「粗紫描边 + 焦点环」好看——
  那条描边是**全站输入框的焦点样式**（`Input` 靠全局 `:focus-visible` 拿到）。
  正确做法是：**内层 input 去掉描边，把描边画到外层 `InputGroup` 上**
  （`focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-[3px]` +
  `focus-within:ring-[3px] focus-within:ring-ring/50`）——框里不再有方框，焦点效果与 `Input` 一模一样。
- **实测**（Playwright，只读，没写库）：点地图「内蒙古自治区」→ 列表 54 → 1 条、计数「1 / 54 个」、
  搜索框里出现「内蒙古自治区」标记；「返回上一级」与面包屑「中国」都恢复到 54 条；
  点列表一行 → 地图下钻到「中国 / 吉林省 / 延边朝鲜族自治州」但列表仍 54 条；
  类别筛选 54 → 15 → 清除 → 54；清除筛选按钮 110×44px；390 窄屏 `scrollWidth = clientWidth = 390`（不溢出）。

### 8.59 第二十四轮之二：管理端筛选 / 搜索控件全站对齐（2026-10-30）

用户："http://connect.localhost:3000/ 首页，搜索地域和搜索互助团怎么一个有搜索图标一个没有？
提示词也不一样格式文本？管理端站点还有哪些类似这种的，没有对齐统一的？请优化完善"

**审计出的 6 处不对齐**（都在管理端 = 工作台）：

| # | 位置 | 原来 | 现在 |
| --- | --- | --- | --- |
| 1 | 首页「地域」弹层里的搜索框 | **没有放大镜**，提示词「搜索地名…」 | 放大镜 + 「搜索地域…」 |
| 2 | 首页「互助团」弹层里的搜索框 | 有放大镜，提示词「输入关键词搜索…」 | 放大镜 + 「搜索互助团…」 |
| 3 | 首页筛选条「清除筛选」 | 裸文字链接 + 手写 `<button>` | ghost 按钮「✕ 清除筛选」（与 /circles 一致） |
| 4 | 首页筛选条「项目类型」chips | 手写 `<button>`，选中 = 浅紫底 | shadcn `Button`（选中 = 实心紫） |
| 5 | 首页「图片」标签搜索框 | 手写圆角**胶囊** input + 独立「搜索」按钮 + 文字「清除搜索」链接 | 统一搜索框（放大镜在左、✕ 在右），去掉重复的文字链接 |
| 6 | /circles/all 名录搜索框 | `Input` + 手写圆圈「×」 | 统一搜索框（放大镜在左、✕ 在右） |

**统一口径**（已写进 `docs/设计规范.md` §4.4 组件库一节）：

- **页面级搜索框只有一个组件**：`console/SearchField`（**放大镜在左、清空在右**），
  三处共用：互助团列表 / 全部互助团名录 / 首页图片搜索。
- **弹层里的搜索行只有一个组件**：`SearchSelect` 导出的 `ComboSearchRow`（放大镜 + 输入框）。
- **提示词格式统一**：弹层里一律「搜索X…」（搜索地域… / 搜索互助团… / 搜索省份… / 搜索城市… / 搜索区县…）；
  页面级写"能搜什么"（搜团名 / 城市 / 区县 / 类别）。
- **触发框占位统一**「全部X」：全部地域 / 全部互助团 / 全部年份。
- **焦点样式统一**：粗紫描边 + 焦点环（见 8.58 末尾的注意事项）。
- **筛选控件三件套**：类别 chips = shadcn `Button`；清除筛选 = ghost + ✕；字段标签间距 = `mb-1.5`。

**新增文件**：`src/components/console/SearchField.tsx`（统一页面级搜索框）。

⚠️ **`Combobox.Trigger` 的可访问角色是 `combobox` 不是 `button`**（Base UI 设的）——
写验收脚本要用 `getByRole('combobox', { name: '地域' })`，用 `button` 找不到。

### 8.60 第二十四轮之三：首页进度勾与资金卡配色（2026-10-30）

用户："http://connect.localhost:3000/ 首页，申请审核反馈报销的打勾补贴颜色太深，
换成网站主题同深浅的紫色。资金页的图标冗余，且颜色撞色"

- **流程进度的勾（申请 / 审核 / 反馈 / 报销）**：
  原来走过的圆点是 `bg-gradient-to-br from-accent to-rose` + 白勾 + 粉色投影——深紫→粉的渐变，
  又花又撞色。现在改成**主题深紫做底 + 白勾**（`bg-accent` + `text-inverse-fg`，不加阴影），
  走过的连线从 `from-accent to-rose` 渐变改成 `bg-accent/45`；当前步（白底紫边 + 淡紫光环）与
  未到的空心圆不动。
  ⚠️ 中间试过"淡紫底 + 紫勾"（`bg-accent-soft` / `text-accent`），用户嫌**太浅**、看不出已完成，
  又调回深紫底——**这才是定稿**。
  活动详情页的环节条 `ActivityProgress` 本来就是软色（完成=绿 / 进行=紫），不用改。
- **资金关键数字卡**：**去掉四个装饰性图标**（钱包 / 小猪储蓄罐 / 趋势箭头 / 人）——
  钱包=预算、小猪=报销，图标只是把标题又说了一遍；四种颜色（紫 / 木兰粉 / 绿 / 红）跟品牌紫撞色。
  现在卡片白底（`bg-card`），只留「标签 + 数字 + 说明」，数字用品牌紫 `text-accent`，
  **只有"超出预算"用 `text-danger`**。`Kpi` 组件的 `icon` / `KPI_TONE` 一并删掉，
  `lucide-react` 里那几个图标不再 import。

### 8.61 第二十四轮之四：修 /circles 页 1024–1280px 列表被裁（2026-10-30）

用户："/circles 页在 1024–1280px 宽度下，整页是固定高度 + overflow-hidden，
而右侧列表只有 ≥1280px 才自己滚动——这个宽度段里列表下半部分会被裁掉、点不到。要一并修。"

**病根**：**锁高度的断点比布局成立的断点早了**。

- 外层容器 `lg:h-[calc(100dvh-…)] lg:overflow-hidden`（1024px 起就锁死高度）；
- 但两栏（地图 + 可滚动侧栏）要 `xl:`（1280px）才成立，
  列表自己的滚动也挂在 `ul` 的 `xl:overflow-y-auto` 上，`<xl` 是 `overflow-visible`。

→ 于是在 **1024–1280px**：页面不能滚（`scrollHeight - clientHeight = 1`）、
列表也不滚 → 容器 `overflow-hidden` 把下半截裁掉。
**实测：54 个团里最后一条在视口下方 9998px 处，既点不到也滚不到。**

**修法**（把断点对齐，不新增滚动区）：

| 位置 | 改前 | 改后 |
| --- | --- | --- |
| `network/page.tsx` 外层 | `lg:h-[…] lg:overflow-hidden` | `xl:h-[…] xl:overflow-hidden` |
| `CircleNetwork` 网格 | `h-full` | `xl:h-full`（`<xl` 高度自适应） |
| `CircleNetwork` 侧栏 | `overflow-hidden` | `xl:overflow-hidden`（`<xl` 不裁切） |

→ **1280px 以下页面正常滚**（地图在上、列表在下，和窄屏同理），
1280px 以上仍是两栏 + 列表自己滚。

**实测**（Playwright，多宽度）：

| 宽度 | 页面可滚 | 列表自己滚 | 滚到底后最后一行 |
| --- | --- | --- | --- |
| 390 / 768 / 1024 / 1200 / 1279 | 9085–9385px | —（跟页面走） | **进视野** ✓ |
| 1280 / 1600 | 1px | 8634px（侧栏自己滚） | **进视野** ✓ |

布局改动后回归：1200px 与 1600px 点地图仍能筛出「互助团 1 / 54 个」、
清除地域筛选回到 54 条 ✓。`/circles/all` 用 `lg:` 是安全的（内部 `Card` 自己滚），未改。

⚠️ **两条铁律**：① 锁高度的断点 **≥** 布局成立的断点；② 锁了高度就必须给里面一块滚动区。

### 8.62 第二十四轮之五：首页问候语与其它页面标题左边缘对齐（2026-10-30）

用户："首页用了'夜深了，XX'，还是和互助团页面一样，位置左对齐吧，不要留空右移动。
互助团三个字离电脑屏幕左边也是一样的距离。"

- **病根**：首页给 `PageHeader` 传了 `titleClassName="pl-8"`——给问候语单独加了 **32px 左内缩**。
  h1 的**盒子**左边距本来就和其他页一样（48px），但**文字**因此右移到 80px，
  于是首页标题比「互助团（54）」右移一截，看着像两套版式。
- **修法**：去掉 `titleClassName`；顺带把 `PageHeader` 的 `titleClassName` prop **整个删掉**
  （项目尚未上线，不留只有一个调用点的兼容入口；也符合 §4.4「变体用 variant，禁止外部拼 class」）。
- **实测**（用 Range 量文字真正的起点）：首页「夜深了，数字木兰项目组」与
  /circles「互助团（54）」**都是 48px**，`padding-left` 都是 0 ✓。

### 8.63 第二十四轮之六：全站可点元素改手型指针（2026-10-30）

用户："整站有些地方，本来应该变手的，怎么还是鼠标指针？"

**病根**：**浏览器给 `<button>` 的默认光标就是箭头**（只有 `<a href>` 才默认是手型），
而 Tailwind 的 preflight 不设 cursor。所以：

- `src/components/ui/button.tsx`（shadcn Button）**根本没有 cursor** → 全站按钮都是箭头；
- Base UI 的下拉触发器 / 选项卡（渲染成 `<button>`）同样是箭头；
- 公众站自己写的 `<button>`（轮播箭头、相册翻页、筛选标签、返回顶部、菜单按钮）也是箭头。

**全站审计**（Playwright，扫 `button, [role="button"], summary, [role="tab"], a[href], [role="combobox"]`）：
工作台首页 13 个、互助团 1 个、资源 5 个、设置 2 个；公众站首页 12 个、互助团 4 个——
**全是 `cursor: default`**。而 `<a>` 与带 `onClick` 的 `div` 本来就是手型（对比之下更刺眼）。

**修法**（一处兜底，不逐个加类）：

```css
/* globals.css，放在 @layer base 里 */
@layer base {
  button:not(:disabled):not([data-disabled]),
  [role='button']:not([aria-disabled='true']):not([data-disabled]),
  summary:not([disabled]) { cursor: pointer; }

  button:disabled, button[data-disabled], [role='button'][aria-disabled='true'] { cursor: not-allowed; }
}
```

⚠️ **必须放在 `@layer base` 里**：裸规则（层外）会**压过 Tailwind 的 `cursor-*` 工具类**，
组件想临时用 `cursor-default` 就改不了了（和全局 `:focus-visible` 是同一类坑）。

另外把下拉**选项行**也改成手型（`ui/select.tsx` 的 `SelectItem` 与
`console/SearchSelect.tsx` 的 `COMBO_ITEM`：`cursor-default` → `cursor-pointer`）——
选项本身也是能点的。

**实测**：

| 检查 | 结果 |
| --- | --- |
| 全站 8 个页面扫可点元素 | **0 个**非手型（之前 42 个箭头） |
| 工作台按钮 / 选项卡 / 链接 / summary / 原生 button | 全部 `pointer` ✓ |
| 下拉选项 `role=option` | `pointer` ✓ |
| 禁用按钮（合成验证） | `not-allowed` ✓ |
| `cursor-default` / `cursor-not-allowed` 工具类 | 仍能覆盖 base 规则 ✓（证明分层正确） |

### 8.64 公众站「区域」下拉加搜索（2026-10-30）

用户要求：`http://localhost:3000/outcomes` 的「区域」下拉框增加搜索。

- 新增 `src/components/site/MuseSearchSelect.tsx`（Base UI `Combobox`），
  `src/components/site/ActivityFilters.tsx` 的「区域」改用它；「项目」下拉仍是普通 `Select`（选项少）。
- ⚠️ **站点与工作台各一套可搜索下拉，不混用**：
  站点 `MuseSearchSelect`（magnolia / ink / line、胶囊触发器、`rounded-[1rem]` 弹层），
  工作台 `console/SearchSelect`（accent / fg / rule、`rounded-md` 弹层）。
  两边的 token 与圆角口径不同，站点不引用工作台的样式常量。
- 交互：弹层顶部放大镜 + 输入框（提示词「搜索区域…」），按文字包含匹配；
  **匹配项在前、「全部区域」沉到最后**（重置入口且不抢第一条高亮）；
  `autoHighlight` 让第一条匹配默认高亮，↑↓ 移动、Enter 选中、Esc 关闭；
  一个都没匹配上时列表仍留「全部区域」，并另给一行「没有匹配的区域」。
- 筛选条件照旧写进 URL（`?region=…`），服务端过滤——搜索框只过滤**选项**，不代替数据筛选。
- ⚠️ Base UI 的 `Combobox.Empty` 在「列表非空」时**不渲染内容**，
  所以「永远保留全部区域」时它不会出；空结果提示要自己按关键词算（`onInputValueChange` + `filteredItems`）。
  用 `filteredItems` 自己排列表（`filter` 只能过滤、不能重排）。

**实测**（Playwright，只读）：

| 检查 | 结果 |
| --- | --- |
| 触发框 / 搜索框尺寸 | 256×44 / 206×44（44px 触控达标） |
| 输入「湖南」 | 列表剩 2 个匹配 + 「全部区域」在最后 ✓ |
| 输入「zzz」 | 提示「没有匹配的区域」可见 ✓ |
| 点选 / 键盘 Enter / ↓+Enter | 分别选中首条、第一条、第二条 ✓ |
| 选中后 URL | `/outcomes?region=湖南省 · 张家界市` ✓ |
| 390px 窄屏 | 横向溢出 0；折叠筛选内同样可用 ✓ |
| 页面 JS 报错 | 0 |

### 8.65 通知页分页 + 筛选（2026-10-30）

用户提出：`/notifications` 现在是 `limit: 50` 一把梭，攒多了只能一直往下翻。
按用户确认的口径：**服务端分页 + 已读状态筛选 + 标题关键字筛选**（不加「类型」维度，
避免为筛选给集合加字段）。

- 新增 `src/lib/notification-filter.ts`（口径：`readNotificationFilters` 解析地址、
  `notificationHref` 编地址、`notificationWhere` 拼查询条件）；
  新增 `src/components/console/Pager.tsx`（工作台分页器，shadcn `Button render={<Link/>}`）
  与 `src/components/console/NotificationFilters.tsx`（已读状态 chips + 关键字搜索框）。
- 重写 `src/app/(admin)/(workspace)/notifications/page.tsx`：每页 20 条，
  页码与筛选都写进 URL（`?read=unread&q=报销&page=2`），换条件时页码回第 1 页。
- 三个口径要点：
  1. **服务端分页 + 服务端筛选**：不是前端拉全量再过滤，地址可分享、刷新不丢条件；
  2. **越界页码回落最后一页**（`?page=99` 不给空白页）；
  3. **关键词输入防抖 300ms** 后写地址（边打字边翻页不丢字）。
- 筛选维度只有「已读状态 + 标题关键字」——通知标题本身就说清了内容
  （"提交了…的报销，请核定"），再分类型就得给 `notifications` 加字段。
- ⚠️ **空状态不要再放一个「清除筛选」按钮**：筛选条上已经有一个，
  两个同名按钮会让读屏与自动化脚本撞上（实测踩过：Playwright strict mode 报 2 个同名按钮）。
- 工作台列表页以后都按这个口径来：**数据会一直攒的列表，一律服务端分页 + 条件进 URL**。

**实测**（Playwright，只读，未写演示库）：

| 检查 | 结果 |
| --- | --- |
| 默认列表 | 12 条（演示库 admin 共 12 条），筛选条 chips + 搜索框在位 ✓ |
| 未读 / 已读筛选 | 未读 0 条（该账号已全部读完）、已读 12 条 ✓ |
| 关键字「报销」 | 5 条，**全部命中「报销」**，URL `?q=报销` ✓ |
| 清除筛选 | 回到 `/notifications`、12 条；页面上只剩 1 个「清除筛选」✓ |
| 分页（临时把页长改成 5 验证） | 3 页；范围「第 1–5 / 6–10 / 11–12 条」；当前页 `aria-current` ✓ |
| 越界 `?page=99` | 回落最后一页（第 11–12 条）✓ |
| 带筛选翻页 | 第 2 页链接 `/notifications?read=read&page=2`（条件不丢）✓ |
| 390px 窄屏 | 横向溢出 0 ✓ |
| 页面 JS 报错 | 0 |

### 8.66 通知页与资源页都改成表格 + 翻页（2026-10-30）

用户要求：「把这个通知页和资源页都做成表格形式翻页吧，类似资源页那种表格」。

- **通知页**（`/notifications`）：卡片式列表 → **一张表**（通知 / 时间 / 状态），
  卡片头部是筛选条（全部 / 未读 / 已读 + 标题关键字搜索），底部是分页器。
- **资源页**（`/assets`）：本来就是表格，现在补上**服务端分页**；
  类型分页签（全部 / 文档 / 视频）从"前端过滤当前全量"改成**地址驱动**
  （`?type=doc&page=2`）——表格既然是服务端分页，筛选条件就必须跟着地址走，
  否则分页签只能筛当前这一页。分页签上的三个数字改为服务端各数一次。
- 表格统一用 `ui/table` + `resp-table`（窄屏摊成卡片），与资源页原来的版式一致。
- 两侧页长都是 20 条；分页器 `console/Pager.tsx`（shadcn `Button render={<Link/>}`）。

**本轮修掉的两个真实缺陷**（都是实测撞出来的）：

1. **输入框被服务端回传的值冲掉**：用户在导航落地前打的字，会被
   "从 props 同步输入框"那一步抹平（点完「未读」马上打字 → 字消失 → 筛选不生效）。
   修法：用 `useRef` 记住**最后一次写进地址的关键字**，只在该值与它不同时才同步。
2. **窄屏横向溢出 63px**：筛选条里的搜索框写 `w-full`，在 flex 容器里按内容宽度撑开。
   修法：改 `min-w-0 flex-1 sm:w-64 sm:flex-none`。

**实测**（Playwright，只读，未写演示库）：

| 检查 | 结果 |
| --- | --- |
| 通知页表格 | 表头「通知 / 时间 / 状态」，12 行；状态徽标「已读 / 未读」✓ |
| 未读 / 已读筛选 | 未读 0 条、已读 12 条；URL `?read=unread` ✓ |
| 关键字「报销」 | 5 行，**全部命中「报销」** ✓ |
| **导航未落地时打字** | 字没丢，URL 变成 `?read=unread&q=报销`（条件都保留）✓ |
| 清除筛选 / 搜索框 ✕ | 都回到 `/notifications`、12 行 ✓ |
| 资源页表格 | 表头「标题 / 分类 / 类型 / 文件 / 大小 / 发布时间」，9 行 ✓ |
| 资源页分页签 | 全部 9 / 文档 8 / 视频 1；切页签 → URL 变化、行数跟着变 ✓ |
| 资源页翻页（临时页长 5） | 2 页；范围「第 1–5 / 6–9 条」；第 2 页切类型回第 1 页 ✓ |
| 越界 `?page=99` | 两页都回落最后一页 ✓ |
| 390px 窄屏 | 两页横向溢出均为 0；表格摊成卡片 ✓ |
| `npm run build` | 通过 ✓ |

### 8.67 第二十七轮：页头只留标题 + 全站「帮助」+ 首页大改造（2026-10-30）

**页头只留标题，解释收进「帮助」**

以前每页顶部摆着「标题 + 副标题 + 一段解释」两三行，**页头比内容还高**，翻起来累。
现在：

- 页头 = **标题**（顶边仍钉在 97px）+ 右边一排操作 + 一个 **? 帮助**按钮；
- 这一页的解释（它是干什么的、有哪些口径、谁能看到）全收进 `PageHelp` 弹窗；
- `PageHeader` 的 `note` / `description` **保留但只给老页面兜底**，新页面一律写 `help`。

已覆盖 11 个页面：首页 / 经费 / 通知 / 资源 / 设置 / 个人信息 / 邀请创建 /
地图页 / 互助团名录 / 互助团详情 / 活动详情。

**首页大改造**

原来：左栏（待办 / 筛选 / 活动数据）+ 右栏（活动 / 图片）——左边三张卡、右边一张卡，
视觉重心歪着；筛选在左栏、列表在右栏，中间隔着一屏。

现在：

```
页头：晚上好，××                      [? 帮助]（团长另有「发起活动」）
────────────────────────────────────────────────────
四张数字卡：活动场次 · 参与人次 · 覆盖互助团 · 待办
────────────────────────────────────────────────────
一整张大卡
  ├ 筛选（年份 / 起止月 / 地域 / 互助团 / 项目类型）+ 关键词搜索
  ├ 视图切换：活动 / 图片（走地址 tab=activities / tab=images）
  └ 活动列表 / 图片列表
```

- **数字卡放最上面**：一眼看完规模；
- **筛选与列表融在一起**：筛的就是下面这张表；
- **待办落到具体活动右侧**：不再单独占一张卡——谁有事做，就在那一行挂一个铃铛
  （项目组「待审核 / 报销待核」，团长「待提交 / 待填反馈」）；顶部「待办」数字卡点一下跳到第一件要做的事；
- **视图切换走地址**，不是客户端状态：刷新、分享链接都是同一屏；
- **关键词是全局筛选**：`q=` 对活动与图片两个视图同时生效；「清除搜索」回到不带 `q` 的地址；
- **搜索表单带上当前筛选**：GET 表单只提交表单内字段，靠隐藏域把 `year` 等条件一起带走；
- **页头不留「经费」按钮**（2026-10-30 用户要求）：经费页在工作台导航里，
  首页页头只留「? 帮助」（团长另有「发起活动」）——不要再把这个入口加回来。

**实测**（`scripts/verify-home.mjs`，只读，不写库，12 项全过）：

| 检查 | 结果 |
| --- | --- |
| 搜索框排在视图切换控件之前 | top 472 < 536 ✓ |
| 筛选控件在视图切换区之外 | 切换区内 select 0、搜索框 0 ✓ |
| 搜索写进地址并过滤列表 | `?year=2026&tab=activities&q=共学`，命中 1 行 ✓ |
| 切到图片视图关键词仍在 | `?…&tab=images&q=共学`，搜索框仍在筛选区 ✓ |
| 清除搜索 | 地址里不再有 `q` ✓ |
| 360px 窄屏 | 横向溢出 0px ✓ |
| 控制台错误 | 无 ✓ |

全量验收 `scripts/verify-round.ts`：**123 通过 / 0 失败**；`npm run build` 通过 ✓。

⚠️ **写脚本要注意**：视图切换用的是**分段链接**（`a[href*="tab="]`），**不是 `role="tab"`**——
断言按 `getByRole('tab')` 找会一直等不到（上一轮就是这么卡住的）。

### 8.68 第二十七轮之二：公众站「加入我们」页 + 联系表单（2026-10-30）

- 公众站 `/contact`：左栏三种参与方式（链接机会 / 分享专业 / 一起办活动），右栏联系表单。
- 表单提交走 `POST /api/contact`：给**每个项目组账号**发一条站内通知（标题带姓名、机构、联系方式、留言）。
  - 蜜罐 `website` 被填 → 当成功，不落通知；
  - 姓名 / 联系方式 / 留言任一为空 → 400；超长（>40 / >80 / >80）→ 400；
  - `proxy.ts` 给 `/api/contact` 限流 10 分钟 5 次。
- **文案收回 `src/content/site.ts`**（`site.contact`）：标题、导语、三种参与方式都从这读，
  页面里不写文案字符串（§5.3）。标题里「同行伙伴」四字带 `mark-soft` 底色，
  由 `title` + `titleAccent` 拼出来——**改文案只改 `site.ts` 一个文件**。
- `/contact` 已进 `sitemap.xml`；页头与移动端导航都有「加入我们」入口。
- ⚠️ **这是合作入口，不是注册入口**：页面不许出现「注册 / 申请加入 / 登录」，
  也不许出现内部术语（报销 / 审批 / 经费 / 工作台 / 项目组 / 团长）——§0.1 铁律。

**实测**（只读；接口只测**空表单**的 400 分支，不提交成功表单以免往演示库写通知）：

| 检查 | 结果 |
| --- | --- |
| `/contact` 渲染 | 200，表单在位 ✓ |
| 内部术语扫描 | 报销 / 审批 / 经费 / 工作台 / 项目组 / 团长 —— 一个都没有 ✓ |
| `POST /api/contact` 空表单 | 400 + 「请把姓名、联系方式和留言填完」✓ |
| 首页专项 11 项 | 全过 ✓ |
| 全量验收 123 项 | 全过 ✓ |

### 8.69 第二十八轮：启动脚本会「接管」端口 3000（2026-10-30）

用户反馈「为什么每次都启动不起，很多次了」——查下来的根因**不是代码**，是端口：

- 我这边长期跑着 `npm run dev:watch`（守护实例），占着 3000；
- 用户执行 `npm run dev` 时，Next 16 检测到已有 dev server → 换到 3001 起 →
  报 `Another next dev server is already running.` 然后退出；
- 于是**看起来像"系统起不来"，其实服务一直好好地跑在 3000 上**。

**修法：后启动的接管先启动的**（不再靠"记得说一声"）：

| 零件 | 说明 |
| --- | --- |
| `scripts/dev-common.sh` | 公共逻辑：识别端口占用、判定是不是本项目实例、接管、清死进程留下的锁 |
| `scripts/dev-run.sh` | `npm run dev` 入口：先接管，再起 next dev；**崩了自动拉起**（2026-11-01 合并，见 §8.75） |
| `package.json` | `dev` / `dev:clean` 走 `dev-run.sh` |

细节：

- 端口上是**本项目**的旧实例 → 停掉它，我们接管 3000；
- 端口上是**别的程序** → 才报错，并说清 PID（不说"起不来"这种模糊话）；
- 接管顺序：**先停守护实例**（否则它把旧实例又拉回来）→ 再停旧实例 → 等端口空出来（最多 10 秒）；
- 清掉死进程留下的 `.next/dev/lock`——否则 Next 会认为"还有一个 server 在跑"；
- ⚠️ **不许杀掉自己的祖先进程**（npm → sh → 脚本）：`dev_ancestors` 列出祖先链并排除，
  否则接管脚本会把自己掐死。

**实测**（同一 WSL 内反复起停）：

| 场景 | 结果 |
| --- | --- |
| 守护实例在跑 → `npm run dev` | 停旧守护与旧实例、接管 3000、`Ready in 258ms` ✓ |
| 一次性实例在跑 → `npm run dev` | 同样接管成功 ✓ |
| 接管日志 | 只报旧实例的 PID，不含自己的祖先 ✓ |
| 接管后三个域 | 公众域 / 工作台 / CMS 全部 200 ✓ |

⚠️ **另一个已知打断源**：`npm run build` 与 dev server 同时跑会把 `.next` 冲掉，
dev server 会重启（几十秒不可访问）。**服务运行期间不要跑 build**。

⚠️ **Windows 浏览器打不开 localhost（2026-10-31 遇到）**：WSL 内部的 `localhost` 端口转发
是 Windows 侧的服务，跑久了会失效——症状是 **WSL 里 `curl 127.0.0.1:3000` 正常，
Windows 浏览器「无法访问」**（`Test-NetConnection localhost -Port 3000` 为 False），
而用 WSL 的 IP（`hostname -I` 的第一个地址）能通。
修法：在 Windows 执行 `wsl --shutdown`，再重新启动 dev（转发会在重连时重建；实测恢复 200）。
为此 `scripts/dev-common.sh` 增加 `dev_print_urls`：`npm run dev` 启动时
打印三域地址 + WSL IP 备用地址 + 这条修复提示（运行在 WSL 内，无法自己探测 Windows 侧）。

## 九、明确禁止

- 不得把内部集合（活动方案、反馈、报销、付款、团成员）暴露给未登录用户。
- 不得让客户端写入自己的 `roles`（提权）。
- 不得在未与用户确认前更换技术栈或替换数据库方案。
- 不得修改 `docker-compose.yml` 之外的数据库连接方式而不更新 `README.md` 与 `.env.example`。

> 🔒 **不留兼容路径（2026-10-24 定规）**：系统**尚未上线**，没有"旧版本用户"要照顾。
> 改路由、改域名、改字段、改账号时，**旧的东西直接删掉**：
> - 不做重定向 / 重写 / 兜底跳转（"兼容旧链接"的代码一律删）
> - 不留 `@deprecated` 的兼容导出
> - 不留别名账号（如 `leader@mulan.org` 这类双邮箱）
> - 不留"旧路由还在、新路由也在"的两套实现
> - 发现任何"为旧版本留着"的代码，**直接删掉**，不要问"要不要兼容"
>
> 唯一例外：**数据**（已入库的历史记录）不能丢，用迁移脚本处理；**代码**没有例外。

> 🔒 **验证不许写演示库（2026-10-29 定规）**：跑验收 / 截图脚本时**只读**，
> 不许为了看效果往 `mulan_alumni.db` 里填人名、改状态、换封面再“还原”——
> 用户随时会在同一个库里操作，一写就会覆盖/删除他刚录的数据。
> 需要写才能验的路径，先用只读断言或另建一次性记录，并显式征得用户同意。

> 🔒 **不做用户没要求的改动（2026-10-24 定规）**：只做用户明确要的那一件事。
> 用户说"取消登出按钮"，就**只**取消登出按钮——不要顺手加提示文案、守卫页、
> 中文说明页、额外提示条。默认按**最小改动**执行：
> - 有歧义先问，不要自作主张补齐；
> - 觉得"这样更好"不是动手的理由；
> - 用户说"就用原生的""别搞复杂了"，就照办，不解释、不加料。

### 8.70 第二十九轮：上线审核（安全 · 版本追溯 · 网址术语 · PostgreSQL · 管理端对齐公开站）（2026-10-31）

用户授权做一次完整的「意图梳理—逻辑审计—管理端整改—公开站回归—安全与上线审核」。
改动前整库打包备份在 `~/mulan-backups/pre-audit-20261031.tgz`（可整体回滚）。

**1. 安全（高风险先修）**

| 问题 | 修法 |
| --- | --- |
| 限流取 `X-Forwarded-For` 第一个值，客户端随便填就能绕过 | `lib/rate-limit.ts`：先认 `X-Real-IP`，再取 XFF **最后一跳**（`TRUSTED_PROXY_HOPS`）；Nginx 必须设 `X-Real-IP $remote_addr` |
| 项目组能给任意账号（含审核负责人）发重置链接 → 冒用审核人 | `createPasswordReset` 只能重置团长；项目组账号由运维处理 |
| `payments` / 全局 `activity-settings` 的 REST 写入还开给项目组 | 一律 `opsOnly`（与 §8.50 同口径） |
| 停用账号的旧会话仍能读 REST | 访问控制里停用账号 = 无角色、无团（`isDisabled`）；停用时清空会话；改密码时清空会话 |
| 上传只信浏览器报的类型 → `x.html` 报成 `image/jpeg` 就能同源打开 | `lib/file-sniff.ts`：按文件头认真实类型，白名单外 400，扩展名改成真实类型；解析层 2GB 上限 + 临时文件落盘 |
| 审批 / 核定 / 提交 / 凭链接改密码 并发双击会重复处理（重复发布两条成果） | `lib/lock.ts` 同一对象排队执行，进锁后再查状态（单实例部署有效） |
| 活动申请提交后，审批写入时内容没锁住（主题 / 类别 / 形式根本不在锁定名单） | `ActivityPlans` 钩子：非草稿 / 驳回状态一律锁全部内容字段 |
| 邀请链接地址取请求头 Host（可伪造成钓鱼域名）；PDF 打印用请求 Host 拉字体 | 一律取配置地址（`workspaceSiteUrl()` / `NEXT_PUBLIC_SERVER_URL`）；PDF 页内只放行本站请求，按账号限流 + 最多 3 份并发，项目组不能打印草稿 |
| 跨子域写 `/api`（www 页面带着 Lax cookie 打 connect 的接口） | proxy：带 Origin 的写请求，Origin 必须是本域名，否则 403 |
| Payload 自带的找回密码 / 首个账号注册 / 解锁接口仍可用 | proxy 一律 404（首个后台账号由种子建；确需时 `CMS_ALLOW_FIRST_USER=1`） |
| 公众域能收 Server Action | 公众域带 `Next-Action` 头的 POST 一律 404 |
| 图片优化允许 `https://**`（开放代理） | 只允许本站与 S3 域名 |
| 团长能读未到发布时间的成果；后台账号与业务账号的通知按 id 撞号 | `publicationsRead` 只给管理者；通知按 collection 区分 |
| 接管链接能把已解散的团"复活"；不能审核自己提交的单据 | 都在服务端拦 |
| docker-compose 默认口令、端口对所有网卡开放 | 口令走 `.env`，端口只绑 127.0.0.1，pgAdmin 删除，MinIO 改为可选 profile |

冒烟脚本：`bash scripts/verify-security.sh`（21 项）。

**2. 活动申请版本追溯**（`lib/plan-versions.ts`）

- 每次**提交**申请，把内容整份快照成第 N 版（`activity-plans.versions[]`：版本号 / 提交时间 / 提交人 / 快照 JSON）；
- 每条**审批**记下审的是第几版（`reviews[].version`）；
- 活动详情「二、活动审核」改为「版本与审核记录」：每一版的提交信息、针对它的审核结论、**与上一版的逐项对比**（字段 / 预算明细新增 · 删除 · 金额变化 / 预算合计）；PDF 同一份。
- 项目组审核面板：重新提交的申请顶部提示「这是第 N 版，与上一版相比改了 X 处」，点一下跳到对比表。
- 旧数据（上线前提交的）没有快照：已通过的用当前内容补第 1 版；被驳回过的标「未留档，无法逐项对比」。
- 专项验收：`scripts/verify-versions.ts`（只能对副本库跑）。

**3. 网址术语表**（同一业务概念只用一个英文词；内部真实路径一律不对外，直接访问 404）

| 概念 | 地址里的词 | 原来的不一致 | 内部真实路径 |
| --- | --- | --- | --- |
| 活动 | `/activities`、`/activities/<标识>` | 公开站叫 `/outcomes` | 公开站 `/site-activities` |
| 资源 | `/resources` | 工作台叫 `/assets` | 工作台 `/assets` |
| 互助团 | `/circles`；参数 `circle` | 工作台首页参数叫 `cohort` | 工作台 `/network` |
| 项目（加油木兰 / AI豆计划 / 民宿管家） | 参数 `project` | 工作台叫 `category` | — |
| 活动类别（技能提升类 …） | 参数 `kind` | 公开站叫 `category` | — |
| 资源分类（品牌 VI …） | 参数 `category` | — | — |
| 经费 | `/budget` | — | — |

- **同一场活动，工作台与公开站同一个地址标识**：发布成果时 `publications.slug = activity-plans.slug`（存量已对齐），换个域名就能互相找到。
- 界面用词同步：互助团归属一律叫「项目」，「类别」只指活动类别。
- 工作台域不再提供公开站页面（`/about` `/contact` `/resources/<标识>` → 404）；robots 在工作台 / CMS 域整站 disallow。

**4. SQLite → PostgreSQL**（评估见 `docs/系统设计.md` 第九节）：55 团 × 每月 1 场 ≈ 660 场 / 年，库本身只有几十 MB 级，
SQLite 撑得住**数据量**；换库是因为：项目一直在为 SQLite 打补丁（补反向关系列、非幂等 push、NOT NULL 删不掉、`SQLITE_BUSY`），
原有迁移是 SQLite 方言、**生产 PostgreSQL 根本跑不了**，月底多个团长同时提交与上传是并发写，以及备份 / 运维工具链。
已执行：迁移重生成为 PostgreSQL（`src/migrations/*_initial.ts`）、`scripts/migrate-sqlite-to-postgres.mjs` 搬完全部数据（逐表核对行数）、
删 SQLite 适配器与补列脚本、`restore-demo.ts` 改用连接池。原 SQLite 库备份在 `~/mulan-backups/`。
**原图与视频不进数据库**：一年约 10–35GB 原图 + 6–12GB 视频，放磁盘卷（`media/`，必须挂卷 + `scripts/backup.sh`）或 S3。
⚠️ PDF 内联图片、活动照片打包下载目前读的是本地磁盘：启用 S3 前要先改这两处。

**5. 管理端对齐公开站**：工作台 token 与公开站同一套调色板（fg=ink、bg=page、rule=line、accent=magnolia #6b4ae6）；
按钮与公开站 museButton 同一长相（胶囊 + 同色柔光影 + 悬停轻浮）；搜索框胶囊；下拉 / 弹层 / 对话框圆角与阴影与公开站一致；
空状态（完整版 = 公开站同款柔光面板，紧凑版用在卡片 / 列表 / 弹层里）全站统一，首页 / 互助团列表 / 通知铃铛不再自写灰字。

**6. 简化**：`CategoryToggles` 并入 `CategoryFilter`；状态文案只有 `lib/workflow.ts` 一份（原来 5 份且措辞不一，「活动审核」状态还取错了第一条记录）；
`FORM_LABEL` 只在 `lib/labels.ts`；`PageHeader` 删 `note` / `description`；删页头重复的「回到首页」、多处重复的「邀请创建互助团」；
设置页与邀请页删掉重复帮助内容的说明卡（设置页左栏换成**修改记录**：谁在什么时候改了上限 / 换了审核负责人）。

**7. 上线补充**：`/api/health`（Docker 健康检查）、`Dockerfile` + compose `app` profile、`scripts/backup.sh`（pg_dump + 上传文件，保留 14 天）、
地图数据从 `media/` 移到 `data/`（上传目录挂卷时不会把它盖掉）、sharp 升到 0.35.5（libvips 漏洞）。

**8. 清理**（全部先挪到 `~/mulan-backups/`，可回滚）：孤儿上传文件 740 + 142 个（92.7MB，库里无记录）、
`muse/`、`docs/参考素材`、`docs/交接任务.md`、一次性脚本 `fill-outcome-covers.ts`、指向已不存在路径的 `bootstrap.sh` / `一键同步并运行.cmd`、
散落的 `scripts/.env`、未引用的 `ui/label.tsx`、`tsconfig.verify-tmp.tsbuildinfo`、空目录 `assets/`、SQLite 库文件。SOP 原件归档到 `docs/SOP/`。

**验收**（对副本库 `mulan_verify` 跑，不写演示库）：verify-round 129/131（2 项失败是演示库里邀请链接 `MULAN-8F3K2` 已被撤销，
把它恢复为有效后两项都过）、verify-home 12/12、verify-versions 10/10、verify-security 21/21、`npm run build` 通过。

### 8.71 第三十轮：管理端 UI 与公开站对齐（2026-10-31）

用户："管理端的字号、相似页面的间距对齐、排版布局优化、文案冗余、动效、色彩、相同功能的组件都没有做好以及与公开站一致对齐。"
先用脚本逐页**量**（标题位置、页头到内容的距离、卡片内边距、字号分布），再改；口径写进 `docs/设计规范.md` §4.5.2。

- **对齐公开站**：顶栏 68px 毛玻璃 + 墨色胶囊导航；版心 1680px；页标题改 display 细字重 32px（可 `mark` 荧光笔，首页问候里的名字就是）；
  筛选下拉改胶囊；分页器页码改公开站同款圆形。
- **间距**：10 个页面的标题顶边都在 101px、页头到第一块内容都是 32px（原来 16 / 24 / 32 混着）；内容卡一律 `p-4 sm:p-6`（原来 20 / 24 / 28）。
- **相同功能只留一份**（新 `components/console/kit.tsx`）：`StatCard`（替掉首页 / 经费 / 资金看板三份）、`SectionTitle` + `.section-title`（替掉十几处 600/700 混用的手写标题）、
  `ListToolbar`、`FILTER_TRIGGER`、`FORM_COLUMNS`、`CARD_HOVER`；通知、经费的搜索改用 `UrlSearchField`（删掉两份重复的防抖逻辑）；
  资源页分页签改用 `LinkTabs`（`LinkTabs` 支持数量）；`StatsFilters` 里一直隐藏着的项目按钮组（与 `CategoryFilter` 重复）删掉。
- **字号**：工作台不再写 `text-[…rem]`，统一成 `text-body / text-small / text-label(15px 新 token) / text-title`；
  修掉低于 15px 下限的：日历（0.8rem / text-sm）、封面提示（0.875rem）、活动文档的图注与票据说明（11pt → 11.5pt）。
- **布局 / 文案冗余**：
  - 首页：「覆盖互助团」说明改成「其中 N 个办过活动」（原来与「活动场次」同一句）；团长看不到地域 / 互助团 / 项目筛选与「覆盖互助团」卡（只带一个团，选了没有意义）；
    修掉「清空筛选」永远显示的 bug（默认的今年被当成了筛选）。
  - 经费：表格每页 20 条（原来 54 行一屏到底）；团长视图去掉重复的年度下拉与无意义的搜索、卡里套卡、重复帮助的说明段，分页签改叫「年度预算」。
  - 通知：「全部 / 未读 / 已读」改分页签并带数量，删掉标题旁重复的未读徽标；资源：删掉与「全部 9」重复的「共 9 份」。
  - 个人信息：删掉重复帮助内容的说明卡；设置 / 个人信息 / 邀请三页主卡同宽同位；字段列表最后一行不再画下边线。
  - 互助团详情：标题旁不再挂「运行中」（状态在团信息卡里，项目组在那切换）；预算行补齐分隔点。
- **颜色**：工作台残留的木兰粉（导航悬停、通知角标、资金图表第二系列）换成调色板里的紫 / 靛蓝。
- **动效**：可点卡片统一 `CARD_HOVER`；页面内容进场淡入（`motion-safe`）。
- **窄屏**：360px 下活动详情页横向溢出 26px——进度条里 sr-only 绝对定位逃出了滚动容器的裁剪，给容器加 `relative`。

⚠️ 写验收脚本注意：顶栏现在 68px（`--workspace-header-h`），页标题顶边 101px；首页 / 通知的视图与已读状态都是 `role="tab"`。

**验收**（副本库）：verify-round 131/131、verify-home 12/12、verify-versions 10/10、verify-security 21/21；
360 / 768 / 1024 三档、两种角色共 15 个页面横向溢出 0、无页面报错；`npm run build` 通过。

### 8.72 第三十四轮：通知单条标已读 + 铃铛角标取真实未读（2026-11-01）

用户反馈：「`/notifications` 除了点击通知铃铛上面的全部已读，单独点击列表，没有办法消除合作类消息的未读吗？」

**根因（三处）**

1. **通知列表页根本没有「单条标已读」的交互**——标题只是 `Link` / 纯文本，服务端渲染，没有任何动作调用。
2. **合作类通知没有 `link` 字段**（`/api/contact` 建通知时只写 `title` + `recipient`），
   所以在铃铛弹层里被渲染成不可点的 `<div>`——**点了永远没反应**，只能靠「全部已读」。
3. 铃铛「全部已读」只清**弹层加载的最近 10 条**，不是真的全部；角标数字也取的是这 10 条的未读数，
   未读超过 10 条时角标会少显示，看着像"没有更多未读了"。

**改了什么**

| 位置 | 改动 |
| --- | --- |
| `console/NotificationTable.tsx`（**新**） | 通知表格的客户端组件：点标题即标已读；有链接的**先标已读再跳转**（拦默认行为、等服务端回包后才跳，否则跳转会打断请求——"点了却没变已读"就是这个坑）；无链接的（合作留言）点完停在原地；状态列给一枚显式的「标为已读」按钮 |
| `actions.ts` | `markNotificationsRead` **逐条兜错**（集合 update 权限只放行"还没读"的记录，重复标记会被挡回来，一条失败不能带崩整批）；**新** `markAllNotificationsRead`（服务端按「收件人 = 我 且 未读」全量处理） |
| `console/NotificationBell.tsx` | 无链接的条目渲染成**可点的按钮**（不再是无声的 `<div>`）；「全部已读」走新的全量动作；角标改用服务端给的**真实未读总数**（新增 `unreadCount` prop，`layout.tsx` 传 `count` 的结果） |
| `notifications/page.tsx` | 表格换成 `NotificationTable`；帮助文案改成「点一条标题就算读过了」并说清有/无链接的差别 |
| `ui/tabs.tsx` | 窄屏修溢出（见下） |

⚠️ **共享 Tabs 的窄屏坑**：分页签带计数后（全部 114 / 未读 0 / 已读 114），
`TabsList` 会把整条筛选工具栏顶出屏幕（实测 320px 溢出 9px）。
修法：`Tabs` 加 `min-w-0 max-w-full`、`TabsList`（default 变体）允许横向滚动（隐藏滚动条）、
`TabsTrigger` 加 `shrink-0`；**选中线伪元素收归 line 变体**——default 变体靠底色选中，
多留一条透明的下划线只会在横向滚动时撑出纵向滚动条。

**顺带修掉的既有构建错误**：`src/app/(site)/about/page.tsx` 引用 `sop.hero.version`，
但 `src/content/sop.ts` 里没有这个字段 → `tsc` 报 TS2339、**`npm run build` 直接挂**。
已把版本行补回 `sop.ts`（文案仍在内容源里，符合"文案唯一来源"）。

> ⚠️ **后续（2026-11-02 第三十四轮）**：关于页按 `docs/SOP/about&contactpages.docx` 重做后，
> `src/content/sop.ts` **已无人引用，连同该文件一并删除**。
> 关于页与联系我们页的文案现在都在 `src/content/site.ts`（`site.about` / `site.contact`）。

**实测**（Playwright，演示库，测试数据已清理复原）

| 检查 | 结果 |
| --- | --- |
| 通知页点合作类标题（无 link） | 未读 → 已读，**URL 不跳转** ✓ |
| 通知页点有 link 的标题 | 未读 → 已读，**并跳到活动页**；「未读」筛选里不再有它 ✓ |
| 通知页「标为已读」按钮 | 未读行数 12 → 11 ✓ |
| 铃铛弹层内点合作类条目 | 未读 → 已读 ✓ |
| 铃铛「全部已读」（12 条未读，弹层只有 10 条） | 角标清零；通知页「未读」分页签 → **未读 0** ✓ |
| 铃铛角标数字 | 显示**真实总数**（12 条），不是弹层那 10 条 ✓ |
| 320 / 375 / 390 / 768px | 通知页横向溢出 0 ✓ |
| 用到 Tabs 的五页 × 四档窄屏 | `/` `/notifications` `/resources` `/budget` `/circles` 全部无溢出 ✓ |
| `npx tsc --noEmit` / `npm run build` | 均通过 ✓ |

### 8.73 第三十五轮：通知列序 / 团进度四段 / 圈数口径 / 团资料统一编辑（2026-11-01）

用户四条反馈，逐条落地：

| # | 反馈 | 改法 |
| --- | --- | --- |
| 1 | 通知页表格改成【状态、时间、通知】 | `NotificationTable` 换列序：状态最左（`w-[7.5rem]`）、时间次之（`w-[9rem]`）、通知在最后并 `w-full` 吃掉剩余宽度；状态与时间列**靠左**（原来是靠右） |
| 2 | 团详情页活动进度改成【申请、审核、反馈、报销】 | 原来「方案 / 反馈 / 报销」三个 pill + 一个「已实施」状态徽标（两套东西）→ 统一成**四段进度**：位置说哪一环，颜色说走到哪一环（绿完成 / 紫进行中 / 灰未到 / 红驳回）。`auditTone()` 按 `plan.status` 判审核环节 |
| 3 | 互助团解散后 `/circles` 页面数量也要改 | 分布页**只统计运行中的团**：标题数量、地图、列表三处都只算 `status === 'active'`。已解散的团去 `/circles/all` 名录页查（列全部、带「解散」标记）。与公众站同一口径（现状数字只算运行中的团） |
| 4 | 互助团编辑统一：主页图、地域、骨干成员都能改 | 合成**一个「编辑资料」弹窗**（页头操作区），服务端动作 `updateCohortProfile` 一次提交一起存。地域口径与建团一致（省必填，市/区县可空）；换图可选（不选文件不动原图） |

**第 4 项的两个关键细节**

- ⚠️ **改地域必须同步写 `cohorts.region`**：`region` 是 `location` 的**冗余文本快照**
  （公开站在 `regionShort` 缺失时回落到它）。只改 `location` 会两处数据打架——
  地图在一个省、名录写着另一个省。用 `formatPlace(province, city, district)` 生成。
- **写入口只留一个**：旧的 `updateCohortCover` / `updateCohortTeam` 两个动作已删；
  `CohortCoverForm` / `CohortTeamForm` 相应改为**只读展示**组件（去掉各自的编辑态）。

**实测**（Playwright，演示库，测试数据已清理复原）

| 检查 | 结果 |
| --- | --- |
| 通知页表头顺序 | 状态 \| 时间 \| 通知 ✓ |
| 团详情页进度词 | 申请 / 审核 / 反馈 / 报销；旧词「方案」「已实施」已不出现 ✓ |
| `/circles` 解散一个团 | 标题 54 → 53，列表行数 54 → 53 ✓ |
| `/circles/all` 名录页 | 仍是 54，且能查到已解散的团 ✓（改回运行中后 /circles 恢复 54） |
| 「编辑资料」弹窗 | 主页大图 / 所在地域 / 骨干成员（四个角色）齐备，地域三级下拉 ✓ |
| 改地域保存（项目组 + 团长两个视角） | 贵州省·铜仁市·万山区 → 广东省；`location` 与 `region` 都同步 ✓ |
| 窄屏 320 / 375 / 390 / 768px | `/notifications` `/circles` `/circles/<slug>` `/circles/all` + 编辑弹窗全部无溢出 ✓ |
| `npx tsc --noEmit` / `npm run build` | 均通过 ✓ |

### 8.74 第三十六轮：活动详情页文档重排 + 经费表重设计 + 费用类别下沉 + 两种打印（2026-11-01）

用户七条反馈，逐条落地：

| # | 反馈 | 改法 |
| --- | --- | --- |
| 1 | 文档标题改成四行 | ① 数字木兰校友会互助团 ② 活动主题 ③ 活动立项与结项记录 ④ 活动编号：<随机串>（页面与 PDF 同一套组件） |
| 2 | 章节标题去掉【已实施】等状态与横线 | `DocSection` 去掉 `status` 参数；PDF 的 `.section-head` 去掉 `border-bottom` |
| 3 | 重新设计经费表 | 见下 |
| 4 | 费用类别与明细项移到项目组设置 | 见下 |
| 5 | 表尾落款改互助团名 + 打印时间 | PDF `.signature` 改为「{互助团名称}」+「打印时间：…」 |
| 6 | 反馈表加【反馈时间】行 | 在「活动感受」之下，只读展示 `report.submittedAt`；表单里是只读的（时间是系统记的） |
| 7 | 打印分两种 | 见下 |

**第 3 项：经费表重设计**

| 《经费预算明细表》 | 《经费支出明细表》 |
| --- | --- |
| 序号 · 费用类别 · **费用项目** · **数量与规格** · 金额 · 占比 | 序号 · 费用类别 · **费用项目** · **数量与规格** · 金额 · **预算金额** · 凭证 |

- **合并「明细项」+「事项说明」→「费用项目」**（原来两列说同一件事，填两遍）。
  分工：「费用项目」写是什么，「数量与规格」写多少。
- **删「备注」列**（没人写）。
- **支出表加「预算金额」只读参考列**（按项目名去预算明细里找同一项，看得出超没超预算）。
- **费用项目可手写**（新增 `ItemSuggestInput`：Input + 原生 `datalist` 建议）：
  下拉只能二选一，但清单总有覆盖不到的开支。
- 页面版（`ActivityTables.tsx`）与 PDF 版（`pdf/ActivityHtml.tsx`）同步改。

**第 4 项：费用类别下沉到项目组设置**

- 13 个一级类别 + 上百条二级明细原来写死在 `lib/budget.ts`；现在存在
  `activity-settings.expenseCategories`（新增字段 + 迁移
  `20261101_035530_expense_categories_setting`），项目组在「设置」页用
  `ExpenseCategoryEditor` 维护。`lib/budget.ts` 保留内置清单作**兜底**（设置没初始化时）。
- `getActivityRules` 带出 `expenseCategories` → `PlanEditor` / `ReportForm` 通过 props 拿。
- ⚠️ **历史数据不受影响**：存的是**名称快照**不是索引。服务端校验也认这条：
  不在当前清单、但**这条记录里本来就有**的明细项 → 允许保留
  （`expenseItemsAllowed(categories, items, legacyItems)` + `legacyBudgetItems()`）。

**第 7 项：打印分两种**

- 顶栏「打印」→ Popover 菜单两种（两个按钮并排会把顶栏塞满）：
  - **完整记录**（默认）：含版本变更全过程
  - **报销存档版**（`?mode=final`）：只留最后一版申请 + 最后一次活动审核通过 + 反馈 +
    最后一次报销核定通过；版本过程不打印。**纸质报销归档用这一份。**
- 实现：`buildActivityPdfData(plan, report, reimbursement, mode)` + `ActivityHtml` 按 mode 换章节。

**顺手修掉的既有 bug**

- ⚠️ **`fmt()` 遇到 Date 对象原样 `String()`** → 输出 `2026-10-31T16:15:42.038Z` 这种原始 ISO 串。
  **项目组视角的活动文档用的是 PDF 那套组件**（`ProjectTeamActivity` → `ActivityHtml`），
  所以这个 bug 同时影响页面与打印件。修法：`fmt` 先判断是不是日期（Date 对象或 ISO 串），
  是就按中文格式渲染。
- ⚠️ **窄屏表格被压成竖排**：PDF 的 `table.fields/data` 没有最小宽度，
  320px 下表格只有 230px，中文被挤成一列一个字。
  修法在 `globals.css`：`.activity-doc table` 给 `min-width: 620px`，
  `.activity-doc .section/.sub` 给 `overflow-x: auto`。
  **只作用于页面**（`.activity-doc` 类），打印走 PDF 自己那份 CSS，A4 纸面不会出现横向滚动条。
- 验收脚本 CMS 断言等待不够（dev server 重启后首次编译 > 1.5s）→ 改成等登录框真的出现。

**实测**（Playwright，演示库，测试数据已清理复原）

| 检查 | 结果 |
| --- | --- |
| 抬头四行 | 数字木兰校友会互助团 / 活动主题 / 立项 2026年10月31日 23:53:44 / 活动编号：3mw9vpuqqr47mv ✓ |
| 章节标题 | 一、活动申请 \| 二、活动审核 \| 三、活动反馈 \| 四、报销审核（无状态后缀）✓ |
| 预算表表头 | 序号 \| 费用类别 \| 费用项目 \| 数量与规格 \| 金额 \| 占比（无「备注」）✓ |
| 支出表表头 | 序号 \| 费用类别 \| 费用项目 \| 数量与规格 \| 金额 \| 预算金额 \| 凭证 ✓ |
| 反馈时间 | 2026年11月01日 00:15:42（不是 ISO 串）✓ |
| 落款 | 前一行「万山AI豆计划互助团」+「打印时间：2026年11月01日 17:08:16」✓ |
| 两种 PDF | full → 200，activity-xxx.pdf；final → 200，activity-xxx-final.pdf ✓ |
| final 模式数据 | 版本历史 1→0、报销历史 2→0、审核记录 2→1、最终审核/核定结论齐全 ✓ |
| 设置页 | 13 个类别输入框，明细项多行框，首类「活动场地与布置」✓ |
| 费用项目建议 | 选「活动物料与耗材」→ 26 条建议；手写「横幅（手写测试项）」也能填 ✓ |
| 窄屏 320/375/390/768px | 活动详情页、设置页：页面 scrollW === clientW（无溢出）；表格横向滚动不挤竖排 ✓ |
| `npx tsc --noEmit` / `npm run build` / 验收脚本 | 通过 / 通过 / 133 项全绿 ✓ |

### 8.75 第三十七轮：开发服务器合并成单一入口（2026-11-01）

用户：「启动项目，如果报错，请修复。是干净修复，而不是搞什么兼容方案。最近有模型为
`npm run dev` 改过代码，顺着他的思路做下去。」

**上一位接手的人改到一半**：把接管逻辑抽成了 `scripts/dev-common.sh`，
删掉了 `scripts/dev-watch.sh` 与 `npm run dev:watch`（意图是**合并成单一入口**），
但 `dev-run.sh` 还是一次性的（`exec next dev`，崩了不拉起），
文档也还指着已经不存在的 `dev:watch`。本轮顺着这个思路收尾。

**本轮改了什么**

| # | 问题 | 改法 |
| --- | --- | --- |
| 1 | **`npm run dev` 直接报错**：`package.json` 的 `description` 被写成了非法 UTF-8（`会` 的第三字节变成 `?`，末尾还丢了引号）→ `npm` 连 package.json 都解析不了，`EJSONPARSE` | 按字节修回合法 UTF-8（不改别的内容） |
| 2 | `dev-watch.sh` 删了，但 `dev-run.sh` 还是一次性的 —— **崩了不自动拉起**，能力丢了 | `dev-run.sh` 改成守护式：`next dev` 放后台 + `wait`，退出码非 0 就等 3 秒重新接管再拉起；`Ctrl+C` / `kill` 走 trap，不重启 |
| 3 | `dev-run.sh` 现在**自己就是守护实例**，`dev-common.sh` 还在找已经不存在的 `dev-watch.sh` | `dev_watcher_pids` → `dev_supervisor_pids`，认 `dev-run.sh`（+ 兼容机器上可能残留的旧 `dev-watch.sh` 进程） |
| 4 | 判定「另一个守护实例」用 `pgrep -f 'dev-run.sh'` —— **会误认**：命令行里**提到**这个路径的进程（编辑器、grep、别的脚本）都算；`$(...)` 里的子 shell 继承父进程命令行，也算 | `dev_is_supervisor` 逐个读 `/proc/<pid>/cmdline`，要求**可执行文件是 bash/sh + 有一个词正好是脚本路径 + 工作目录是项目根** |
| 5 | `dev_ancestors` 用 `$$` —— 在 `$(...)` 里 `$$` 仍是**父 shell** 的 PID，真正跑着的是子 shell（`BASHPID`），接管逻辑会把自己正在跑的子 shell当成「别的实例」杀掉 | 改用 `${BASHPID:-$$}` |
| 6 | **崩溃重拉时接管失败 = 守护实例直接死掉**：`ss` 报出来的 PID 可能**已经死透**（socket 正在释放），`ps` 读不到命令行 → 被判成「别的程序占着端口」→ 报错退出 → 服务彻底起不来 | ① 新增 `dev_pid_alive`：**先判断进程还活着吗**，死透的直接跳过（它马上就空了）；② 崩溃重拉时接管失败**不直接退出**，最多重试 5 轮 |
| 7 | 文档（AGENTS.md §4 / §7 / §8.33 / §8.69、README）还写着 `npm run dev:watch` | 全部改成 `npm run dev`，§8.69 的零件表同步 |

**新增 `scripts/verify-dev.ts`**：验开发服务器本身的行为（三域可用 / 公众域不开接口 /
热更新生效 / 崩了能自愈 / **崩过之后热更新仍然生效**）。
上一位接手的人写过 `tmp/verify-selfheal.mjs`（临时目录、只测工作台登录态），
本轮改成仓库内脚本并补齐公众域与「崩过之后」这两项。

⚠️ **写这个脚本时踩到的四个坑**（都写进脚本注释了）：

- **`*.localhost` 只有浏览器认**：Node 的 DNS 不解析 `admin.localhost`（只有 `localhost` 在
  `/etc/hosts`），`page.request.get('http://admin.localhost:3000/...')` 直接 ENOTFOUND；
  `page.goto` 走浏览器（RFC 6761）就没问题。测子域必须用 `page.goto`。
- **页脚是 `<main>` 的兄弟节点**（`src/app/(site)/layout.tsx`）：探针改的是页脚文案，
  读 `main` 永远看不到它 —— 得读 `body`。
- **改源码到重编译完成之间有个窗口**，请求可能撞上一次 500（Payload 热更新时会重建
  `collections` 与 import map，见 `payload/dist/index.js` 的 `reload()`）。
  那是开发态的瞬时现象，**不是热更新失败**——所以探针要**轮询**到标记出现，不能只等一次。
- **探针文件的备份不能放在循环里反复覆盖**：会被自己写脏的版本覆盖掉，
  还原时把探针标记一起还原回去了（本次实测踩到，已清理干净）。

**顺手修掉 `scripts/verify-home.mjs` 的两条过期断言**（脚本是 2026-10-31 的，
断言没跟上代码，**与本轮的 dev 改动无关**，但跑起来是红的）：

- **② 查 `main a[href*="tab="]` 找视图切换区** → 现在视图切换是 shadcn/ui 的 Tabs
  （`role="tablist"` / `role="tab"`），不是链接了，查不到 → 断言恒假。
  改成查 `role="tablist"`，再确认筛选控件都在它**外面**。
- **⑦ 把「工作台」当内部术语查** → 「工作台」是**允许**出现在公众站的
  （2026-10-31 用户明确要求的唯一例外，见 §3 的「唯一例外」）：顶栏竖线后就是它。
  改成只查**正文**（`main`）里有没有，而不是整页（含页头导航）。

**已知但不是本轮引入的问题**：热更新窗口内偶发一次 `GET / 500`
（`TypeError: Cannot read properties of undefined (reading 'id')`，发生在 Payload
重建 import map 期间）。**在改动前后都能复现，且用原始的 `exec` 版 `dev-run.sh`
同样复现** —— 是 Payload 开发态 HMR 的竞态，与本轮的脚本改动无关；
下一次请求即恢复（200）。本轮不动它。

**实测**

| 检查 | 结果 |
| --- | --- |
| `npm run dev` | 正常起（`Ready in ~250ms`），端口 3000 接管 ✓ |
| 三域 | 公众域 `/` `/circles` `/resources`、工作台 `/login`、CMS `/admin/login` 全 200 ✓ |
| 公众域 `/api/health` | 404（公众域不开接口，proxy.ts 挡住）✓ |
| 接管 | 起第二个实例 → 停掉旧实例、接管 3000、`Ready in 271ms` ✓ |
| 崩溃自愈 | `kill -9` 掉 `next dev` → 3 秒后自动拉起，页面恢复 200 ✓ |
| 崩溃时残留的 `next-server` | 被重启前的接管清掉，不占端口 ✓ |
| 热更新 | 改页脚文案 → 刷新 → 新文案在 ✓；还原后新文案消失 ✓ |
| `npx tsc --noEmit` | 零报错 ✓ |
| `npm run build` | 通过，全部路由生成 ✓ |
| `scripts/verify-round.ts` | **133 项全绿** ✓ |
| `scripts/verify-security.sh` | **21 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿**（修完两条过期断言后）✓ |
| `scripts/verify-dev.ts` | **5 项全绿**（三域 / 公众域不开接口 / 热更新 / 崩了自愈 / 崩过后热更新仍生效）✓ |

---

### 8.76 第三十八轮：活动文档按公文标准重排（2026-11-02）

> ⚠️ 本轮**覆盖**了 §8.69 第 1 项与 §8.75 的抬头描述：抬头从四行改成**三行**
> （活动主题 / 活动立项与结项记录 / 活动编号），机构名抬头行、副标题行、
> 立项时间行都删了。那两节是**历史轮次记录**，按惯例不改写原文，以本节为准。

用户：「活动详情页文档头部内容…改成第一行居中，还是叫【具体的XX活动主题】第二行居中固定叫做【活动立项与结项记录】第三行右对齐，格式：活动编号：XX。剩余其他信息全部删除。文档落款处，显示打印时间，但是不显示【打印时间：】几个字。」
用户：「PDF文件的页面设置：上下左右间距，字号大小，行间距，字体以及是否加粗，都按照最新中国公文要求来设计。」
用户（追问）：「字体有无必要按公文要求来？就用当前网站使用的字体可以吗？更好吗」→ **按最优决定**

**本轮改了什么**

| # | 项 | 改法 |
| --- | --- | --- |
| 1 | 文档抬头四行 → **三行** | ① 活动主题（居中）② 活动立项与结项记录（居中，固定文案）③ 活动编号（**右对齐**）；删掉机构名抬头行、副标题行（团名/形式/日期）、立项时间行 |
| 2 | 落款打印时间 | 去掉「打印时间：」前缀，只留时间本身 |
| 3 | 页面版 / PDF 版抬头不一致 | 页面版（`LeadActivityView`）与 PDF 版（`ActivityHtml`）改成**同一套抬头** |
| 4 | 页面版 / PDF 版落款不一致 | 页面版原本硬编码机构名，改成与 PDF 一样显示**互助团名称** |
| 5 | 版式按 GB/T 9704-2012 | 页边距 上37/下35/左28/右26mm（版心 156×225mm）、正文三号 16pt、标题二号 22pt、表格四号 14pt、行距固定值 28.9pt |
| 6 | 字体 | **全站统一用 Noto Serif SC**（网站现用），不另引入仿宋/黑体/楷体；层级靠**编号 + 字号 + 真 Bold 字重** |
| 7 | `globals.css` 的 `.activity-doc` | 字号/行距与 `docCss` **同步**（那边带 `!important`，优先级更高，不同步页面版就跟 PDF 不一样） |
| 8 | `docCssScoped()` | 之前把 `@font-face` 整段剥掉 → 页面版落回兜底字体。改为**保留**（相对路径），页面与 PDF 共用同一份字体文件 |

**⚠️ 修掉一个一直存在的隐蔽缺陷：PDF 里的中文一直是 Type3 位图字体**

- **症状**：PDF 里的中文被嵌成 **Type3 位图路径**——文本**不可选、不可搜**，放大发虚。
- **根因不是字体本身**：页面是用 `page.setContent()` 灌进去的，源是 `about:blank`（opaque origin），
  从这里发起的 `@font-face` 请求属于**跨源**，Chromium 按 CORS 规则拦掉，报 `net::ERR_FAILED`，
  **字体静默不生效**（Chromium 不报错，只是悄悄换用兜底字体）。
- **修法**：打印路由里把字体请求拦下来，**带 `Access-Control-Allow-Origin: *`** 回给浏览器，
  字体二进制直接从服务端读，不额外走一遍网络。
- **同时加了一道闸门**：打印前检查字体是否真的 `loaded`，没加载就直接报错——
  字体坏掉要**当场炸**，不能悄悄印出去。
- **踩过的坑**：`document.fonts.check()` **具有欺骗性**——它只验 cmap 有没有这个字符，
  验不出渲染时是否真被采用。曾想用「字宽与兜底字体是否相同」来判，**行不通**：
  仿宋/黑体/楷体/宋体的**汉字都是等宽的**（16pt 下每字都是 21.33px），
  量出来必然一样，把好字体误报成没生效，害我白查一轮。
  **唯一可靠的判据是「PDF 里嵌进去的是不是真字体」**——所以另写了 `scripts/verify-gongwen.py` 直接验 PDF。

**字体为什么不按公文的仿宋/黑体/楷体来**

- 公文的四字体是**可选规格**，层级辨识度靠**真字重**同样能达成；
- 统一用 Noto Serif SC 后，**页面版与 PDF 版字形完全一致**，不必维护两套字；
- Noto 是屏幕优化字体，小字更清楚（受众 27–55 岁）；
- Noto Serif SC 有**真实的 Bold 字重**（regular + bold 两个文件已在仓库里），
  `font-weight: 700` 不会触发合成粗体（合成粗体同样会落 Type3）；
- **仓库零新增字体**（曾评估引入 Fandol 四字体族，25MB，最终放弃并移除）。

**实测**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **8 项全绿**：A4 210×297mm ✓ / 版心宽 156.7mm ✓ / 左白边 27.8mm ✓ / **无 Type3 位图字体**（28 个嵌入字体全是 Type0）✓ / 字号层级 22·16·14pt ✓ / 字体 Noto Serif SC + 真 Bold ✓ / 行距 ✓ / 页码「— N —」✓ |
| 页面版与 PDF 版一致性 | 正文 21.33px(=16pt) / 标题 29.33px(=22pt) / 行距 38.53px(=28.9pt) / 字重 700，**两处完全一致** ✓ |
| `scripts/verify-round.ts` | **133 项全绿** ✓ |
| `scripts/verify-security.sh` | **21 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |

**新增**：`scripts/verify-gongwen.ts`（下载并验收打印出的 PDF）+ `scripts/verify-gongwen.py`（在 PDF 上验公文规范）。
用法：`npx tsx --env-file-if-exists=.env scripts/verify-gongwen.ts`。

**已知取舍**

- **页码用 DejaVu Serif**：Chromium 渲染 header/footer 模板时**不加载页面的 @font-face，也不认自定义系统字体**，
  只有它自带的少数字体能真正嵌入。实测 Noto Serif SC 在页脚里会落成 Type3 位图路径，
  DejaVu Serif 则嵌成 Type0 真字体——取「可复制可搜索」优先。页码只有数字与破折号，观感差异几乎看不出。
  （生产镜像已装 `fonts-dejavu-core`。）
- **页码居中**：GB/T 9704 规定「单页码居右空一字、双页码居左空一字」，
  但 Chromium 的 `footerTemplate` 不支持奇偶页 CSS 伪类，无法区分左右。

### 8.77 第三十八轮之二：表格断行与图片排版（2026-11-02）

> 本节是 §8.76 的**后续**，两节合起来才是「活动材料 PDF 按公文标准重排」的完整结论。

用户（本轮）：「一张图片就占了一页纸，剩下的全留空白」。

**本轮改了什么**

| # | 项 | 改法 |
| --- | --- | --- |
| 1 | 页边距左右 28/26 → **17mm** | 版心 156 → **176mm**。原因：这份材料是「活动立项与结项记录**表**」，表格是主体；四列（标签 + 内容 ×2）按内容算至少要 170.6mm，硬套 156mm 会让「2026年10月31日」断成两行 |
| 2 | 表格 `table-layout: fixed` → **auto** | 写死百分比列宽会把「计划活动时间」这类六字标签挤到 26.5mm，而 `nowrap` 又不让它换行 → 标签自己断成两行。改成 auto 后由浏览器按内容分配 |
| 3 | 移除 `fields` 表的 `colgroup` | auto 布局下 colgroup 变成「建议值」，仍会干扰分配；数据表（预算表/费用表）的 colgroup 保留 |
| 4 | 数据表内边距 8pt → **5pt** | 费用明细表 7 列，8pt 内边距要吃掉约 40mm，「活动场地与布置」这类 7 字标签列只剩 25mm，必然断行 |
| 5 | 中文短标签加 `nowrap` | 费用类别 / 费用项目 / 团名 / 人名 / 审核人——短内容被拆成「活动场地与布」+「置」很难看；长地址与长文本仍按需换行 |
| 6 | 中文断行规则 | `line-break: strict; word-break: normal; overflow-wrap: break-word`——地址按语义边界断，不会把「微工厂」拆成「微工」+「厂」 |
| 7 | 图片自适应排版 | 打印路由里按「版心高贪心装页」逐张算尺寸：能两张挤一页就挤，宽幅图不撑爆页，组内顶部对齐 |
| 8 | 票据自适应 | 票据按「版心宽 × 版心高」双重约束缩放，并**垂直居中**（原来顶部对齐、下方留 128mm） |
| 9 | 图与图注绑定 | `figure` 加 `break-inside: avoid`——原来照片在第 4 页、图注跑到第 5 页 |

**⚠️ 踩坑一：模板字符串里的反引号（同一个坑踩了三次）**

在 `page.evaluate(\`...\`)` 里的注释写 `` `break-inside: avoid` `` 会**提前闭合模板字符串**，
报 `TS1005: ',' expected`。已写成 `scripts/check-template-backticks.mjs` 系统性排查：
只扫**模板字符串内部**的注释里的反引号（普通注释里的反引号完全合法）。

**⚠️ 踩坑二：Python 替换把 `//` 写成了 `#`**

批量改 TS 文件时用了 Python 替换，替换串里手误写成 `# 到处断行`（Python 注释），
在 TS 文件里就是语法错误。改完必须 `npx tsc --noEmit` 兜一遍。

**⚠️ 踩坑三：PyMuPDF 的单元格文本不能用来判断「断行」**

`find_tables()` 抽出的 cell 文本会把**同一行内的字间距**也写成换行
（「横幅一份」→ `「横幅 份」` + `「一」`），据此判断全是假阳性。
真正的换行是**不同 y 坐标**的文字行，必须按几何聚类（`_cell_lines`，y 差 < 6pt 算同一行）。

**新增**：`scripts/verify-pagination.py`（排版质量：总页数 / 单页空白率 / 短内容断行），
已并入 `scripts/verify-gongwen.ts`，一次跑完规范合规 + 排版质量。

**实测（2026-11-02 02:5x）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **8 项全绿**：A4 ✓ / 版心宽 **176.3mm** ✓ / 左白边 **16.9mm** ✓ / **无 Type3**（23 个嵌入字体全 Type0）✓ / 字号 22·16·14pt ✓ / Noto Serif SC + 真 Bold ✓ / 行距 ✓ / 页码「— N —」✓ |
| `scripts/verify-pagination.py` | **4 项全绿**：总页数 **8**（≤10）✓ / 纯文字页空白率 ≤75% ✓ / 含图页空白率 ≤60% ✓ / **短内容无断行** ✓ |
| 表格版式（渲染图核对） | 团名「万山AI豆计划互助团」、日期「2026年10月31日」、费用类别「活动场地与布置」、费用项目「场地租赁费」**均完整成行** ✓ |
| 照片排版 | 3 张照片 → 第 4 页 2 张（各占版心高 29.5%）+ 第 5 页 1 张，无「一图一页」 |
| 票据排版 | 第 7、8 页各 1 张，**垂直居中**，占版心高 55% / 44% |

**已知取舍**

- **第 6 页空白 71%**：该页是「（一）审核记录」章节收尾 + 落款，后接票据另起页——
  这是公文惯例（附件另起页），不是排版 bug。
- **左右边距 17mm 偏离公文的 28/26mm**：已在打印路由的注释里写明理由。
  若项目组要求严格按公文版心，需要把字段表的四列改成「标签上行、内容下行」的竖排结构。

### 8.78 第三十八轮之三：图片与版心同宽（2026-11-02）

用户：「但是上传的图片就小了，是否可以让图片与页面同宽，但是可以根据页面需要，适当调整高度（不是裁剪）？」

**本轮改了什么**

| # | 项 | 改法 |
| --- | --- | --- |
| 1 | 照片尺寸算法重写 | **宽度 = 版心宽（176mm）**，高度 = 宽度 × 原图宽高比，**保持原始比例，不裁剪、不拉伸**；只有算出的高度超过一页能放下的高度才**等比整体缩小** |
| 2 | 照片区标题绑定 | 用 JS 把标题与第一张 `figure` 包进 `.photos-head` 容器（`break-inside: avoid`）——纯 CSS 的 `break-after: avoid` 在「标题 + 满宽大图」组合下**绑不住** |
| 3 | 照片区另起一页 | `.photos-block` 加 `break-before: page`，避免标题被留在正文页尾 |
| 4 | 反馈表整表不分页 | `table.fields { break-inside: avoid }`——只有 `tr` 级规则时，表格跨页会在末尾**孤立一行**（实测第 4 页只剩「反馈时间」一行，空白 97%） |
| 5 | 验收加断言 | `verify-pagination.py` 增加「图片与版心同宽（≥171mm）」——把用户诉求固化成可回归的检查项 |

**⚠️ 踩坑：版心宽不能用容器的实测宽度**

脚本原本量 `.photos` 容器的 `getBoundingClientRect().width` 当版心宽，
但**此刻容器还没被版心约束，它的宽度是被图片撑开的**——实测 289mm（版心只有 176mm）。
照着它算，图片被算成 289mm 宽 × 217mm 高，一张图超过一页高，
于是标题与图被拆到两页，还凭空多出两页几乎全空的页。

**正确做法**：版心宽**用常量**（176mm / 225mm，与 `page.pdf({margin})` 保持一致），
不依赖任何 DOM 实测值。

> 教训：凡是要「按版心约束」的尺寸，都应该从**常量**推导，
> 不要量 DOM——DOM 在你量它的时候可能还没被约束好。

**实测（2026-11-02 03:0x）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **8 项全绿**：版心 176.3mm ✓ / 无 Type3 ✓ / 字号 22·16·14 ✓ / 行距 84.8pt ✓ / 页码 ✓ |
| `scripts/verify-pagination.py` | **6 项全绿**：总页数 **10** ✓ / 纯文字页空白 ≤75% ✓ / 含图页空白 ≤60% ✓ / 短内容无断行 ✓ / **图片与版心同宽 ≥171mm** ✓ |
| 照片实测尺寸 | 3 张照片均 **175.4mm 宽**，高度按原图比例 131.5 / 144.5 / 131.5mm，**无裁剪无拉伸** |
| 页面总页数 | 8 → **10 页**（满宽照片一页一张的必然结果） |

### 8.79 第三十八轮之四：收尾（复跑验收 + 补齐验收记录）（2026-11-02）

上一轮（§8.78）改完图片满宽后，`docs/验收记录.md` 还**停在「第三十八轮之二」**——
本轮把 §8.78 这一节补齐进验收记录（新增「十八、第三十八轮之三」），并**复跑全部验收**确认结论仍成立。

**复跑结果（2026-11-02 03:0x）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **8 项全绿**（版心 176.3mm / 无 Type3 / 字号 22·16·14 / 行距 84.8pt / 页码「— N —」） |
| `scripts/verify-pagination.py` | **6 项全绿**（总页数 10 / 纯文字页空白 ≤75% / 含图页空白 ≤60% / 短内容无断行 / 图片与版心同宽 ≥171mm） |
| `scripts/verify-round.ts` | **133 项全绿** ✓ |
| `scripts/verify-security.sh` | **21 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |
| `npx tsc --noEmit` | ✓ 零报错 |
| `scripts/check-template-backticks.mjs` | ✓ 240 个文件全过 |

**逐页占用（10 页版）**

| 页 | 占用 | 空白 | 图 |
| --- | --- | --- | --- |
| 1 | 199.5mm | 11.3% | 0 |
| 2 | 143.6mm | 36.2% | 0 |
| 3 | 109.8mm | 51.2% | 0 |
| 4 | 114.8mm | 49.0% | 0 |
| 5 | 150.8mm | 33.0% | 1（175.4×131.5mm） |
| 6 | 152.3mm | 32.3% | 1（175.4×144.5mm） |
| 7 | 198.8mm | 11.6% | 1（175.4×131.5mm）+ 经费支出明细表 |
| 8 | 145.7mm | 35.2% | 0 |
| 9 | 176.2mm | 21.7% | 1（票据 175.4×123.8mm，垂直居中） |
| 10 | 107.8mm | 52.1% | 1（票据 175.4×100.0mm，垂直居中） |

**遗留（需项目组拍板，本轮未动）**

- **左右边距 17mm 偏离公文的 28/26mm**：这份材料是「活动立项与结项记录**表**」，
  四列表格（标签 + 内容 ×2）按内容算至少要 170.6mm 版心宽；
  硬套 156mm 会让「计划活动时间」「2026年10月31日」到处断行，反而更不像正式材料。
  **若要严格按公文版心，必须把字段表改成「标签上行、内容下行」的竖排结构**（不是改个边距值就行）。
- 第 4 页空白 49%：反馈表结束后「照片区另起一页」（`break-before: page`），
  满宽照片 131.5mm 放不进第 4 页剩下的 110mm 空白，只能顺延到第 5 页——满宽排版的必然结果。

### 8.80 第三十九轮：上下边距收紧 + 照片「固定分高度为 2 份」（2026-11-02）

用户（本轮）：「页面上下边距也要调小，还有之前说的，至少让一页放下两张图，
图宽屏后，高度太高的话，压缩一些高度。或者说至少两张图在一个页面，固定分高度为 2 份」

**本轮改了什么**

| # | 项 | 改法 |
| --- | --- | --- |
| 1 | 上下白边 | 37/35mm → **15/15mm**，版心高 225 → **267mm**（版心宽仍是 176mm，左右没动） |
| 2 | 照片排版 | **固定分高度为 2 份**：版心高 ÷ 2 = 一个槽位（133.5mm），一页放两张 |
| 3 | 图片缩放规则 | 槽位内**按原比例缩放到最大**（宽上限 176mm、高上限 121.8mm），**不裁剪、不拉伸、不变形** |
| 4 | 票据排版 | 同一条槽位规则：两张开销后正好排满一页；只剩一张时仍**垂直居中**（脚本按张数设 min-height） |
| 5 | 照片区不再另起页 | 去掉 `page-break`：照片是正文的一部分，顺着上一节排；原来强制另起会留大半空白 |
| 6 | 附件页 | `.appendix` 的 `margin-top` 24pt → **0**（附件本来就另起页，顶部再留 24pt 就把第二张票据挤掉了） |
| 7 | figure 间距 | 照片 12pt → 6pt、票据 14pt → 6pt：两个槽位加起来必须 ≤ 版心高，边距大一点就装不下第二张 |
| 8 | 打印尺寸归口 | 槽位规则**只写在打印脚本**（行内样式），**不写进共享 CSS**——否则工作台页面版的照片也被限高（预览容器 948px，限高后图只画 616px 宽，反而比改动前更小） |

**⚠️ 为什么用「等比缩放」而不是「压扁」**

满宽 176mm 的 4:3 照片高 131.5mm，两张连图注要 290mm，装不进 267mm 的版心——
**满宽 + 两张 + 不裁剪 + 不变形，四者不能同时满足**。
「压扁」能凑满宽，但合影里的人物会被压矮、看着像渲染坏了；
等比缩放后照片仍有 147~162mm 宽（版心宽的 84%~92%），仍是宽幅大图，
比压缩前的 80~89mm 缩略图好得多。**取舍写在打印路由的注释里，改法就在同一处。**

**实测（2026-11-02 03:2x）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **9 项全绿**：版心 176.3mm ✓ / 上白边 15.7mm ✓ / 无 Type3 ✓ / 字号 22·16·14 ✓ / 行距 ✓ / 页码 ✓ |
| `scripts/verify-pagination.py` | **9 项全绿**：总页数 **6**（原 10）✓ / 纯文字页空白 ≤75% ✓ / 含图页空白 ≤60% ✓ / 短内容无断行 ✓ / **每页图片 ≤2 张** ✓ / 每张图 ≤ 一个槽位 ✓ / 未顶到上限的图满宽 ✓ / **至少一页放了两张** ✓ |
| 照片落位 | 第 3 页 1 张（161.7×121.2mm，与反馈表同页）、**第 4 页 2 张**（147.4 与 161.7mm 宽） |
| 票据落位 | **第 6 页 2 张**（171.7×121.2mm 与 175.4×100.0mm） |
| 总页数 | **10 → 6 页** |
| `scripts/verify-round.ts` | **133 项全绿** ✓ |
| `scripts/verify-security.sh` | **21 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |

**逐页占用（6 页版）**

| 页 | 占用 | 空白 | 图 |
| --- | --- | --- | --- |
| 1 | 199.5mm | 25.3% | 0 |
| 2 | 261.1mm | 2.2% | 0 |
| 3 | 263.6mm | 1.3% | 1（161.7×121.2mm） |
| 4 | 261.6mm | 2.0% | 2（147.4 / 161.7mm 宽） |
| 5 | 206.5mm | 22.6% | 0 |
| 6 | 256.2mm | 4.1% | 2（票据 171.7×121.2 / 175.4×100.0mm） |

**已知取舍**

- **公文的「每页 22 行」没了**：那是从 225mm 版心 ÷ 28.9pt 行距推出来的，
  版心高放宽到 267mm 后一行距没动，一页变成约 **26 行**。
  行距、字号、字体三项规范验收仍全绿；版心宽也没动。
- **三张照片的宽度不齐**（161.7 / 147.4 / 161.7mm）：
  等比缩放后，谁的原始比例更高，谁就窄一些。这是「不压扁」的必然结果。
- 验收脚本里图片满高是 **121.4mm** 而不是脚本写的 121.8mm：
  图片有 0.6pt 边框画在**外侧**，PyMuPDF 量到的是内容框。
  判「是否顶到高度上限」时必须算掉这 0.42mm，否则每张满高的图都会被误判成「没顶到上限」。

### 8.81 第四十轮：图片满宽 + 等高（宽屏、不裁剪、可压扁）（2026-11-02）

用户（本轮）：「我既要一页A4页面都是两份等高度图片（如果其他有一张图片或者两张都是
低于等高设置的量，则另一张就不用强制设置了，只有两张高度加起来能在一页容纳下来即可），
也要都是宽屏的图片」

追问后的补充：**「不管你怎么办，不可以裁减不见一部分，可以压缩高度变形」**；
分页上**「只有在文字后面能放一张图也是可以的」**。

**本轮改了什么**

| # | 项 | 改法 |
| --- | --- | --- |
| 1 | 图片宽度 | **满宽 176mm**（上一轮是 147~162mm 的「按比例缩到槽位里」）——用户要「都是宽屏的图片」 |
| 2 | 图片高度 | **同一份材料里所有图用同一个高度** → 同一页上的两张必然等高 |
| 3 | 裁剪 | **不裁剪**：`object-fit: fill`，整张铺满设定框，一点内容不少 |
| 4 | 变形 | **只压扁、不拉长**：统一高度 = min(槽位上限 118mm, 该份材料里最矮那张图的自然高)。宽幅图（16:9）满宽时本来就矮，它当基准，别的图压到和它一样高，**谁都不会被拉长** |
| 5 | 例外 | 该份材料里**所有**图的自然高都低于 118mm 时，**不强求等高**：各图保持自然高度，只要两张加起来装得进一页（用户原话） |
| 6 | 票据 | 与照片**共用同一条规则**（票据是财务凭证，拉长会让金额看着失真，「只压扁不拉长」对它尤其重要） |
| 7 | 分页 | 照片区**不强制另起页**——「文字后面放一张图」是允许的（上轮已去掉 `page-break`，本轮保持） |
| 8 | 验收脚本 | `verify-pagination.py` 的图片判定升级为**新规则**：每张图都满宽 + 同页两张等高（原先是「没顶到上限的图必须满宽」） |

**⚠️ 为什么可以「压扁变形」**

用户明说「不可以裁减不见一部分，可以压缩高度变形」。
**满宽 + 两张 + 等高 + 不裁剪**四者同时成立，唯一可行的实现就是
**按宽满铺、按高统一压**（`object-fit: fill`）。
上一轮坚持的「等比缩放不压扁」做不到「等高 + 满宽」——那正是本轮换掉它的原因。

**⚠️ 槽位上限 118mm 的来历**

版心高 267mm ÷ 2 = 133.5mm 一个槽位，扣掉图注（8.5mm）与 figure 间距（2.2mm）
= 122.8mm，再留 4.8mm 余量给 Chromium 取整——
差一点点第二张图就会被挤到下一页，「一页两张」前功尽弃。
实测 118 × 2 + 2 × 10.7 = **257.2mm ≤ 267mm** ✓

**⚠️ 只压扁、不拉长的实现**

自然高 = 176mm × (图高 / 图宽)（满宽时的自然高度）。
统一高度取 `min(118mm, 该份材料里最矮那张图的自然高)`：
宽幅图满宽时自然矮，让它当基准，别的图**往下压**到和它一样高——
**没有任何一张图会被拉长**（拉长比压扁更难看）。

**实测（2026-11-02 03:4x）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-gongwen.py` | **9 项全绿**：版心 176.3mm ✓ / 上白边 15.7mm ✓ / 无 Type3 ✓ / 字号 22·16·14 ✓ / 行距 ✓ / 页码 ✓ |
| `scripts/verify-pagination.py` | **10 项全绿**：总页数 **6** ✓ / 空白率 ✓ / 短内容不断行 ✓ / 每页 ≤2 张 ✓ / 每张 ≤118mm ✓ / **每张都满宽 175.4mm** ✓ / **同页两张等高** ✓ / 至少一页两张 ✓ |
| 照片落位 | 第 3 页 1 张（175.4×117.5mm，与反馈表同页）、**第 4 页 2 张**（175.4×117.5mm，**等高**） |
| 票据落位 | **第 6 页 2 张**（175.4×100.0mm，**等高**；宽幅票据满宽自然高 100mm 当基准） |
| 总页数 | **6 页**（与上一轮持平） |
| `scripts/verify-round.ts` | **133 项全绿** ✓ |

**踩坑（本轮真踩了）**

⚠️ **`docCss` 是模板字符串**：在 CSS 注释里写反引号（如 `` `object-fit: fill` ``）
会**截断模板字符串**，整个应用编译失败（报 `Expected a semicolon`，
但真正的原因在注释里，肉眼很难定位）。
在 `docCss` / `page.evaluate` 的模板字符串**内部**写注释，
**一律不要用反引号**，用中文引号或直接不加引号。

**已知取舍**

- **照片被压扁了**：满宽 176mm 的 4:3 照片自然高 132mm，
  压到统一高度 117.5mm（**压扁约 11%**）。这是用户明确授权的
  （「可以压缩高度变形」），换取「满宽 + 等高 + 不裁剪」。
- **票据也被压扁**：宽幅票据（700×400）满宽自然高 100mm 当基准，
  另一张（2382×1684）从 124mm 压到 100mm。
- **公文的「每页 22 行」仍没有**：版心高 267mm ÷ 28.9pt 行距 ≈ 26 行（上一轮已取舍）。

---

### 8.82 第四十一轮：互助团状态改文字、返回导航统一、设置页两栏、首页待办筛选（2026-11-02）

用户（本轮）提了五件事：

1. `/circles/gv9pvhwxjs5k35` 互助团详情页的【状态】从按钮形式改成文字显示，
   设置（改状态的能力）挪到【编辑资料】里；**用不用按钮切换由我按系统风格定**。
2. 【←互助团】挪到页面左边，并想清楚它和 `/activities/3mw9vpuqqr47mv` 活动详情页的
   【←活动】该怎么统一：← 改成「返回XX」？还是用面包屑？
3. `/resources` 编辑资源弹窗里，【选择文件，未选择任何文件】按钮在输入框中不垂直居中。
4. `/settings` 的费用类别改成：左边一级费用类别，点一行右边是明细项；
   **一共只有一个窗口左右两列**，右列随左列选择不同。
5. 首页待审核的要不要排最上面？还是加一个待审核筛选？
   排上面好像打乱了日期。日期该显示活动申请日期还是活动开展日期？

**本轮改了什么**

| # | 问题 | 改法 |
| --- | --- | --- |
| 1 | 状态是个 13.5rem 宽的滑块开关，挤在团信息卡里；而且**团长与项目组看到的两样东西** | 详情页只显示**文字**（运行中 / 已解散）；改状态收进页头的【编辑资料】弹窗，用 `FormSelect` 下拉（表单里的下拉一律用它），**只有项目组能改**，选「解散」先弹二次确认（原来滑块也有），解散时间仍由服务端记 |
| 2 | 两个详情页各写各的返回入口：一个在页头右侧按钮堆里，一个在吸顶条里，且一个是「← 活动」、一个是「← 互助团」 | 新增 `PageBackLink`（箭头 + 「返回XX」），两页共用。**不用面包屑**：工作台只有「列表 → 详情」一层，顶栏四个主导航已经说明了在哪；面包屑是重复信息，还占竖向空间（并会把标题顶下去，破坏 97px 那条线）。文案写清回哪儿，比裸箭头好懂 |
| 3 | 文件框用的是浏览器原生 `<input type="file">`：按钮文案由**系统语言**决定（英文系统上露英文），且按钮贴着输入框上沿、跟边框对不齐 | 换成**隐藏的原生 input + 真按钮 + 已选文件名**（跟照片上传、凭证上传同一套做法）；文件仍走原生 input，FormData 提交不变 |
| 4 | 费用类别一类一卡竖着排，类别一多要上下翻 | 改成**一个窗口左右两栏**：左列一级类别（点哪行右列跟谁），右列是该类的明细项。提交时按「第 N 个类别 ↔ 第 N 组明细项」成对传，服务端契约不变 |
| 5 | 待审核的事夹在按日期排的清单中间，要一屏一屏翻 | **不重排**（重排会打乱日期，这列表本来就是按活动日期排的），改为加一个**「只看待办」筛选**（地址参数 `todo=1`，可分享）。日期列**主值仍是活动开展日期**（跟排序、跟年份月份筛选是同一个口径，不能换），待审核的行下面补一行小字**申请日期**——审批的人真正在意的是「这份申请等多久了」 |

**顺手修掉两个真 bug**（读代码时发现的，与本轮改动无关但挡路）：

- **`/settings` 的两张卡都存不进去**：服务端只有 `updateActivityRules` 一个动作，
  它**一次要齐**预算上限 / 人数下限 / 两个审核负责人 **和** 费用类别；
  而「活动规则」那张卡只提交前四项、「费用类别」那张卡只提交后两项——
  两边都缺对方那一半，各自都被校验挡下。拆成 `updateActivityRules`（规则）
  与 `updateExpenseCategories`（类别）两个动作，各存各的，互不牵连。
- **费用类别提交时数据翻倍**：编辑器的输入框本来就带 `name`，
  提交时又用 state 追加了一遍 → 服务端收到两遍同名类别，直接判「重复了」。
  现在改成只从 state 拼。

**验证（2026-11-02）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-round.ts` | **136 项全绿** ✓（含「状态是运行中 / 解散两态」「切换开关紧跟在状态后面」——它本来就是照这个目标设计写的） |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |
| 本轮自查（11 项） | 状态是文字 ✓ / 返回在左边 ✓ / 编辑资料里有运行状态下拉 ✓ / 文件框是真按钮 ✓ / 费用类别左右两栏且点左边右边跟着换 ✓ / 费用类别真存进去了（改名字→保存→重载还在）✓ / 日期列主值 + 申请日期 ✓ / 只看待办筛出来的每行都带铃铛 ✓ |
| 解散流程 | 选「解散」→ 有后果说明 → 保存 → 弹二次确认 → 取消 → 状态没变 ✓ |
| `npx tsc --noEmit` | 无报错 ✓ |

**已知取舍**

- 费用类别改成左右两栏后，那张卡**占了整行**（不再挤在左边 48rem 的栏里）——
  两列并排要宽度，塞在窄栏里两列都伸不开。
  ⚠️ **第四十四轮已改回左栏**（见 §8.86）：用户要求「宽度跟活动规则一样、放在左侧即可」，
  实测 48rem 栏里两栏并排并不挤。
- 「只看待办」是**在当前筛选结果里再筛一层**（取交集）：待办本身不跟着筛选走
  （筛到 2025 年也该看到今年的待办），这是既有口径，没动。

### 8.83 第四十二轮：关于页 / 联系我们页按 docx 重做 + 演示库还原（2026-11-02）

**起因**：用户给了 `docs/SOP/about&contactpages.docx`，要求公开站的「关于」页与
「加入我们」页**逐字按 docx 重做**，并把导航里的「加入我们」改叫「联系我们」。
文字**不得由模型自行编写或扩写**，版式可以自己设计。

**做了什么**

| 项 | 改法 |
| --- | --- |
| 文案来源 | docx 的每句话抽出来放进 `src/content/site.ts`：`site.about`（关于页）、`site.contact`（联系我们页）、`site.nav.contact`。页面只负责版式，**不写文案字符串**（§5.3 文案唯一来源） |
| 关于页 `/about` | 六段：关于数字木兰校友会 → 三个关键词（聚力同行 / 彼此链接 / 持续成长，各带「木兰帮帮团」「木兰互助团」「数字木兰成长营」）→ 关于互助团 → 木兰姐妹可以收获什么 → 数字木兰项目组的支持 → **互助团落地路径**。页头**只有标题**（不要木兰花图标与「关于」那一行小字） |
| 落地路径 | docx 里那张流程图**逐字复刻成 HTML 流程**（`src/components/site/AboutFlow.tsx`）：六步主链 + 「审核通过」箭头 + 两条回路（审核未通过→调整计划重新申请；根据场次按照时间继续开展）。窄屏自动转竖排 |
| 联系我们页 `/contact` | 页头**一行大标题**「联系我们，成为数字木兰的同行伙伴」（字号与其他公开页开头一致，不要眉标签小字行）+ 三种参与方式（资源赋能 / 导师计划 / 联合行动）+ 联系人聂自强（姓名 + `mailto:` 邮箱，**不显示电话**，2026-11-03 第四十九轮）+ 「留下您信息：」表单。导语段落**不限宽**，与下面的参与方式列表一样宽 |
| 表单字段 | 按 docx：您的姓名* / 联系方式* / 所属机构 / 您的职位 / 您希望如何参与*；提交按钮「提交意向」；底部「提交后，项目将在3个工作日内与您联系。」 |
| 接口 | `/api/contact` 增收 `position` 与 `participation`（旧字段 `message` 仍兼容），通知标题带姓名、机构、职位、联系方式、参与意向 |
| 导航改名 | 顶栏紫色胶囊与窄屏抽屉：`加入我们 → 联系我们`（仍指向 `/contact`） |

**顺带清干净的三件事**

- `src/content/sop.ts` 随旧关于页一起**无人引用，已删文件**（AGENTS.md §八 的历史记录里留了说明）。
- **演示库还原到种子态**：清掉验收遗留的 6 条活动方案（「功能测试」「AI短视频创作第一期第一节课」
  「无」「1」「未命名活动」×2）及其反馈、报销、付款、2 条已发布的公开成果、43 条测试通知，
  以及 48 个测试邀请链接；只留 `MULAN-8F3K2`（active，绑 `new.sister@mulan.org`）。
  演示库现状：55 账号 / 54 团 / 1 套走完全程的活动闭环 / 19 条公开成果 / 1 条通知。
- **修掉两个挡路的既有缺陷**（与本轮改动无关，但会让 build 挂掉、验收脚本崩）：
  `network/[slug]/page.tsx` 缺 `import { Button }`；`actions.ts` 里 `statusPatch.status`
  类型过宽（`string` → `'active' | 'closed'`）。

**验收（2026-11-02）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-round.ts` | **136 项全绿** ✓（清库后复跑仍全绿） |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |
| `npx tsc --noEmit` | 0 报错 ✓ |
| `npm run build` | 通过，`/about`、`/contact` 静态预渲染 ✓ |
| 浏览器实看 | 桌面 1440px + 移动 390px 截图确认；落地路径窄屏转竖排 ✓ |
| `/api/contact` | 空表单 → 400「请把姓名、联系方式和参与意向填完」；正常提交 → 200 ✓ |

**第四十二轮之二（2026-11-02）：两页页头最终定稿 = 与资源页同一个格式**

**页头只有两行，结构与 `/resources` 完全一致**（`PageIntro`）：

| 页 | 第一行：大标题（display 淡色大字，同「资源」） | 第二行：副标题（display 小一号） |
| --- | --- | --- |
| `/about` | `site.about.title` = 关于 | `site.about.subtitle` = 数字木兰校友会 |
| `/contact` | `site.contact.title` = 联系我们 | `site.contact.subtitle` = 成为数字木兰的同行伙伴 |

- **不要**小字手写行（`note` / `eyebrow`）、**不要**木兰花花饰、**不要**粉色荧光笔底色
  —— 用户明确要跟资源页一样；`Eyebrow` 组件保留在设计系统里，但这两页不用。
- 共享组件 `PageIntro` 加了 `subtitle?: string`（标题下的 display 副标题）。
- 联系我们页的导语段落去掉 `max-w-2xl`，宽度与下面的参与方式列表一样宽。
- 验收脚本里关于页的断言改了：`textOf` 把换行压成空格，
  「关于」与「数字木兰校友会」分两行，**不能直接拼成一个串查**，要分开查。

**给下一位的提醒**

- 关于页与联系我们页的文案**只能改 docx 再同步 `site.ts`**，不要在页面上另写。
- 验收脚本那两条「状态是运行中 / 解散两态」「切换开关紧跟在状态后面」已按当前实现更新：
  状态切换收在页头的**「编辑资料」弹窗**里（第三十五轮改的），断言要进弹窗、
  展开下拉看选项，详情页本身只显示状态文字。

### 8.84 第四十三轮：设置类界面「先看后改」（2026-11-02）

**起因**：用户追加两条要求——**费用类别平时要处于非编辑状态，点击「编辑」再操作**；
**`/resources` 资源也是，不要直接处于可编辑状态**。

**问题**：工作台上一批「能改的东西」以前一打开就是能改的：一屏输入框摆着，
看的人分不清哪个是原值、哪个是刚改的，也容易误触保存。
「活动规则」卡（`SettingsForm`）与个人信息卡早就是「查看态 → 点编辑」，费用类别卡当时漏了。

| 位置 | 改前 | 改后 |
| --- | --- | --- |
| `/settings` 费用类别卡 | 一进来就是输入框 + 明细项文本域 | **查看态**：左边一列一级类别（带明细项条数），右边只读列出选中那类的明细项；顶上「编辑」→ 才变输入框，「取消 / 保存」回查看态 |
| `/resources` 资源行 | 行内「编辑」→ 弹一张能改的表单 | 行内**只有两个按钮**：「**查看**」→ 只读详情卡（分类 / 类型 / 文件 / 大小 / 发布时间 / 简介）→ 详情里点「编辑」才换表单；「删除」照旧二次确认。**行内不再单开「编辑」按钮**——一个入口就够（⚠️ **第四十五轮已改**：行内只剩一个「编辑」，查看与删除都在弹窗里，见 §8.89） |
| `/resources` 上传 | 直接进表单 | **不动**：上传是创建动作，本来就没有原值 |

**涉及文件**：`ExpenseCategoryEditor.tsx`（重写为查看态 / 编辑态两段）、
`ResourceDetailDialog.tsx`（新建，只读详情 + 编辑切换）、
`ResourceRowActions.tsx`（「编辑」→「查看」）、
`ResourceBrowser.tsx`（补传 `fileSize` / `fileKind` / `publishedAt`）、
`settings/page.tsx`（去掉重复的 `SectionTitle` 与说明段，标题与「编辑」按钮由组件自管）。

**口径**

- 「编辑 / 取消 / 保存」三个动作占**同一个位置、同一个高度**（44px），用 `InlineEditHeader`。
- 一个卡里**只能有一个标题**：组件自管标题，页面不要再渲染 `SectionTitle`。
- **公开内容（资源）改之前先看清楚**：查看态 → 编辑，是两步。
- 左列右栏（费用类别）在查看态与编辑态**都保持**：左类别、右明细项，只是可不可改。

**验收（2026-11-02）**

| 检查 | 结果 |
| --- | --- |
| `scripts/verify-round.ts` | **136 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |
| `npx tsc --noEmit` | ✓ 零报错 |
| `scripts/check-template-backticks.mjs` | ✓ 241 个文件全过 |
| 本轮自查（22 项） | 费用类别查看态无输入框 ✓ / 左列 13 类 ✓ / 点左边右边跟着换 ✓ / 编辑态出输入框与保存取消 ✓ / 取消回查看态 ✓；资源行内是「查看」✓ / 弹窗只读 ✓ / 弹窗里有「编辑」✓ / 点编辑出表单 ✓ / 文件是真按钮 ✓ |
| 费用类别保存链路（11 项） | 原样保存 → 回查看态 ✓ / 刷新仍是查看态 ✓ / 库内 13 类 129 条不变 ✓ / **修改记录条数没变**（内容没变就不白记一笔）✓ |
| 资源保存链路（7 项） | 查看 → 编辑 → 保存 → 回只读详情 ✓ / 公众站仍列着 ✓ |

**演示数据**：本轮只做**原样保存**（内容不变），服务端比对后 `changes` 为空、不写修改记录；
费用类别仍是 13 类 / 129 条明细项，演示库未被弄脏。

**定稿（用户明确「保留一个即可」）**：资源行内**只有「查看」与「删除」**——
「查看」进只读详情，**改要在详情里点「编辑」**。
行内不再单开一个「编辑」按钮：同一条记录摆两个意思差不多的动作，只会让人犹豫。
`ResourceDetailDialog` 的 `startEditing` 参数随之撤掉（一个入口用不上）。

**已知取舍**：改一份资源要点两步（查看 → 编辑）。换来的是公开内容改前一定先看清原值。

### 8.84 第四十三轮：治「每次 npm run dev 都很慢、起不来」（2026-11-02）

**用户反馈**：「为何每次 npm run dev 都很慢起不来？」——本轮**实测**定位，不猜。

**实测数据**（本机 4 核 8GB，改前）

| 环节 | 耗时 | 说明 |
| --- | --- | --- |
| `npm run dev` → `Ready` | 4.0s | 但 next 自身只用了 **262ms**，其余 3.7s 全花在**接管旧实例** |
| 首屏 `/` | **9.4s** | next.js 编译 5.2s + 应用代码 4.1s（Payload 初始化 + 查库） |
| 之后每个页面首次 | 0.4–1.2s | 每条路由单独编译 |
| 第二次访问 | 50–90ms | 热了就这样 |

**三个根因**

1. **每次接管都删 Turbopack 持久缓存**（`dev-common.sh` 里那句 `rm -rf .next/dev/cache`，181MB）
   → 首屏每次都从头编译。**对照实验**：保留缓存时首屏 4.0s，删了就是 9.4s。
   这条是为治「module factory is not available」加的，但代价是每次都付。
2. **接管时死等固定秒数**（`sleep 1` + `sleep 2`）→ 白等 3 秒，还没有任何输出，
   看起来就像「卡住了起不来」。
3. **Payload 首次初始化约 3 秒**（连 Postgres + 加载 15 个集合）算在**第一个访问的页面**头上。

**改法**

| 项 | 怎么改 |
| --- | --- |
| 缓存清理 | 改成**条件式**：旧实例收到 TERM 后**自己退了**（端口自己空出来）= 干净退出，缓存保留；没退、只能 SIGKILL = 缓存可能是半成品，清。崩掉自动重拉那条路径显式 `DEV_WIPE_CACHE=1` |
| 接管等待 | 固定 `sleep` 改成**轮询**等端口空出来（最多 10 秒，通常几百毫秒就空） |
| 预热 | 新增 `dev_warmup`：next dev 起来后后台打一发 `/api/health`（CMS 域 Host 头，只 `select 1`，无副作用），把 Payload 初始化挪出关键路径 |
| 输出 | 接管与启动都打印进度行，不再有「黑屏几秒」 |

**改后实测**

| 环节 | 改前 | 改后 |
| --- | --- | --- |
| 到 `Ready` | 4.0s | **1.0s** |
| 首屏 `/` | 9.4s | **1.0s** |
| 到能看首页 | ~13.4s | **~2.0s** |

**回归验证（2026-11-02）**

| 检查 | 结果 |
| --- | --- |
| 正常重启（守护实例接管） | 缓存保留，首屏 1.0s ✓ |
| **热更新**（改服务端组件不重启就生效） | 探针改完 2 秒内刷新即见 ✓ ← 保留缓存的最大风险点，已验 |
| **崩溃自动重拉**（SIGKILL next dev） | 状态 137 → 3 秒后自动拉起，**清缓存**，页面 200 ✓ |
| `scripts/verify-round.ts` | **137 项全绿** ✓ |
| `scripts/verify-home.mjs` | **12 项全绿** ✓ |

**给下一位的提醒**

- 别再改回「每次都清缓存」——那是首屏慢一倍的原因。
- 预热请求**必须带 CMS 域 Host 头**：`/api/health` 在公众域是 404（`isPublicApi`），
  带错域就等于没预热。
- 机器只有 4 核 8GB，`NODE_OPTIONS --max-old-space-size=4096` 已经把堆吃满了；
  真要再快，得从「少编译几条路由」入手，而不是动 Next。

### 8.85 第四十三轮之二：修两个「旧实例复活抢端口」的竞态 + 纠正 Next 行为描述（2026-11-02）

**用户反馈**：「还是起不来？」——查下来，**一半是我自己造成的**：
测启动速度时我在后台起了 dev 实例，**每次都把用户终端里那个实例顶掉了**
（用户 15:50 起的，16:00 被我的测试杀掉）。**教训（给下一位）**：
> ⚠️ **不要在会话里用 `setsid nohup npm run dev` 留后台实例**——
> 它会占着 3000，用户自己执行 `npm run dev` 时会被接管；而我们下次测速又会把它杀掉，
> 变成「我起了你又起、谁也用不稳」的拉锯。**测完就把端口腾出来，让用户自己起。**

**两个真竞态（这才是脚本层面「起不来」的来源，已修）**

1. **旧守护实例不死就抢端口**：`dev_takeover` 只给旧的 `dev-run.sh` 发了 TERM 就走。
   而守护实例的崩溃重拉逻辑会在 `next dev` 意外退出时**再起一个 next dev**——
   它要是活下来，就跟我们抢 3000，新实例绑不上端口 = 「起不来」。
   → 补上：等 3 秒还不退就 **SIGKILL 硬杀**（原代码里有这一步，我上一轮改写时漏了，已补回）。
2. **收到停止信号还去接管**：崩溃重拉路径里 `sleep 3` 期间如果收到 TERM
   （用户 Ctrl+C，或被别的实例接管），脚本醒来后**仍然会去接管端口**，
   把刚起来的新实例又杀掉——两边互踩。
   → 补上：`sleep 3` 之后先查 `running`，被要求停就老实退出，不再接管。

**纠正一处过时描述**：AGENTS.md §七 原先写「端口被占 → Next 报
`Another next dev server is already running` 然后退出」。查 `node_modules/next/dist` 核实：
**Next 16.4.3 里没有这个报错了**（Next 15 的老行为）。它只会 warn
`Port 3000 is in use by process X, using available port 3001 instead`，
然后**悄悄跑到 3001**。
→ 所以「起不来 / 改了没反应」的真正来源是：**旧实例还在 3000 上服务，新实例在 3001**，
浏览器开的还是 3000。接管脚本必须留（保证 3000 上永远是最新的那个），
但它要**快、准、绝不互踩**。

**干净启动的完整时间线（实测，用户终端所见）**

| 时刻 | 屏幕上的内容 |
| --- | --- |
| 0.57s | 打印三个域名地址（**不到 1 秒就有输出**，不再黑屏） |
| 0.94s | `✓ Ready in 268ms` ← **服务已可用** |
| 2.9s | （后台）`GET /api/health` ← 预热①：初始化数据库连接 |
| 5.9s | （后台）`GET /` ← 预热②：提前编译首页 |
| 之后 | 打开首页约 0.1s；/circles、/activities 约 0.5s |

**回归**：正常接管、崩溃重拉、反复接管压测（连起两个实例再硬杀一个）后，
进程表始终只有 **1 个守护实例 + 1 个 next dev + 1 个 next-server**，端口 200。

### 8.86 第四十四轮：设置页「费用类别」回到左栏（2026-11-02）

**起因**：用户指出 `/settings` 的「费用类别」不需要占一整个窗口——
**做到「活动规则」那么宽就行，布局放在左侧**。

**做了什么**

| 项 | 改法 |
| --- | --- |
| 页面结构 | `src/app/(admin)/(workspace)/settings/page.tsx`：`费用类别`那张卡从「表格外的通栏卡」改成 `FORM_COLUMNS` 网格里的**第三格**，落在**左栏**（与「活动规则」同一列、同一宽度 48rem），右栏仍是「修改记录」 |
| 组件本身 | `ExpenseCategoryEditor` **不动**：内部仍是主从式两栏（左列一级类别、右列选中那类的明细项），在 48rem 栏里两栏各自约 16rem / 26rem，实测不挤、中文不折行 |

**实测**（Playwright 截图，视口 1680 与 1366）

- 左栏宽度与「活动规则」卡**完全对齐**；`费用类别`卡不再横贯整页。
- 查看态：左列 13 个类别可点选、右列跟着换明细项，条目不截断；
- 编辑态：右列的「一级类别名称」输入框 + 「明细项」多行框都在 48rem 内，不溢出。

**没动的东西**：提交的成对契约（第 N 个类别 ↔ 第 N 组明细项）、服务端校验、
「改了不影响历史记录」的口径，都保持原样。

### 8.86 第四十四轮：关于页排版收紧 + 落地路径照 process.png 重画（2026-11-02）

**用户要求（五条）**

1. 关于页四个章节标题（数字木兰校友会互助团 / 木兰姐妹可以收获什么？/ 数字木兰项目组的支持？/
   互助团落地路径：）改成**和页头副标题「数字木兰校友会」一样大**。
2. 「关于数字木兰校友会互助团」那段正文**放宽到宽屏**（去掉 `max-w-4xl`）。
3. 关于页的「数字木兰校友会」与联系页的「同行伙伴」，都改成**活动页「活动」那种荧光笔标记**
   （`mark-soft`），**字号不动**。
4. 互助团落地路径按 `docs/SOP/process.png` 重画，**特别是下面的返回路径**。

**怎么做的**

| 项 | 改法 |
| --- | --- |
| 标题字号 | 共享组件 `Heading` 加 `size?: 'lg' \| 'md'`；`'md'` 就是副标题那档（桌面 32px / 手机 26px）。关于页四个章节标题传 `size="md"` |
| 副标题荧光笔 | `PageIntro` 加 `subtitleAccent?: string`——副标题里指定的那几个字包 `mark-soft`。关于页传整个「数字木兰校友会」，联系页传「同行伙伴」 |
| 正文宽度 | 去掉 `max-w-4xl`，实测段落宽 1344px = 版心全宽 |
| 落地路径 | **从「HTML 卡片 + 文字说明」改成 SVG 流程图**（`components/site/AboutFlow.tsx`），照 process.png 画 |

**落地路径的画法（SVG，`viewBox` 1144×152，1:1 CSS 像素）**

- 主链六个圆角方框（160×56，圆角 9，白底 + 淡紫描边），框内文字居中（两行或一行）；
- 框之间实心箭头（`marker` 定义箭头）；
- 「申请活动预算」与「按照活动计划」之间那段**留宽（150px）**，
  「审核通过」四个字**压在箭头的中间**（箭头从胶囊底下穿过去）；
- 两条返回路径在**下面**：从来源框底部往下 → 向左 → 再向上，箭头指回目标框底部
  （`M fromX 64 V 104 H toX V 72` + `marker-end`）；
  - 回路一：申请活动预算 → 结合姐妹需求，标签「审核未通过 / 调整计划重新申请」
    **当成一整块**（两行同框）压在横线的中间；
  - 回路二：申请报销 → 按照活动计划，标签「根据场次按照时间继续开展」同样压在线上。

**标签怎么压在箭头上**（2026-11-02 用户又调了一次）：所有标签都是
「紫底胶囊 + 紫字」，**整块盖在箭头/连线中间**——先画线，再画不透明的胶囊，
线就从胶囊底下穿过去，看起来像「箭头被标签断开」。
「审核未通过 / 调整计划重新申请」是**两行装进一个胶囊**（一个圆角矩形，
不是两个独立胶囊），所以看起来是「一个整体」。
- 窄屏横向滚动（`overflow-x-auto` + `min-w-[1144px]`）：缩小了字就小于 15px 了，宁可滚动。
- 文案仍在 `site.about.path`（`steps[].lines` / `approve` / `loops`），组件只负责画。

**回归**：`scripts/verify-round.ts` 137 项全绿、`scripts/verify-home.mjs` 12 项全绿、
`tsc` 0 报错、`npm run build` 通过、浏览器实看（桌面 1440px）两页页头与流程图确认。

### 8.88 第四十四轮之三：流程图铺满宽屏 + 修「选中复制看不见字」（2026-11-02）

**用户反馈**：「可以做页面宽屏吗？而且选择复制的时候，字都变黑了，其他好像正常的反而变白？」

**1）流程图铺满宽屏**
SVG 原来卡了 `max-w-[1280px]`，而上面的卡片是铺满版心的（1584px）——
**卡片铺满、流程图缩在一角**，看着就不像宽屏。
→ 去掉 `max-w`，让 SVG 跟版心一起铺满；`min-w-[1242px]` 保留（窄屏横向滚动，字不低于 15px）。
1920 屏实测：SVG 宽 1584px = 版心宽 ✓。

**2）选中复制时字看不见（真 bug）**

`globals.css` 原来的选中样式是**深底白字**：

```css
::selection { background: var(--color-fg); color: var(--color-bg); }
```

- 深色选中块在一整段文字上太扎眼，字还变白，看着像页面坏了；
- **更要命的是 SVG 里的文字不吃 `color`**（SVG 用 `fill`）——
  落地路径流程图是 SVG，选中框是墨色、字也是墨色 → **墨字压墨块，字直接看不见**
  （这就是「字都变黑了」）。实测截图确认过。

→ 改成品牌紫底 + 墨色字，并给 SVG 补一条 `fill` 规则：

```css
::selection { background: rgba(192, 123, 255, 0.3); color: var(--color-fg); }
svg text::selection { fill: var(--color-fg); }
```

紫底跟 `mark-soft` 同一支色，选中时字始终是墨色（不会变白），SVG 里的字也看得见。

**给下一位的提醒**

- 全站选中态是**紫底墨字**，别改回深底白字。
- **SVG 里的文字用 `fill`，不吃 `color`**——任何深色背景都会让字消失；
  要在 SVG 里做选中态，得单独写 `fill`。

### 8.87 第四十四轮之二：流程图改成站里的视觉语言（2026-11-02）

**用户反馈**：「流程图这个又和整体设计风格不搭，你可按你的思路重新画图也行，只要逻辑对，风格搭。」

第一版是照 `process.png` 的**线框**画的（灰紫细线 + 素白方框），逻辑对但**不像本站的东西**。
这一版**逻辑一字未改**，只换视觉语言——全部用 `globals.css` 的 token：

| 零件 | 之前（线框） | 现在（站里那套） |
| --- | --- | --- |
| 盒子 | 素白方框 + 细灰描边，圆角 9 | **白卡片**：圆角 13、`--color-line` 描边 + `feDropShadow` 柔光影（≈ `shadow-card`） |
| 箭头 | 灰紫 `#8d87ab` 细实线 | **品牌紫** `#6b4ae6`、2px、圆头 |
| 标签文字 | 灰紫裸文字 | **紫色胶囊**：`--color-magnolia-soft` 底 + `--color-magnolia` 字（跟卡片里「木兰帮帮团」那枚 chip 同一套） |
| 返回路径 | 灰紫实线 | **品牌紫虚线**（`stroke-dasharray="7 6"`，圆头圆角） |
| 盒内文字 | 16px | 17px（跟正文同号；下限 15px） |

**逻辑保持不变**：主链六步 →「审核通过」在第 3、4 步之间的箭头左边 →
回路一（申请活动预算 ⇢ 结合姐妹需求，标签「审核未通过 / 调整计划重新申请」在横线**下面**两行）
→ 回路二（申请报销 ⇢ 按照活动计划，标签「根据场次按照时间继续开展」**压在线上**，胶囊垫底把线挡住）。

**给下一位的提醒**

- 流程图的颜色**不要写死**，跟着 `globals.css` 的 token 走：
  `ink` / `muted` / `magnolia` / `magnolia-soft` / `line`。
- SVG 文字要**手动排行**（`dominantBaseline="middle"` + 逐行算 y），
  盒子宽度与字号是配套的：改了字号要同步检查「确定互助小组长」这类最长的一行还放不放得下。
- 窄屏**横向滚动**（`min-w-[1242px]`），不要缩放——缩了字就低于 15px 下限了。
- **宽屏**：SVG **不设 max-width**，跟着版心一起铺满（1920 屏实测 1584px = 版心宽）。
  之前卡了 `max-w-[1280px]`，卡片铺满、流程图却缩在一角，看着就不是宽屏。

### 8.89 第四十五轮：资源行只留一个「编辑」，动作都在弹窗里（2026-11-02）

**用户要求**：「`/resources` 页面，把查看和删除融合为一个按钮【编辑】，把操作动作放到弹窗里。」

**改前**（第四十三轮定的）：行内两个按钮——「查看」进只读详情卡，改要在详情里再点一次「编辑」；
「删除」是另一个按钮。同一条记录上摆着三个意思差不多的入口，看的人要愣一下才敢动手。

**改后**：行内**只有一个「编辑」**，点开是一张弹窗，动作全在里面摆齐：

| 位置 | 内容 |
| --- | --- |
| 弹窗顶部 | **只读摘要**：标题 + 发布时间 + 一句「改完点保存修改，公众站立刻生效」 |
| 弹窗中部 | **表单**（标题 / 分类 / 简介 / 文件 / 外链），各字段**带出原值**；「不选文件 = 保留原附件」 |
| 弹窗底部 | 左：「删除这份资源」（**二次确认**，说清公众站上会下架、撤不回来）；右：「取消 / 保存修改」 |

**涉及文件**

- `ResourceRowActions.tsx`：两个按钮 → 一个「编辑」（`Pencil` 图标），只管开弹窗。
- `ResourceDetailDialog.tsx` → **改名为 `ResourceEditDialog.tsx`**（旧文件已删）：
  不再分「查看态 / 编辑态」两段，直接是**一张编辑弹窗**；删除动作从行内搬进来。
- `ResourceForm.tsx`：加两个底部操作位 `footer`（左，删除）/ `footerRight`（右，取消）；
  没有它们时提交按钮照旧贴左，**上传弹窗的长相不变**。文件提示补上大小。
- `ResourceBrowser.tsx`：操作列宽 10rem → 7rem（只剩一个按钮）。

**口径**

- **同一条记录只留一个入口**：行内只放「编辑」；查看与删除都在弹窗里。
- **删除仍然二次确认**——公众站上立刻下架，撤不回来。
- 「先看后改」的两步在**资源**上不再成立（第四十三轮那条针对设置类界面仍然有效）：
  改成「弹窗顶部一行只读摘要 + 表单带出原值」，**原值照样先摆出来**，只是不用再点一次。

**验收（2026-11-02，Playwright 实点 18 项全绿）**

| 检查 | 结果 |
| --- | --- |
| 行内每行只有 1 个按钮且是「编辑」 | ✓ |
| 行内不再出现「查看」/「删除」 | ✓ |
| 弹窗标题「编辑资源」+ 原值摘要（标题 / 发布时间） | ✓ |
| 弹窗里有标题 / 分类 / 简介 / 文件 / 外链 / 「删除这份资源」/「取消」/「保存修改」 | ✓ |
| 表单带出原标题 | ✓ |
| 点「删除这份资源」→ 二次确认（说清公众站下架、撤不回来），有「再想想」 | ✓ |
| 「再想想」后编辑弹窗仍在 | ✓ |
| 「取消」关掉弹窗 | ✓ |
| 原样保存 → 弹窗收掉、列表内容不变 | ✓ |
| `npx tsc --noEmit` | ✓ 零报错 |
| `scripts/check-template-backticks.mjs` | ✓ 242 个文件全过 |

**演示数据**：本轮只做**原样保存**（内容不变），演示资源的内容没变（只动了 `updatedAt`，
`resources` 集合没开版本记录，不会多出版本行）。删除动作**只验到二次确认那一步，没真删**。

### 8.90 第四十六轮：经费明细合并成一列（预算明细 / 实际支出明细）+「查询可支持项」（2026-11-02）

**用户要求**：「活动详情页的经费处，【费用项目、数量与规格】合并成一列。申请阶段（预算表）叫预算明细，
报销阶段（决算表）：列名就叫【实际支出明细】。经费预算明细表」，右侧一个按钮 `[❓ 查询可支持项]`。
点击弹出抽屉/Dialog，展示支持和的费用明细，从设置处关联过来。」

**当场问清的两条口径**（问卷答复）：
1. 合并后明细列**统一手动填**——「只要是查询支持的，选了大类，明细列按实际的东西或者服务填就行」；
2. **页面与 PDF 一起改**，都叫「预算明细 / 实际支出明细」。

**改了什么**

| 位置 | 改前 | 改后 |
| --- | --- | --- |
| 《经费预算明细表》 | 费用类别 · 费用项目 · 数量与规格 · 金额 · 占比 | 费用类别 · **预算明细** · 金额 · 占比 |
| 《经费支出明细表》 | 费用类别 · 费用项目 · 数量与规格 · 金额 · 预算金额 · 凭证 | 费用类别 · **实际支出明细** · 金额 · 预算金额 · 凭证 |
| 明细列的校验 | 明细项必须在设置清单里（`expenseItemsAllowed`） | **不限制**：明细随便写，服务端只校验**类别**在清单里 |
| 表名右边 | 无 | 「**❓ 查询可支持项**」按钮 → 弹窗「可支持的经费明细」（清单来自设置） |
| 数据结构 | `item` + `description` 两列都要填 | `description` 变成**历史字段**（迁移 `20261102_083513_expense_detail_merged`，可空）；展示时合成一句（`expenseDetailText`） |

**涉及文件**：`collections/ActivityPlans.ts` / `ActivityReports.ts`（字段与标签）、`actions.ts`
（`collectBudgetItems` / `collectExpenseRows` 不再校验明细项，只校验类别）、`lib/budget.ts`（`expenseDetailText`）、
`PlanEditor.tsx` / `ReportForm.tsx`（表格与「查询可支持项」按钮）、`ActivityTables.tsx`（只读表格）、
`pdf/ActivityHtml.tsx`（导出 PDF）、新组件 `SupportedItemsButton.tsx`、`seed.ts`（演示数据新写法）；
删掉 `ItemSuggestInput.tsx`（清单建议改由弹窗承担）。

**踩坑（给下一位接手的人）**

- ⚠️ **提交后内容被钩子锁住，`payload.update` 改不动**：`ActivityPlans` 的 `beforeChange` 在
  `originalDoc.status` 不是 `draft/rejected` 时会**把 `budgetItems` 换回原值**。
  演示活动（第 3 期，状态 `implemented`）就是这样——重播种脚本打印「申请已更新」，
  **库里其实一点没变**。
  → 演示数据对齐新写法只能**直接改子表行**（`activity_plans_budget_items` 的 `item` / `description`），
  或者先让活动回到草稿态再改。**反馈与报销单没有这道锁**，重播种对它们是生效的。
- ⚠️ **「预算金额」参考列是按明细正文精确匹配的**（`expenseDetailText(b) === item`）：
  预算明细与支出明细的写法必须**一模一样**，否则参考列全是「—」。
  重播种只改一半（改了支出、没改预算）时这一列会整列变空——很容易误以为是代码坏了。

**验收（2026-11-02，Playwright 实点 34 项全绿 + tsc + 全量脚本）**

| 检查 | 结果 |
| --- | --- |
| 申请阶段：预算表列名「预算明细」，无「数量与规格」「费用项目」 | ✓ |
| 申请阶段：「查询可支持项」→ 弹窗「可支持的经费明细」列出类别与明细项 | ✓ |
| 申请阶段：明细列能填清单外的字 → 存草稿 → 重载后还在（服务端渲染为真相） | ✓ |
| 申请阶段：提交申请 → 项目组审批通过 → 团长看到反馈（报销阶段） | ✓ |
| 报销阶段：支出表列名「实际支出明细」，同样有「查询可支持项」 | ✓ |
| 只读（项目组视角）：两处表名、列名正确，「预算金额」参考对得上（¥240 / ¥100） | ✓ |
| 导出 PDF：列名与页面一致，无「数量与规格」 | ✓ |
| `npx tsc --noEmit` | ✓ 零报错 |
| `scripts/verify-round.ts` / `verify-home.mjs` / `npm run build` | ✓ 全过 |

**演示数据**：本轮把演示活动（第 3 期）的 3 条预算明细改成新写法（「社区活动中心场地租赁 2 小时」这种
一句话），反馈与报销单的 3 条支出明细本来就是新写法。**验收用的临时活动已删干净**。

**已知取舍**

- 清单（设置里的类别与明细项）现在只**约束类别**；明细项退回成自由文本，
  「口径统一」靠项目组在设置里维护清单 + 「查询可支持项」弹窗提示，不再靠服务端拦。

### 8.91 第四十七轮：管理端桌面导航去图标 + 新标签统一「文字 + 右上角箭头」（2026-11-02）

用户问工作台到处带图标该不该移除；给方案后拍板：**按方案 A**——
桌面导航去图标、语义图标全保留；**新标签页入口一律用公开站顶栏「工作台」那种右上角箭头**
（`ArrowUpRight`）。

**决策三判据**（写在这里，往后新图标按这三条判）：

| 判据 | 保留 | 移除 |
| --- | --- | --- |
| 信息增量：文字说不清或摆不下的 | 状态勾、待办铃铛 | 与文字同义的（资金卡图标，§8.60 删过一次，同理） |
| 控件惯例 | 搜索 / 关闭 / 下拉箭头 / 复制 / 打印等 | — |
| 两站一致性（对齐公开站） | 两站窄屏抽屉的图标（都是一列长行，图标当视觉锚点）✓ | 两站桌面导航：公开站纯文字 → 管理站跟随 |

**改了什么**

| # | 位置 | 改前 | 改后 |
| --- | --- | --- | --- |
| 1 | `WorkspaceNav.tsx` 桌面导航 | 图标 + 文字胶囊 | **纯文字胶囊**（第九轮加图标时还没定「管理端对齐公开站」口径，属留下的不一致）。`NAV_ICONS` 保留，**只给窄屏抽屉**（`WorkspaceMenu`），与公开站抽屉同构 |
| 2 | 顶栏「公开站」/ 抽屉「公开站」 | 纯文字 | 文字 + `ArrowUpRight`（与公开站顶栏「工作台」写法一致：`gap-1.5` + `size-4 shrink-0`；抽屉行内用 `ml-auto` 贴右） |
| 3 | `assets`「公开站资源页 →」、`LeadActivityView` / `ProjectTeamActivity`「在公开站看 →」 | 文字尾缀「→」字符 | 文字 + `ArrowUpRight` 图标 |
| 4 | 团详情「公开主页」按钮 | `ExternalLink` 图标在文字前 | `ArrowUpRight` 在文字后 |
| 5 | 两处「已发布到公开站」状态行前的 `Globe` | 装饰图标 | **删除**（与文字同义，按上方判据一） |

**边界**：表格里的**文本型链接**（资源列表的公开标题、外链「外链」、凭证列的附件名）
虽也是新标签，但它们不是动作入口，加箭头会把窄列排乱——保持纯文本（公开站自己也是这个习惯：
公开站的表格/正文链接不带箭头，只有导航与按钮带）。

**验收（2026-11-02）**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | ✓ 零报错 |
| `scripts/verify-round.ts` | **137 项全绿** ✓ |
| `node scripts/verify-home.mjs` | **12 项全绿** ✓ |

**给下一位的提醒**

- 工作台桌面导航**不要把图标加回来**；想加时先对照公开站桌面导航（纯文字）。
- `NAV_ICONS` 尚有引用方（`WorkspaceMenu` 抽屉），不能删；桌面 `WorkspaceNav` 不再消费它。
- 新增任何 `target="_blank"` 的动作入口：文字 + `<ArrowUpRight size-4 shrink-0>`，别再引入
  `Globe` / `ExternalLink` 之类的前置图标。


### 8.92 第四十八轮：三端全面审计与修复（2026-11-03）

用户要求按国际网站评估标准（WCAG 2.2 AA、OWASP、移动端可用性、一致性、可维护性等）
把公众站 / 工作台 / CMS 三端全面过一遍，修掉逻辑、冗余、死代码、组件不齐、坐标不齐、
鉴权、路径、移动端、布局 / 字号 / 间距 / 颜色问题。先用 4 个只读审计（死代码、UI 一致性、
鉴权、移动端 + 可访问性）出清单，再逐项修。

**⚠️ 本轮最重要的一个发现（回归先看）：tailwind-merge 一直在吃掉自定义字号**

`cn()`（tailwind-merge）不认识 `text-small` / `text-label` / `text-body` / `text-title` 这些
@theme 自定义字号，把它们当成**颜色**；同一个元素上再写 `text-muted` / `text-fg` 时，
就当"颜色冲突"把字号删掉。结果：**表头、徽标、按钮、页标题等几十处的字号一直没生效**
（回落成继承的 17px）。修法在 `src/lib/utils.ts`：`extendTailwindMerge` 登记全部字号 token。
**新增 `--text-*` token 时必须同步加进 `FONT_SIZES`**，否则又会悄悄失效。

**死代码与冗余**
- 删 `components/site/primitives.tsx`（18 个导出只剩 3 个在用，内联进 ResourceMedia）、`ui/separator.tsx`。
- 删死导出：`access/index.ts` 11 个孤儿访问函数（集合写入早已统一 `opsOnly`）、
  `lib/workflow.ts` 的状态流转表（与 actions.ts 手写校验是两套口径）、`formatDateInputCN`、
  `PUBLICATION_TYPE_LABEL`、`labelOf`、`BUDGET_CATEGORIES`、`sum`、`ownScopeWhere`、`hasDefaultBudget`、
  `getOutcomesByCircle`、`TeamLogo`、`FileKindChip`、demo-assets 的 3 个生成器、Badge 的 6 个死变体。
- 7 天有效期常量原有两份（`lib/invitation.ts` 与 actions.ts），改成 actions 引用唯一一份。
- 卸载从未使用的依赖：`cn`、`react-hook-form`、`@hookform/resolvers`（技术栈表已更正）。
- 删死 CSS：`.masonry` / `.grid-4up` / `.print-toolbar` / `.cell-pad` / `.sheet-table` / `text-brand` /
  `bg-mulan-deep` / rose 三个色 token。删 `site.ts` 里无人引用的文案块（projects 文案、home.hero/entries/circles、
  outcomes、circles、library）；`recommendedForPublish` 标为历史字段（只读），种子不再写它。
- CMS 集合 `publications` 标签「精选发布」→「公开成果」（精选发布这一步早已取消）。

**颜色：tsx 里不再有写死色值**（图表 / SVG / PDF 打印 CSS 除外，均已注明）
- 新 token：`ink-strong` / `blush-strong` / `homestay`；阴影 `shadow-chip / button / button-accent /
  button-magnolia / button-danger / nav-active / tab-active / on-photo`。
- 新 utility：`bg-note`（批注卡纸面）、`img-shade` / `img-shade-strong` / `img-shade-side` / `img-shade-soft`（照片暗角）。
- 5 处手写品牌渐变 → `bg-mulan`；`bg-brand` 加 25% 墨色蒙层（最亮端白字从 2.8:1 提到约 4.1:1）。
- 资源卡占位文字对比度 2.5:1 → `text-mountain`。

**字号 / 触控**
- 全站已无 <15px 的字：首页审图号 13px、「主办互助团」14px、日历 12px、地图悬停框 13–14px 全部提到 15px。
- 工作台字号裸值收成 token：`text-page-title` / `text-stat` / `text-brand-name` / `text-auth-title` / `text-hero` / `text-hero-sub`。
- **Button 删掉 `xs`（36px）/ `icon-xs`（36px）两档**——它们是多处"点不到"的源头；
  修了 ReceiptPicker（28px）、PhotoUploader / CohortList / ExpenseCategoryEditor（32px）、
  RegionSelect 面包屑（32px）、更换图片（36px）、通知「标为已读」（36px）。日历格 32 → 40/44px。

**一致性**
- 表格一个口径（在 `ui/table` 里定）：正文 17px、表头 16px / 500；首页去掉各自的覆盖，
  列表区改用 `ListToolbar` + `px-3`，与通知 / 资源页同骨架。
- 新共享件 `NoteCard`（活动摘要与「关于我们」原来各写一份、内边距和倾角都不同）；
  两个公开站详情页 Banner 高度与标题阶梯统一；三种卡片照片区统一 160px（`CARD_MEDIA_H`）。
- 「解散」标记与待办铃铛改用 `StatusBadge` / `Badge`；`CohortDirectory` 与首页窄屏卡改用 `CARD_HOVER`；
  `rounded-[1rem]` / `rounded-[1.25rem]` 收回 `rounded-control` / `rounded-card`。
- `/circles/all` 的「← 互助团」按钮 → `PageBackLink`（与团详情 / 活动详情同一款）。
- 404 页文案收回 `site.notFound`，版式改成与公开站空状态同一款。
- 「跨区域」→「跨地域」（注册页提示，§三 口径）；工作台入口 tooltip 不再写「团长与项目组登录」。

**鉴权安全**
- 活动方案 REST 读取改为 `planRead`：项目组看不到团长未提交的草稿（与页面口径一致）。
- `/api/activity-photos` 加限流（每账号 10 分钟 20 次）+ 并发 2；`/api/notifications/unread-count` 每分钟 30 次。
- 邀请链接：公开接口与注册页 HTML 里的受邀邮箱一律打码（`maskEmail` 移到 `lib/format.ts` 共用）。
- **改登录邮箱要输入当前密码**（防止拿到一次会话就夺走账号）；姓名 / 邮箱长度上限。
- 发起活动「数草稿 → 建草稿」加锁（并发不再超过 3 个草稿上限）；团资料的地域字段校验 6 位 adcode + 长度。
- 地图代理只缓存合法 GeoJSON；PDF 路由的英文 `Not Found` / `Unauthorized` 改中文并声明 UTF-8。

**移动端**
- **Dialog 窄屏（<640px）改成底部面板**（贴底、满宽、上圆角、留 iPhone 安全区），与规范 §3.1.2-6 一致。
- 资金看板表加 `resp-table`（原来是唯一一张窄屏横滚的宽表）；照片墙窄屏 3 列；
  费用类别列表窄屏不再套内部滚动框；Popover 宽度不超出屏幕；DocZoom 大图弹窗宽度冲突修好。
- **工作台窄屏顶栏补上通知入口**（带未读数，原来手机上看不到有没有新通知）。
- 16 处网格补 `grid-cols-[minmax(0,1fr)]`。

**可访问性**
- 两端都加「跳到主要内容」（`components/SkipLink.tsx`，`<main id="main">`）。
- 首页地图（canvas）对读屏隐藏，补一份各省数量的文字清单。
- 互助团列表行：原来是 `role="button"` 里套「查看」链接（嵌套交互），拆成并列的「定位按钮 + 查看链接」。
- DocZoom：文档里的图片可 Tab 聚焦、回车放大。
- 登录表单 / 联系表单：`noValidate` + 中文逐项提示 + `aria-invalid` / `aria-describedby`（不用浏览器英文气泡）。
- 注册页：项目类别 `radiogroup` / `radio`、多控件字段改 `role="group"`、必填星号 `aria-hidden` + 「必填」读屏文字；
  照片 / 凭证说明框补 `aria-label`；视频下方注明「暂无字幕」；回到顶部尊重「减少动态效果」；日历月份中文。

**验证（2026-11-03，只读，未写演示库）**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 零报错 |
| `scripts/verify-round.ts` | 137 / 137 |
| `scripts/verify-home.mjs` | 12 / 12 |
| `scripts/verify-security.sh` | 21 / 21 |
| 本轮专项（Playwright，40 项） | 40 / 40：两端 360px 15 个页面零横向溢出、工作台 8 页无 <40px 可点元素、skip link、地图文字替代、底部面板、表格 / 徽标 / 按钮字号生效、邮箱打码、表单中文校验、无嵌套交互 |

**已知未做（需要另行决定）**
- 视频字幕：站内不收字幕文件，目前只有文字说明；要真正满足 WCAG 1.2.2 需给资源加字幕字段。
- 表单字段级报错只做到登录 / 联系 / 注册（本地校验）；服务端动作返回的是整句文字，
  活动申请 / 反馈表的逐字段 `aria-invalid` 需要把动作改成结构化报错，改动面大，未做。
- ECharts 图表配色仍是与 token 同值的常量（canvas 读不到 CSS 变量），改 token 时两处同改。
- 限流与锁仍是单进程实现（单实例部署有效；多实例需换 Redis / 数据库锁）。

### 8.93 第四十九轮：联系我们页 / 关于页 / 活动排序 / 资源卡片（2026-11-03）

用户连续提了五处改动，都已改完并验证：

1. **`/contact` 联系人只显示邮箱** → 原本页面里渲染了 `contact.person.phone`，但 `site.ts` 里
   **根本没有 `phone` 字段**，页面上其实是个 `tel:undefined` 的死链接。删掉电话与 `Phone` 图标；
   随后用户补充「名字要留，改成聂自强」，所以最终是**姓名（聂自强）+ 邮箱**，
   `site.contact.person.name` 由「自强」改为「聂自强」。
2. **联系表单「所属机构」「您的职位」改必填** → `ContactForm.tsx` 的 `REQUIRED` 列表加上这两个字段
   （补红色 `*`、`required`、`aria-invalid` / `aria-describedby`）；
   `/api/contact` 的服务端校验同步要求这两项，提示语改为「请把姓名、联系方式、所属机构、职位和参与意向填完」。
3. **关于页流程图文字不加粗** → `AboutFlow.tsx` 的 SVG `fontWeight`：主链盒子 600 → 400，
   胶囊标签 500 → 400。
4. **流程图字号改成与同页【激励机制】一样大** → 【激励机制】是 `h3` 的 `1.1875rem`（19px）。
   ⚠️ 光把 `fontSize` 改成 19 不够：SVG 原本带 `w-full`，会随容器宽度整体缩放，
   宽屏下 19px 被放大到 21px 以上，和旁边的卡片对不上。
   改法：`AboutFlow` 改成客户端组件，用 `ResizeObserver` 量容器宽度，
   把多出来的横向空间平均分给各段箭头间距，**1:1 出图**（盒子与文字尺寸不再变）。
   实测 1440 / 1280 / 900 三个视口下 14 个文本节点都是 19px / 400。
5. **活动排序按活动开展日期，不按项目组推送时间** → `getOutcomes()` 默认 `sort: 'eventDate'`；
   首页成果流、`/activities` 列表、活动详情页「相关活动」统一按它排。
   ⚠️ Postgres 的 `DESC` 默认把 NULL 排**最前**，没有活动日期的成果会顶到最前，
   所以 `public-data.ts` 把结果**分两批取**：有 `eventDate` 的按 `-eventDate`，
   没有的按 `-publishedAt` 接在后面。
6. **资源详情页「资源里还有」的卡片与资源页一样大，不要宽屏** → 原因是那行多写了
   `grid-cols-[minmax(0,1fr)]`，把 `auto-fill` 的列定义**覆盖**成单列，
   卡片被拉成 1344px 整行宽。删掉那行即可（列表页本来就是 `auto-fill`）。

**验证**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 零报错 |
| `scripts/verify-round.ts` | 137 / 137 |
| 活动排序实测 | 首页与 `/activities` 的卡片日期均为严格降序（2026-11-06 → 11-02 → …） |
| 资源卡片实测 | 列表页与详情页均为 435 × 315 px，三列（此前详情页是 1344px 单列） |
| 流程图字号实测 | 1440 / 1280 / 900 三视口下 14 个文本节点全部 19px / 400 |

### 8.94 第四十九轮之二：首页地图悬停框「长地名压住团名」（2026-11-03）

首页地图（`components/site/ProvinceChoropleth.tsx`）悬停框里，每行是「地名（左）+ 团名（右）」。
原来的写法是 `display:flex` 硬挤在同一行：地名 `flex:1 1 auto;min-width:0`，团名 `flex:none;white-space:nowrap`。
**地名长到一行放不下时**：它的 flex 盒子被压到几十 px（如「临夏回族自治州积石山保安族东乡族撒拉族自治县」
只有 41px），文字却因为 ECharts 容器的 `white-space:nowrap` 不换行，直接**溢出压到团名上**。

**修法（最终版：团名一律换到地名下一行 + 按行政区分组）**
1. **按行政区分组**：`item.circles` 先用 `Map` 按 `place` 归并——同一个行政区下面有多个团时，
   **地名只显示一遍**，下面逐行列出各团名（不重复地名）。
2. **团名一律换到地名下一行，左对齐**（不再是「放得下就同一行」）：
   结构改成「地名一个 `div` + 团名各自一个 `div`」，`text-align:left`。
3. 地名与团名都显式 `white-space:normal;overflow-wrap:anywhere`——
   ECharts 容器默认带 `white-space:nowrap`，不加这条，长地名会溢出 tooltip 框
   （实测 `scrollWidth` 344 > 320）。

**层次优化（同轮追加，用户反馈「缺乏层次感」）**

原因不是单一因素，是四个叠在一起：
1. 地名与团名**同字号（都 15px）**、**同左边缘**（团名没缩进）；
2. 两者的**颜色只差一点**（地名 `#d9c4ff` 淡紫 / 团名 `rgba(255,255,255,.88)` 白）；
3. **组间距（10px）与行间距（2px）太接近**，分不出「一个行政区」这个单位；
4. 标题「甘肃省 · N 个互助团」与下面的列表**之间没有分隔**。

**最终修法（方向 A，用户选定）**：只用**字重 + 颜色**分层，**不加 · 标记、不做缩进**——
（先试过「· 标记 + 缩进两格 + 组间细线」的版本，用户反馈「很丑」，那是把建议当方案做了，已回退。）

- 地名 = **主项**：淡紫 `#d9c4ff` + `font-weight:600`；
- 团名 = **次项**：白色 `rgba(255,255,255,.82)` + `font-weight:400`；
- 两者**同左对齐**（331px），组间距 12px、组内团名行距 3px。

**验证**：Playwright 悬停甘肃省，5 个分组全部零重叠、`scrollWidth === clientWidth === 320`（零溢出），
地名与团名墨迹 left 同为 331px（无缩进），字重 600 / 400、颜色两档分明。
同行政区多团的分组效果：临时插入一条同行政区的「积石山民宿管家互助团」实测——
该行政区只出现**一次**地名，下面列两个团名；**测完已从库里删除**（`slug='tmp-jishuishan-test'`，
甘肃省团数已回到 5，库中 `tmp-` 前缀记录为 0）。
同行政区多团的分组效果：临时插入一条同行政区的「积石山民宿管家互助团」实测——
该行政区只出现**一次**地名，下面列两个团名；**测完已从库里删除**（`slug='tmp-jishuishan-test'`，
甘肃省团数已回到 5）。`npx tsc --noEmit` 零报错，`scripts/verify-home.mjs` 13/13。

### 8.95 第四十九轮之三：首页数字滚动动效 + 联系我们页加两段（2026-11-03）

**1. 首页大数字滚到眼前时从 0 数上去**（参考 ashoka.org 首页的做法）

新增 `src/components/site/CountUpNumber.tsx`（客户端组件）：
- `IntersectionObserver`（threshold 0.35）：数字块**进入视口**才开动，离开再回来**不重播**；
- 缓动 `easeOutExpo`（开头快、末尾慢），**1.6 秒**数完，末尾取整不闪 `12.999`；
- 系统开了「减少动态效果」（`prefers-reduced-motion: reduce`）→ **直接给最终值**，不做动画
  （与 `HomeCarousel` / `BackTop` 同一口径）；
- **服务端渲染时先输出 0**：否则用户先看到 53，滚到眼前又跳回 0 再数上去，会闪一下。
  读屏软件读的是 `aria-label` 上的**最终值**（不念动画中间数）；禁用 JS 时由 `<noscript>` 给真实数字。
- 首页三个数字（互助团 / 场活动 / 人次参与）改用该组件；`stats` 的取值口径不变
  （互助团只算运行中的团，见 `getPublicStats`）。

**2. 联系我们页 lead 之后加两段**
- `site.contact.leadExtra` = 「欢迎加入我们，一起助力更多木兰姐妹在不同人生阶段获得新的成长。」
- `site.contact.slogan` = 「AI时代，木兰同行」
- 文案放 `src/content/site.ts`（文案唯一来源），页面只负责版式：
  邀请语与 lead 同款（`text-ink-muted`），口号单独一行、display 字体、稍大一号。

**验证**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 零报错 |
| `scripts/verify-home.mjs` | 13 / 13 |
| 数字动效实测 | 未滚动 `0/0/0` → 滚动 0.5s 时 `46/17/226` → 1.6s 后停在 `53/20/258` |
| 减少动效实测 | `reducedMotion: reduce` 下初始即为 `53/20/258`，滚动后不变 |
| `/contact` 正文 | lead → 邀请语 → 口号 → 三种参与方式 → 联系人，顺序正确 |

### 8.96 第五十轮：经费页执行率显示两位小数（2026-11-03）

用户要求 `/budget` 经费页的**执行率**显示两位小数（原来一律 `Math.round` 取整成「63%」，
看不出是超了一点还是差很多）。

**新增统一格式化函数** `src/lib/format.ts` 的 `formatRate(value)`：
`(value * 100).toFixed(2) + '%'`，空值返回 `—`。**四处调用点统一改用它**，
不再各写各的 `Math.round(... * 100)`：

| 位置 | 场景 |
| --- | --- |
| `app/(admin)/(workspace)/budget/page.tsx` | 各团年度预算视图的汇总卡「执行率」 |
| `app/(admin)/(workspace)/budget/page.tsx` | 单个团卡片的提示「已用 xx%」 |
| `components/console/BudgetTable.tsx` | 各团年度预算表的「执行率」列 |
| `components/console/FundPanel.tsx` | 活动资金视图：卡片提示「执行率 xx%」+ 资金表「执行率」列 |

⚠️ `FundPanel` 的 `Rate` 组件里，进度条宽度仍按百分比算（不受小数位影响），
但数字的容器宽度从 `w-11`（放不下「99.18%」）放宽到 `w-14`，避免换行。

**验证**：Playwright 登录工作台实测两个视图——
各团年度预算视图执行率 `0.30%` / `9.72%` / `0.00%`，
活动资金视图 `99.18%`（卡片提示、资金表、按项目表、预算前十表全部一致）。
`npx tsc --noEmit` 零报错，`scripts/verify-round.ts` 137/137。

### 8.97 第五十一轮：活动详情页改造（费用类别 / 反馈采纳 / 移动端）（2026-11-03）

用户提了 8 条，逐条做完了。

**1. 设置页费用类别只留一级（彻底删掉二级）**
- 集合 `activity-settings.expenseCategories` 从 `{category, items[]}` 改成只有 `category`；
  迁移 `20261103_161500_expense_categories_single_level` 删掉 `activity_settings_expense_categories_items` 子表。
- `lib/budget.ts`：`BudgetCategoryDef.items` 保留但恒为空数组（不破坏 `cat.items` 的调用点）；
  内置兜底清单只留 13 个一级类别名。
- `ExpenseCategoryEditor` 去掉左右两栏（主从式），改成**一列类别名**；卡片宽度自然与「活动规则」一致（同在左栏）。
- 历史数据不受影响：方案 / 反馈 / 报销单里存的是**名称快照**。

**2. 删除「查询与可支持项」**
- `SupportedItemsButton` 组件整个删掉，`PlanEditor` / `ReportForm` 两处引用一并去掉。

**3. 移动端活动详情页**
- 之前 390px 下**202 处横向溢出**（文档表格按 PDF 版心 620px 排，右半边被裁）。
- 做法：`docCssScoped()` 追加一段**只给页面用**的窄屏样式（`SCOPED_NARROW_CSS`）：
  字段表摊成卡片（标签在上、值在下）；明细表也摊成卡片（列多，横排必然把字挤成竖排）；
  表格补 `data-label`（窄屏时字段名顶在值上方，顺带是 a11y 改进）。
- ⚠️ **导出的 PDF 不带这段样式**（`docCss` 不含 `SCOPED_NARROW_CSS`）——打印版式一个字都不改。
- 实测：390px 下文档区溢出 0，页面不再横向滚动（`scrollWidth === clientWidth === 390`）。

**4. 长文本换行**
- 窄屏下 `td.nowrap`（团名、人名）也允许换行；地址类内容格 `overflow-wrap: anywhere`，
  「计划活动地点 杭州 · 公益创投空间」这类长地址能完整显示。

**5. 报销审核负责人可置空**
- `updateActivityRules` 不再要求两个负责人非空（活动审核负责人仍必须有人）；
  `SettingsForm` 的报销审核下拉去掉 `required`、占位改为「暂不设置」。

**6. 流转改成四段：活动申请 → 活动审核 → 活动反馈（采纳）→ 报销审核**
- **新增 `reviewReport` action + `ReportReviewForm` 组件**：项目组（**活动审核负责人**）审反馈，
  「采纳」= 反馈标记已采纳 → **活动自动发布到公开站** → **推到报销环节**（生成报销单待审核）；
  「退回」= 意见必填，反馈退回团长补充。
- 反馈提交时**不再自动生成报销单**（以前一提交就进报销环节，等于没审）。
- **报销单记审核人快照**（`reimbursements.reviewerId` / `reviewerName`，迁移
  `20261103_174500_reimbursement_reviewer_snapshot`）：
  生成时有人 → 只有他能审这一单；**生成时没人 → 这一单永远不流转**
  （不推送通知、不进待办、之后设了负责人也不回审这一单）。
- 报销审核不再动反馈状态（反馈的审核已拆到上一环节），只核金额。
- 反馈一旦被采纳就是定案，不能再改（`updateReport` 加了锁定）。
- 待办里没有审核人的报销单**不进待办**（`home/page.tsx` 按 `reviewerId` 过滤）。

**7. 驳回记录收起**
- `PlanHistory` / `ReimbursementHistory` 加 `collapsible` 参数：**页面传 true** → 只显示最新一版结论，
  历史版本与驳回记录收进 `<details>`（要看得主动点开）；**PDF 不传** → 全部铺开，打印版式不变。
- 页面上标注「历史版本与驳回记录（已收起）· 共 N 版」。

**⚠️ Payload 的两个坑（踩了很久，改流程时必看）**

1. **只改状态时会被必填校验卡住**。
   `payload.update()` 会拿**合并后的整份文档**去跑必填校验——
   反馈的《经费支出明细表》每笔都要有凭证，缺一项就把整条「采纳」卡住（反馈永远采纳不了）。
   解法：**把原有内容原样带回**（`location` / `actualAt` / `summary` / `attendees` /
   `photos` / `expenseItems`），只加要改的 `status`。
   ⚠️ 数组字段**不传 = 被清空**，必须显式带回。
   ⚠️ `draft: true` 对**没开版本管理的集合无效**，别指望它跳过校验。
2. **数组子字段里的 upload 关系，要传完整的关系文档对象**（`{ id, filename, url, … }`），
   传**裸 id 数组**（`['1']`）会被判「缺凭证」。
   读的时候 `payload.findByID({ depth: 1 })` 就能拿到完整对象
   （`expenseItems[].receipt` 是关系文档数组），**原样带回即可**，不用自己查关系表。
   （关系数据在 `activity_reports_rels` 表里，path 形如 `expenseItems.<下标>.receipt`，
   但**不要自己去查这张表**——Payload 的展开已经够用了。）

**8. 左侧填报区形态**
- 研判结论：**保留 PDF 同源形态**（改动风险最小、与打印结果一致），只修移动端与长文本。

**验证**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 零报错 |
| `scripts/verify-round.ts` | 137 / 137 |
| 移动端 | 390px 下文档区溢出 0、页面无横向滚动；字段表与明细表均摊成卡片 |
| PDF | 打印路由输出**不含**窄屏规则、不含 `<details>`、表格样式原样 |

> ⚠️ 期间踩到的坑（回归先看）：
> 1. **加了集合字段必须写迁移**——`reimbursements.reviewerId` 没建表时，
>    所有读报销单的地方（团详情页的年度预算计算）直接 500。
> 2. **演示邀请码 7 天会过期**：`MULAN-8F3K2` 到期后 `/join` 一直显示「链接不存在或已失效」，
>    验收脚本的「建团页」两条会失败。`scripts/restore-demo.ts` 只把状态改回 active、
>    **不重置 `expiresAt`**，所以过期后还原不回来——本轮手工把
>    `expires_at` 推到了 30 天后。**已在 §8.98 修好这个脚本缺陷。**

### 8.98 第五十二轮：修 `restore-demo.ts` 不重置邀请码有效期（2026-11-04）

**问题**：演示邀请码 `MULAN-8F3K2` 的有效期只有 7 天（`INVITE_VALID_MS`）。
过期后 `lookupInvitation()` 会把它的 `status` 置成 `expired`，
于是 `/join` 一直显示「链接不存在或已失效」——
**而 `scripts/restore-demo.ts` 只把 `status` 改回 `active`、没重置 `expiresAt`**，
所以「还原演示态」还原不回来：过期后跑多少次还原都还是失效，
`scripts/verify-round.ts` 的「建团页有所在地域与项目类别」「建团页说明『接下来会发生什么』」两条会一直失败。

**修法**（`scripts/restore-demo.ts`）：
- 引入 `INVITE_VALID_MS`（`../src/lib/invitation`，与种子脚本同一口径，不再硬编码 7 天）；
- 还原时**同时重置 `expiresAt`**（从现在起再给 7 天），并把 `status` 设回 `active`、
  `usedBy` / `usedAt` 清空。

**验证**（真实验证，不是走过场）：

| 场景 | 还原前 | 还原后 |
| --- | --- | --- |
| 已过期 | `status=expired`、`expires_at` 在过去 → `/join` 显示「链接不存在或已失效」 | `status=active`、`expires_at` = 现在 + 7 天 → `/join` 正常显示建团表单（含「所在地域」） |
| 已使用 + 已过期（最坏情况） | 同上，且 `status=used` | `status=active`、`used_at` 清空、有效期重置 → `/join` 正常 |

### 8.99 第五十三轮：设置页置空 / 卡片布局 / 填报区字号 / 报销自我审核（2026-11-04）

用户提了四件事，逐条改完并验证。

**1. 报销审核负责人「设为空」实际做不到**
- 根因：`FormSelect` 的 `placeholder` **只是未选时的提示文字，不是可选项**——
  下拉里根本没有「不设置」这一项，用户没法「选」它。
  上一轮只把 `required` 去掉等于没改。
- 修法：`FormSelect` 加 `clearable?: string` 参数，传了就在列表最前面加一个「不设置」项，
  值用哨兵 `CLEAR_VALUE = '__none__'`（Base UI 不接受空字符串作为选项值）。
- `resolveId()` 顺手修了个 bug：原来 `resolveId('')` 返回 **0**（`Number('')` 是 0），
  现在空串与非法值统一返回 `null`。
- 设置页的报销审核下拉传 `clearable="不设置"`。
- 验证：下拉选项 `["不设置", "项目组"]`；选「不设置」→ 隐藏 input 提交 `__none__` →
  保存后数据库 `reimbursement_reviewer_id` 为 null，查看态显示「未设置」，
  修改记录写「报销审核负责人 项目组 → （未指定）」。

**2. 费用类别卡片被右栏顶开**
- 根因：设置页是 `FORM_COLUMNS`（两列网格），费用类别卡是**第三张平级卡片**，
  排在「修改记录」之后 → 被右栏那张很高的卡**顶到下面**，左栏中间空出一大片。
- 修法：把「活动规则 + 费用类别」包进**左栏容器**（`space-y-6`），右栏独立一张卡。
- 验证：活动规则 x=73/w=718、费用类别 x=73/w=718（**同 x 同宽**）且紧跟其下，
  修改记录 x=840/w=384 在右栏——右栏多高都不再影响左栏。

**3. 填报区字号参差**
- 根因：同一张表里三个字号——标签 th/td 14pt（18.67px）、填空控件 12.5pt（16.67px，
  `globals.css` 里 `.activity-doc input…` 那条 `!important`）、
  下拉框里显示的文字 `select-value` **没有自己的字号**，继承 `.activity-doc` 正文 16pt（21.33px）。
- 修法：把那条 12.5pt 改成 **14pt**（跟表格文字、跟 PDF 一致），
  并给 `[data-slot='select-value']` 单独定 14pt（放在后面那条规则**之后**，同优先级后面胜）。
- 验证：填报区所有文字（标签、表格内容、下拉文字、输入框）**只剩 18.67px 一种字号**。

**4. 报销「不能审核自己提交的报销」误伤**
- 根因：报销单是**系统代理团长提交**的，但 `autoSubmitReimbursement` 把 `applicant`
  记成了**执行采纳的那个人**（项目组）。于是：
  - 「不能审核自己提交的报销」把**报销审核负责人恰好是采纳人**的情况全拦死；
  - 「通知团长审核结果」也通知到了项目组自己头上。
- 修法：
  - `applicant` 改记**真正填反馈的团长**（`report.submittedBy`）；
  - `versions[].submitter` 同样改记团长（原来记的是采纳人，版本追溯就乱了）；
  - **移除「不能审核自己提交的报销」这条拦截**——
    「谁能核这笔钱」由**报销审核负责人**这个设置（`reimbursement.reviewerId` 快照）说了算，
    不再另加一条。
  - （活动**申请**那边的「不能审核自己提交的申请」**保留**——那是团长真的自己填了申请。）
- 验证（造「报销审核负责人 = 采纳人 = 同一人」的真实场景）：
  采纳 → 生成报销单（`applicant_id=2` 团长、`reviewer_id_id=1` 负责人）→
  页面出现「核定通过」按钮 → 点下去**核定成功**（`status=approved`、`approver_id=1`），
  不再被拦；通知也正确：团长收到「已采纳 / 核定通过」，项目组收到「请核定」。

**5. 顺带修：历史版本收起条上的白块**
- 现象：「共 N 版」这行小字在浅紫的收起条上是个**突兀的白块**。
- 根因：文档区有一条 `!important` 的白底规则命中了它。
- 修法：`.version-collapse-count` 显式给 `background: transparent !important`，
  并加 `margin-left: auto` 让它贴到收起条右侧。

**验证**：`npx tsc --noEmit` 零报错；`scripts/verify-round.ts` 138/138；测试数据与临时脚本已清理。

