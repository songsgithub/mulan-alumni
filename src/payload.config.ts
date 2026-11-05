import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import process from 'node:process'

import { buildConfig } from 'payload'

import { ActivityPlans } from './collections/ActivityPlans'
import { ActivityReports } from './collections/ActivityReports'
import { Cohorts } from './collections/Cohorts'
import { FinanceEvidence } from './collections/FinanceEvidence'
import { InvitationLinks } from './collections/InvitationLinks'
import { PasswordResets } from './collections/PasswordResets'
import { AnnualBudgetSettings } from './collections/AnnualBudgetSettings'
import { CohortBudgets } from './collections/CohortBudgets'
import { Resources } from './collections/Resources'
import { Media } from './collections/Media'
import { Notifications } from './collections/Notifications'
import { Payments } from './collections/Payments'
import { Publications } from './collections/Publications'
import { Reimbursements } from './collections/Reimbursements'
import { OpsUsers } from './collections/OpsUsers'
import { ActivitySettings } from './globals/ActivitySettings'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const s3Enabled = Boolean(
  process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
)

// s3Enabled 为真时这四项必然有值，这里做一次性收敛，便于类型检查
const s3Config = {
  endpoint: process.env.S3_ENDPOINT as string,
  bucket: process.env.S3_BUCKET as string,
  accessKeyID: process.env.S3_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
}

/**
 * 会话签名密钥：生产环境缺失或仍是示例值时直接拒绝启动——
 * 密钥能被猜到，就能伪造任何人的登录态。
 */
const secret = process.env.PAYLOAD_SECRET || ''
// 只在**运行时**拦：`next build` 也会以 production 加载这份配置，但构建机上不一定有正式密钥
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
// 种子 / 还原脚本借 production 模式跳过 dev schema push（见 lib/seed-env.ts），它们不签发会话
const isLocalScript = process.env.MULAN_LOCAL_SCRIPT === '1'
if (
  process.env.NODE_ENV === 'production' &&
  !isBuildPhase &&
  !isLocalScript &&
  (secret.length < 32 || /change|example|placeholder|mulan|^dev|^test/i.test(secret))
) {
  throw new Error('PAYLOAD_SECRET 未配置或过弱：生产环境请设置至少 32 位的随机字符串')
}

/*
 * 关于 Payload 的 `csrf` 来源名单：**有意不配**。
 * 配上之后，没有 Origin 头的请求要靠 Sec-Fetch-Site 才认登录 cookie，
 * 而 iOS Safari 16.4 以前不发这个头——老 iPhone 上的团长每打开一页都会被当成未登录。
 * CSRF 已由三层挡住：集合 REST 写入只开给后台账号（见 access/opsOnly）；
 * 工作台写操作都是 Server Action（Next 自带 Origin 校验）；会话 cookie 是 SameSite=Lax。
 */

export default buildConfig({
  admin: {
    // Payload CMS 后台的登录源：独立的后台账号集合（运维 / 技术负责人）。
    // 业务账号（核心成员 / 团长 / 项目组）**不在**后台的登录候选名单里，
    // 见 docs/设计规范.md §7.1.1。
    user: 'ops-users',
    components: {
      // 隐藏登出按钮：后台是运维常开的工具，这个按钮在这里没有意义
      logout: {
        Button: { path: '@/components/payload/HideLogoutButton' },
      },
    },
    meta: {
      titleSuffix: '数字木兰校友会 · 互助团运营',
    },
    importMap: {
      baseDir: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    },
  },
  globals: [ActivitySettings],
  collections: [
    Users,
    OpsUsers,
    InvitationLinks,
    PasswordResets,
    AnnualBudgetSettings,
    CohortBudgets,
    Cohorts,
    ActivityPlans,
    ActivityReports,
    Reimbursements,
    Notifications,
    Payments,
    Resources,
    Publications,
    // 上传集合：公共媒体库 + 财务凭证库
    Media,
    FinanceEvidence,
  ],
  // 开发与生产都用 PostgreSQL（2026-10-31 起不再支持 SQLite，评估见 docs/系统设计.md 第九节）。
  // push: false —— 表结构只由迁移文件决定（src/migrations），开发态不自动改表：
  // 改了集合字段就 `npm run migrate:create` 生成迁移、`npm run migrate` 执行，开发与生产同一套结构。
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: false,
  }),
  editor: lexicalEditor(),
  // 上传在**解析请求体时**就按 2GB 截断（集合钩子里的体积检查要等文件收完才跑）；
  // 大文件先落临时目录，不整份缓冲进内存（一小时的学习视频动辄 1GB+）
  upload: {
    limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    useTempFiles: true,
  },
  secret,
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  plugins: [
    // Payload 3.92 的 Next.js 集成不需要配置插件：
    // src/app/(payload)/ 下的 admin 页面与 REST / GraphQL 路由已直接使用 @payloadcms/next
    ...(s3Enabled
      ? [
          s3Storage({
            // 只有上传集合能配 S3 存储；其余集合的文件都通过 relationship 指向这两个集合
            collections: {
              media: true,
              'finance-evidence': true,
            },
            bucket: s3Config.bucket,
            config: {
              endpoint: s3Config.endpoint,
              forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
              region: process.env.S3_REGION || 'auto',
              // Payload 3.92 的 S3 插件把凭证放在 AWS SDK 的 config.credentials 里
              credentials: {
                accessKeyId: s3Config.accessKeyID,
                secretAccessKey: s3Config.secretAccessKey,
              },
            },
          }),
        ]
      : []),
  ],
})
