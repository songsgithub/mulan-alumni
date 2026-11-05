# 数字木兰 · 校友互助网络

> 蚂蚁公益基金会「数字木兰」项目：面向数字技能培训的校友互助网络。
> 公众站是一个**活动展示站**（活动 / 资料库 / 关于），管理端独立部署在**子域名**上。
> 技术路线：Next.js 16（App Router）+ Payload CMS 3.92 + PostgreSQL 16 +
> Tailwind CSS v4 + **shadcn/ui（Base UI）** + Zod + S3 兼容对象存储 + Docker。
> 全站简体中文，面向 27–55 岁读者设计（正文 17px 起，控件大而柔）。

---

## 目录

- [两个域名](#两个域名)
- [一键跑起来](#一键跑起来)
- [两种数据库模式](#两种数据库模式)
- [演示账号](#演示账号)
- [公众站](#公众站)
- [核心业务流程](#核心业务流程)
- [经费与凭证口径](#经费与凭证口径)
- [角色与权限](#角色与权限)
- [前端设计规范](#前端设计规范)
- [目录结构](#目录结构)
- [验收记录](#验收记录)
- [常见问题](#常见问题)

---

## 两个域名

| 域名 | 内容 | 登录入口 |
| --- | --- | --- |
| **公众域** `www.mulan.org` | 活动展示站：首页、活动、资料库、关于 | ❌ 一个都没有 |
| **管理域** `admin.mulan.org` | Payload 后台 + 校友会工作台 + 登录 / 邀请注册 | ✅ |

分流由 `src/proxy.ts` 按 `Host` 实现（Next.js 16 的官方约定，取代了旧的 `middleware.ts`）：

- 工作台域：根路径就是工作台首页（内部重写到 `/home`），路径**不带 `/console` 前缀**；
  `/admin` 跳到 CMS 域，其余路径放行；
- CMS 域：根路径跳到 `/admin`，工作台的路径跳回工作台域；
- 公众域：工作台与后台路径**一律 404**（不是 302，避免暴露路径存在性），其余放行。

本地用三个 `*.localhost` 即可（浏览器会把 `*.localhost` 解析到 `127.0.0.1`）：

```bash
WORKSPACE_HOST=connect.localhost   # .env 中已配置；生产改为 connect.mulan.org
CMS_HOST=admin.localhost           # .env 中已配置；生产改为 admin.mulan.org
```

> 公众站**不展示任何互助团的规则、制度与内部术语**（经费标准、审批流程、角色定义等），
> 这些只存在于管理端。逐条禁止清单见 [`docs/设计规范.md`](docs/设计规范.md) §0.1。

---

## 一键跑起来

**前提**：WSL Ubuntu 可用，且里面已装好 Node（Payload 3.92 要求 `node ^22.23.4 || >=24.22.1`）与 npm。

> ⚠️ 国内 npm 镜像源尚未同步 Payload 3.92.0，装依赖请加官方源：
> `npm install --registry=https://registry.npmjs.org`（**不要降版本**）。

### 起服务

```bash
npm install --registry=https://registry.npmjs.org
cp .env.example .env              # 填 POSTGRES_* / DATABASE_URI / PAYLOAD_SECRET
docker compose up -d postgres     # PostgreSQL 16（端口只绑 127.0.0.1）
npm run migrate                   # 按 src/migrations 建表
npm run seed                      # 演示数据（可选）
npm run dev                       # 开发服务器（崩了自动拉起）
```

启动后：

| 入口 | 地址 | 说明 |
| --- | --- | --- |
| 公众站（成果瀑布流） | http://localhost:3000 | 任何人可看，无登录入口 |
| 互助团版图 | http://localhost:3000/circles | |
| 资源 | http://localhost:3000/resources | 项目 VI / 视频 / 文本 / 图片 / 文件，全部公开 |
| **工作台**（成员 / 团长 / 项目组） | http://connect.localhost:3000 | 活动 / 互助团 / 资源 三项导航 |
| **CMS 后台**（仅运维） | http://admin.localhost:3000/admin | Payload 数据管理面板，独立 ops 账号 |

三域由 `src/proxy.ts` 按 `Host` 分流（`WORKSPACE_HOST` / `CMS_HOST`）。

### 方式 B：直接在 WSL 里

```bash
cd /home/wjitdev1/mulan-alumni
npm install --registry=https://registry.npmjs.org
npm run dev           # 开发服务器：接管端口 3000，崩了自动拉起
```

> **改代码随时编译**：Turbopack 的热更新是开着的（实测重编译 ~30ms），
> 改完存盘刷新页面就能看到；Payload 的集合配置也会跟着热更（后台导航立刻变）。
> `npm run dev` 起的服务器即使中途挂掉也会自己回来，不用手动重启。
> 万一页面报 `module factory is not available`（Turbopack 持久缓存过期），
> `npm run dev:clean` 会先清 `.next/dev` 再起。
>
> **端口 3000 上已经有实例时会自动接管**（2026-10-30 修）：
> `npm run dev` 会先停掉**本项目**占着 3000 的旧实例
> 再自己接管——不会再出现 `EADDRINUSE` 或
> `Another next dev server is already running`（那不是"起不来"，
> 是服务一直在跑、后来的人被挡住了）。只有端口被**别的程序**占着才会报错，
> 并说清是谁占的。
>
> **验一下开发服务器本身**（需要 `npm run dev` 已经在跑）：
> `npx tsx --env-file-if-exists=.env scripts/verify-dev.ts`
> ——验三域可用、热更新生效、崩了能自愈、崩过之后热更新仍然生效。

首次需要初始化数据：

```bash
npm run generate:types     # 生成 payload-types.ts
npm run generate:importmap # 生成后台 import map
npm run migrate            # 建表 / 迁移（初始迁移已随仓库提供）
npm run seed               # 灌入演示数据
npx tsx scripts/seed-network.ts   # 按全国真实盘再生成 318 个互助团（可选）
npx tsx scripts/fetch-geo.ts   # 预取中国地图边界（工作台地图用，需要外网）
```

> 地图边界没有预取也能用：`/api/geo/[adcode]` 会现拉并落盘到 `media/geo-cache/`，
> 只是第一次点开某个省要多等一下。

---

## 数据库与文件存储

- **数据库：PostgreSQL 16，开发与生产同一套**（2026-10-31 起不再支持 SQLite，评估见 `docs/系统设计.md` 第九节）。
  表结构只由迁移决定（`push: false`）：改集合字段 → `npm run migrate:create <名字>` → `npm run migrate` → `npm run generate:types`。
- **文件不进数据库**：活动原图、学习视频、财务凭证默认存磁盘 `media/`、`finance-evidence/`（生产必须挂卷并备份），
  或配置 `S3_*` 走对象存储。单个文件上限 2GB（一小时 720p 视频约 1GB）。
- **备份**：`bash scripts/backup.sh /data/backups`（pg_dump + 上传文件，保留 14 天；建议 crontab 每天跑并同步到异地）。

```bash
docker compose --profile storage up -d minio   # 可选：本地 S3（MinIO）
docker compose --profile app up -d --build     # 生产：应用容器（启动时自动 migrate），健康检查 /api/health
```

对象存储走 S3 兼容协议（OSS / MinIO / R2），在 `.env` 填 `S3_ENDPOINT`、`S3_BUCKET`、
`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`；留空则使用 Payload 本地磁盘存储
（`media/` 公共媒体、`finance-evidence/` 财务凭证）。

---

## 演示账号

| 角色 | 账号 | 密码 | 登录处 |
| --- | --- | --- | --- |
| **项目组**（审批 / 核定 / 付款 / 精选发布 / 邀请建团） | `admin@mulan.org` | `Mulan@2026` | 工作台 `connect.localhost:3000/login` |
| 团长（杭州 AI 互助团） | `lead@mulan.org` | `Mulan@2026` | 工作台 |
| **后台运维**（只管数据，不做业务） | `ops@mulan.org` | `Mulan@2026` | CMS 后台 `admin.localhost:3000/admin` |

> 登录入口**只在工作台域**：`http://connect.localhost:3000/login`。
> 公众域（`localhost:3000`）任何页面都没有登录入口，访问管理路径一律 404。
> **业务账号进不了 CMS 后台**（Payload Admin 的登录源是独立的 `ops-users` 集合）。

演示邀请链接（管理域 `/join` 注册新团长）：**`MULAN-8F3K2`**
（绑定受邀邮箱 `new.sister@mulan.org`，SOP 要求邀请制 + 邮箱匹配；注册成功即自动入圈并直接登录。）

演示数据：5 个互助团（杭州 / 北京 / 成都 / 深圳 / 西安）、12 条成果（活动 / 故事 / 模板）、
5 份公开资料，以及一条走完全程的活动（方案 → 反馈 → 报销）。

---

## 公众站：成果瀑布流

公众站的主内容不是文章，而是**大家的连接成果**——每一条是一条真实发生过的事：
哪个圈、哪座城市、多少人一起做成的、产出了什么。

| 路由 | 内容 |
| --- | --- |
| `/` | **成果瀑布流**（首页）：成果卡混排 + **两组筛选**（类型 / 互助团，可组合，如 `/?type=story&circle=pk6dj67bz2jtpn`） |
| `/activities/[slug]` | 成果详情：日期、地点、署名与参与人数、纪实正文、现场照片、可下载附件，并回链所属互助团 |
| `/circles` | 互助团版图：五个团各一格，点进去是团详情 |
| `/circles/[slug]` | 互助团详情：团是谁、做了什么（成果瀑布流）、留下了什么（可下载资料）、别的团 |
| `/library` | 公开资料库 |
| `/library/[slug]` | 资料详情，可匿名下载附件 |

> **网址里那一段是不透明随机串**：展示名（`杭州 AI 互助团`、`AI 工具共学工作坊（第 3 期）`）
> 一律是中文人话，地址栏里的标识是 14 位小写随机串（如 `pk6dj67bz2jtpn`）——
> 防枚举、防泄漏，名称改了链接也不失效。详见 `src/lib/code.ts`。
| `/about` | 项目介绍与合作入口（不含任何规则说明） |
| 404 | 中文页面 + 回到成果流的出口（管理路径同样返回 404，不暴露路径存在性） |
| `/sitemap.xml` `/robots.txt` | 站点地图 / 爬虫规则（只暴露展示内容） |

成果卡片有**三种形态**混排，靠形态差异制造瀑布流的高低错落：

| 形态 | 用于 | 高度 |
| --- | --- | --- |
| 照片卡 | 活动现场（带图 + 日期 / 城市 / 署名 / 人数） | 高 |
| 话语卡 | 成员的一句话、复盘（无图，字大） | 中 |
| 文件卡 | 能直接拿走用的模板（文件名 + 下载入口） | 矮 |

公开文案集中在 `src/content/site.ts`，改文案只改这一个文件。

**版式是宽屏的**：公众站与管理端容器统一 `2200px`，1920 屏上内容铺满；
≥1920px 时成果瀑布流与卡片网格升为 **4 列**（宽屏用来多放内容，不是把三列拉大）。
首屏与页头都是两栏，右边不留空白。

---

## 核心业务流程

```
① 邀请注册   项目组发邀请码 → 成员在管理域 /join 注册 → 自动入团并登录
② 活动方案   团长提交（标题/时间/目标/预算明细）→ draft → submitted
③ 项目组审批 submitted → approved | rejected | revision_required（每次动作留痕）
④ 实施反馈   提交实际参与/实际支出/纪实/照片/签到表 → 方案自动置为 implemented
⑤ 报销核定   提交明细+凭证（每行必填）→ submitted → approved（可核减，须填原因）
⑦ 提名发布   团长在反馈里「推荐公开」→ 项目组在精选发布页「转成精选内容」→ 公众站成果流立即可见
```

---

## 工作台：互助团网络地图

`/circle` 是一张**可下钻的中国地图**：全国 → 省 → 市 → **区（县）是最小单位**，
每个有互助团的区县标出数量。左边地图、右边列表：

- **四类筛选**：加油木兰 / AI豆计划 / 民宿管家 / 追风计划，每类后面是该类的互助团总数；
  筛选后地图数字与右侧列表同步变化，筛选走 URL，链接可以直接分享。
- **点列表即定位**：点右边一个团，地图自动下钻到它所在的区县并高亮。
- **「更多」进全部互助团**（`/circles/all`）：三列紧凑网格的完整名录，可搜可筛。
- **单个团的详情页**（`/circles/<团>`）：**左窄右宽两栏**——
  左边是互助团信息（团信息 + 团长与任期区间），右边是这个团的活动列表
  （每条带「方案 ✓ 反馈 ✓ 报销 ✓」标记，**最新活动排在最上面**）。
  项目组在这页还能改状态、发起团长转移。
- **一个团一个团长**：不需要成员名单——团长自己维护这个团的全部活动（方案 / 反馈 / 报销），
  项目组负责审批、核定、付款与发布。团长换人走链接，老团长的信息与在任时间区间保留。
- **邀请创建**：`/circles/new` 只生成一个**有效期 3 / 7 / 14 天**的邀请链接，
  对方打开链接填姓名 / 省市区 / 项目类别 / 手机 / 邮箱即可注册，**注册即成为团长**（团只要团长一人），链接用过即失效。
- **团长转移**：在 `/circles/<团>` 详情页里可改互助团状态（运行中 / 暂停 / 已解散），
  也可生成转移链接让新团长接管——老团长的信息保留，并在「团长任期」里记着在任时间区间。
- **右侧列表**：未筛选时按团名首字母（拼音）排序，筛选后随之变化。
- 页面右上角是「邀请创建互助团」；**这一页不展示活动**（活动在「活动」页看）。

地图边界来自 DataV.GeoAtlas（最新一版行政区划），已预取到 `media/geo-cache/`，
点开没缓存的层级会现拉并落盘。

**团多了也扛得住**（按真实盘模拟过 323 个团）：

- 地图**只画数量不画点**，逐级下钻天然完成聚合；标签自动避让重叠。
- 右侧列表**分段落（30 条一页）+ 可搜索**（团名 / 城市 / 区县 / 类别）。
- 两栏定高 680px，列表在自己的框里滚动——页面不会被几百行撑长。

想自己造一份全国盘的数据：

```bash
npx tsx scripts/build-county-index.ts   # 拉全国 2840 个县级单位（真实区划）
npx tsx scripts/seed-network.ts          # 按真实盘生成 ~318 个互助团
```

## 工作台：活动 = 一次从方案到发布的完整记录

活动列表**按项目类型分组**（加油木兰 / AI豆计划 / 民宿管家 / 追风计划）。
活动详情是一篇**长文章**：顶部一条关键数据带（预计参与 / 预算 / 实际参与 / 实际支出 / 核定金额），
左边占大部分，分成四块活动信息——**① 活动方案 ② 审批 ③ 活动反馈 ④ 报销**；
**右边固定一个环节导航**，像文章的目录，往下滚时高亮当前环节并显示它的审批状态。

四块的内容按 **SOP 原件**（《活动申请表》《活动反馈表》）的字段顺序排：
方案区是互助团名称 / 申报时间 / 申报人 / 主题 / 时间 / 地点 / 人数 / 预算明细；
反馈区是八项齐全——开展主题、地点、**时间（含时段）**、签到名单、活动总结（200 字内）、
成员活动感受、**活动照片 3-5 张**、**活动资金使用情况（必要物料与价格 + 照片证明）**，外加《签到表》。
照片少于 3 张服务端直接拒；报销区有明细与凭证表，付款完成后给「**筹备下一场活动 →**」。

「精选发布」挂在**活动反馈**这一块的右上角：
**反馈被采纳、且这次活动的报销核定了**才能发布；没满足就是置灰并说明原因——
服务端也会拒，不是只靠前端置灰。

工作台只有三个入口：**活动 / 互助团 / 资源**。

一场活动 = 一条独立记录，详情页一屏看完：
**① 方案 → ② 审批 → ③ 反馈 → ④ 报销（含付款与发布）**。

| 环节 | 团长 | 项目组 |
| --- | :-: | :-: | :-: |
| 方案内容 | ✅ 同团 | ✅ | 只读 |
| 提交活动申请 | ❌ | ✅ | — |
| 审批 | ❌ | ❌ | ✅ |
| 活动反馈（含实际支出） | ✅ 同团 | ✅ | 只读 |
| 提交报销 / 核定 / 付款 / 精选发布 | ❌ | 提交 | ✅ |

**成员与团长看的是同一个页面**，差别只在能不能改；成员只看本互助团的活动，项目组看全部互助团的。

团长还可以把一条**已采纳**的反馈**提名公开**；项目组在 ⑤ 精选发布环节一键「转成精选内容」，
标题 / 摘要 / 日期 / 参与人数 / 现场照片 / 所属互助团自动带出，发布后公开站立即可见。

项目组在「互助团」页可以生成**邀请链接**（不是邀请码），让对方创建或加入互助团。

## 三域与账号体系

| 域名 | 面向谁 | 登录 |
| --- | --- | --- |
| 公众域 | 互联网大众 | 不需要 |
| 工作台域（`connect.`） | 团长 / 项目组 | 业务账号（`users`） |
| CMS 域（`admin.`） | 运维 / 技术负责人 | **独立后台账号（`ops-users`）** |

- Payload CMS 后台是**数据管理工具**（字段级、表格化），"高冷"是它的定位，不是缺陷；
  一线业务操作都在友好的工作台里完成。
- 业务账号进不了 CMS 后台：实测项目组与团长登录均被拒。
- 成员与团的增删改在工作台完成（邀请链接注册 / 邀请创建互助团 / 团成员管理）。

---

## 经费与凭证口径

口径全部来自 SOP 原文，逐条结论见 [`docs/系统设计.md` 第八节](docs/系统设计.md)。

| 项 | 口径 | 配置位 |
| --- | --- | --- |
| 预算上限 | 《经费预算明细表》合计 ≤ 上限（默认 500 元），超过不能提交 | 工作台「设置」（`activity-settings`） |
| 人数下限 | 预计参与人数 ≥ 下限（默认 1 人），不足不能提交；实际参与人数不限 | 工作台「设置」 |
| 审核负责人 | 活动审核、报销审核各指定一位项目组成员（可同一人），只有负责人能审核 | 工作台「设置」 |
| 报销凭证 | 每行明细必填，形式限发票 / 收据 / 支付截图 | `reimbursements.items[].receipt` |
| 付款对账 | 标记"已到账"必填流水号与付款日期；金额须与核定金额一致 | `payments.externalRef` |
| 反馈时限 | 活动结束后 5 天内提交，超期自动标记并在列表高亮 | `activity-reports.overdueDays` |

金额三段分离：**预算额 → 实际支出 → 申请报销额 → 核定金额**。

财务凭证存在独立集合 `finance-evidence`，读取范围为"项目组全部 + 本团团长"，公众不可见；
公共媒体（封面 / 活动照片 / 学习资料附件）存在 `media`，公开部分任何人可看可下载。

---

## 角色与权限

| 能力 | 公众 | 团长 | 项目组 |
| --- | :-: | :-: | :-: | :-: |
| 浏览公开活动 / 资料库 | ✅ | ✅ | ✅ | ✅ |
| 下载公开资料 | ✅ | ✅ | ✅ | ✅ |
| 凭邀请链接注册（注册即成为团长） | — | — | — |
| 提交活动方案（含经费） | ❌ | ❌ | ✅ | ✅ |
| 审批 / 驳回 / 要求修改方案 | ❌ | ❌ | ❌ | ✅ |
| 提交活动反馈 | ❌ | ✅ | ✅ | ✅ |
| 提交 / 核定报销 | ❌ | ❌ | ✅ / ❌ | ✅ |
| 上传资料 / 发布精选 | ❌ | ❌ | 提名 | ✅ |

**公众不必注册**：所有内部集合（方案、反馈、报销、付款记录、团成员、财务凭证）在访问层对未登录用户关闭；
公众页面由服务端按"已发布 + 可见性为公开"精确取数。

---

## 前端设计规范

公众站与管理端共用一套 token、一套组件库、一套动效（暖白底、圆角、柔阴影、无衬线）。
完整规则见 [`docs/设计规范.md`](docs/设计规范.md)，要点：

- **语言**：全站简体中文。
- **色彩**：黑白灰为底，**唯一的强调色（深砖红）只给交互元素**（按钮、焦点环、悬停、选中态）。
- **字体**：Display 用 Instrument Serif（中文落到本地宋体栈），UI 用 Inter（中文落到本地黑体栈）；
  不下载几十 MB 的中文 webfont。
- **字号**：正文 ≥ 17px、辅助文字与眉标签 ≥ 15px；PC 容器 2200px（宽屏用来多放内容，不做拉伸）。
- **控件**：按钮 ≥ 44px、输入框 ≥ 48px、圆角 2px——"柔中带刚"。
- **组件**：**全站都用 shadcn/ui**（`src/components/ui/*`，底层 Base UI）——
  公众站的共享组件（`src/components/site/`）本身就是用组件库拼出来的
  （`Chip`=`Badge`、`ArrowLink`=`Button`、`Rule`=`Separator`、成果卡=`Card`），
  业务端直接用组件；下拉框用 Base UI `<Select>`、勾选框用 Base UI `<Checkbox>`，
  表单里的受控组件由 `FormSelect` / `FormCheckbox` 配隐藏 input 承载 FormData。
  页面文件里不拼版式类名、不写 `style={{}}`、不写死色值。
- **动效**：组件层靠 `tw-animate-css`（shadcn 的进出场类名全靠它），
  内容层靠 `Reveal`（滚进视口时渐显 + 轻微上移；没有 JS 时内容照样可见）。

---

## 目录结构

```
mulan-alumni/
├── docs/设计规范.md              # 前端设计规范（语言、颜色、字体、字号、控件、组件、禁止项）
├── docs/系统设计.md              # 组织模型、权限矩阵、状态机、字段字典、第八节 SOP 校准结论
├── docs/验收记录.md              # 三轮验收逐条结果、截图索引、踩坑记录
├── docs/验收截图/                # 验收截图
├── scripts/backup.sh             # 数据库 + 上传文件备份
├── scripts/verify-security.sh    # 安全边界冒烟（21 项）
├── scripts/verify-versions.ts    # 活动申请版本追溯专项（只对副本库跑）
├── scripts/restore-demo.ts       # 验收后还原演示态
├── docker-compose.yml            # PostgreSQL 16 + MinIO + pgAdmin
├── src/
│   ├── proxy.ts                  # 域名分流
│   ├── payload.config.ts         # Payload 配置（集合 / 数据库 / 存储）
│   ├── access/index.ts           # 角色判定 + 集合级/字段级访问控制
│   ├── content/site.ts           # 公众站文案唯一来源
│   ├── lib/workflow.ts           # SOP 状态机 + 经费标准口径
│   ├── lib/public-data.ts        # 公开数据读取层（成果 / 互助团 / 资料库）
│   ├── lib/site-url.ts           # 公开站绝对地址（管理域跳公众域用）
│   ├── lib/host.ts                # 三域判断的唯一来源（proxy / layout 共用）
│   ├── lib/upload.ts             # 站内上传助手
│   ├── lib/lexical.ts            # Lexical 富文本构造器
│   ├── lib/labels.ts             # 枚举值 → 中文标签
│   ├── lib/demo-assets.ts        # 演示资产生成器
│   ├── collections/              # 12 个业务集合 + 2 个上传集合 + ops-users（后台账号）
│   ├── app/(site)/               # 公众域：/ /activities（内部 /site-activities）/activities/[slug] /circles/[slug] /resources /about /contact
│   ├── app/(admin)/(workspace)/  # 工作台域：/（内部 /home） /activities/[slug] /circles（内部 /network） /resources（内部 /assets） /budget /settings
│   ├── app/(admin)/(auth)/       # 工作台域：/login /join（独立外壳）
│   ├── app/not-found.tsx         # 全站中文 404
│   ├── app/(admin)/              # 工作台域：/login /join（独立页面，不套工作台导航）
│   ├── app/(payload)/            # Payload 后台与 REST / GraphQL
│   ├── components/site/          # 公众站共享组件
│   ├── components/console/       # 工作台表单与资金看板
│   └── seed.ts + seed/           # 演示数据
```

---

## 验收记录

公众站与管理端的验收项已于 **2026-10-24 在真实浏览器里逐条点过，全部通过**，
逐条结果、权限核验、截图索引与踩坑记录见 [`docs/验收记录.md`](docs/验收记录.md)。

验收跑完后还原演示态：

```bash
npx tsx --env-file-if-exists=.env scripts/restore-demo.ts
```

---

## 常见问题

**Q：`npm install` 报 `ERESOLVE: Found: payload@undefined` 怎么办？**
本地 npm 镜像源尚未同步 Payload 3.92.0。改用官方源即可，不要降版本：
`npm install --registry=https://registry.npmjs.org`。

**Q：`npm install` 后 esbuild / sharp 报找不到二进制？**
npm 的 `allowScripts` 机制拦截了安装脚本，执行：
`npm install-scripts approve esbuild sharp && npm rebuild esbuild sharp`。

**Q：Node 版本不够怎么办？**
Payload 3.92 要求 `node ^22.23.4 || >=24.22.1`。若版本偏低，可自行用 nvm 升级，或在 `package.json` 中把 Payload 各包降到兼容版本（`3.4x` 系列支持 Node 20）。这一步涉及技术路线调整，改前请确认。

**Q：为什么不用 SQLite 了？**
数据量 SQLite 撑得住，但它一直要打补丁（关系列被 dev push 删掉、非幂等建表、并发写 `SQLITE_BUSY`），
迁移文件还是 SQLite 方言、生产 PostgreSQL 跑不了。开发与生产统一成 PostgreSQL，迁移只有一套。

**Q：工作台和后台怎么在本地访问？**
工作台 `http://connect.localhost:3000`，CMS 后台 `http://admin.localhost:3000/admin`。
`*.localhost` 会被浏览器自动解析到 `127.0.0.1`，不需要改 hosts 文件。
若想用别的域名，改 `.env` 的 `WORKSPACE_HOST` 与 `CMS_HOST`。

**Q：文件上传存哪里？**
默认存本地 `media/`（公共媒体）与 `finance-evidence/`（财务凭证）；配置 `S3_*` 环境变量后自动切到 S3 兼容对象存储。

**Q：如何调整预算上限、人数下限或审核负责人？**
项目组登录工作台，进入「设置」页面修改，保存即生效，不用改环境变量或重启。

**Q：重新 seed 后图片还是旧的？**
Next 的图像优化器按 URL 缓存，清掉 `.next/dev/cache/images` 再重启 `npm run dev`。
