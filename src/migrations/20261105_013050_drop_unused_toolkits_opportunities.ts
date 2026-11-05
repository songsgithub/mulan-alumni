import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 2026-11-05 第五十三轮：删掉两个**从未启用**的集合（互助团经验 / 合作机会）。
 *
 * 为什么要删：
 * - `toolkits`、`opportunities` 全仓**零读写**（只在 `CollectionSlug` 类型里出现过），
 *   库里也是 0 行，却各自会生成一整套 REST / GraphQL 端点 —— 属于「未使用的后端接口」；
 * - 两个都是**设计文档里规划中、但功能还没上线**的功能，功能上线时按
 *   `docs/collections-archive/README.md` 的步骤重建即可（配置已归档在那里）。
 *
 * ⚠️ **为什么这个迁移是手写的**（不是 `migrate:create` 生成的）：
 * 上一批迁移（`20261103_161500`、`20261103_174500`）是手写 SQL、**没留 .json 快照**，
 * 于是 diff 引擎拿更早的快照当基线，生成了一批「库里早就有了」的语句：
 * `ADD COLUMN "reviewer_id_id"`（库里已有 → 重复列报错）、
 * `DROP TABLE "activity_settings_expense_categories_items"`（早删过了 → 表不存在报错）。
 * 直接跑那份自动生成的迁移会**失败**。
 * 这里改成：只保留该删的东西，且全部带 `IF EXISTS`，在「已删过」「没删过」的库上都能安全跑。
 * （顺带修好了快照基线：本次迁移的 .json 是按当前代码生成的，后续 `migrate:create` 不再漂移。）
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Payload 的版本锁表里对这两个集合的外键
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_opportunities_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_toolkits_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_opportunities_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_toolkits_id_idx";

    -- 集合本身（toolkits_rels 是它的上传关系表）
    DROP TABLE IF EXISTS "toolkits_rels" CASCADE;
    DROP TABLE IF EXISTS "toolkits" CASCADE;
    DROP TABLE IF EXISTS "opportunities" CASCADE;

    -- 版本锁表上对应的两列
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "opportunities_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "toolkits_id";

    -- opportunities.type 的枚举类型
    DROP TYPE IF EXISTS "public"."enum_opportunities_type";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE IF NOT EXISTS "public"."enum_opportunities_type" AS ENUM('job', 'mentor', 'resource', 'partnership');

    CREATE TABLE IF NOT EXISTS "opportunities" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "org" varchar NOT NULL,
      "type" "enum_opportunities_type" DEFAULT 'job',
      "region" varchar,
      "description" varchar NOT NULL,
      "contact" varchar,
      "deadline" timestamp(3) with time zone,
      "is_open" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "toolkits" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "cohort_id" integer,
      "summary" varchar NOT NULL,
      "body" jsonb,
      "reusable" boolean DEFAULT true,
      "published_at" timestamp(3) with time zone,
      "author_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "toolkits_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "media_id" integer
    );

    CREATE INDEX IF NOT EXISTS "opportunities_type_idx" ON "opportunities" USING btree ("type");
    CREATE INDEX IF NOT EXISTS "opportunities_updated_at_idx" ON "opportunities" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "opportunities_created_at_idx" ON "opportunities" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "toolkits_slug_idx" ON "toolkits" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "toolkits_cohort_idx" ON "toolkits" USING btree ("cohort_id");
    CREATE INDEX IF NOT EXISTS "toolkits_author_idx" ON "toolkits" USING btree ("author_id");
    CREATE INDEX IF NOT EXISTS "toolkits_updated_at_idx" ON "toolkits" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "toolkits_created_at_idx" ON "toolkits" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "toolkits_rels_order_idx" ON "toolkits_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "toolkits_rels_parent_idx" ON "toolkits_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "toolkits_rels_path_idx" ON "toolkits_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "toolkits_rels_media_id_idx" ON "toolkits_rels" USING btree ("media_id");

    ALTER TABLE "toolkits" ADD CONSTRAINT "toolkits_cohort_id_cohorts_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "toolkits" ADD CONSTRAINT "toolkits_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "toolkits_rels" ADD CONSTRAINT "toolkits_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "toolkits"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "toolkits_rels" ADD CONSTRAINT "toolkits_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "opportunities_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "toolkits_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_opportunities_id_idx" ON "payload_locked_documents_rels" USING btree ("opportunities_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_toolkits_id_idx" ON "payload_locked_documents_rels" USING btree ("toolkits_id");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "opportunities"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_toolkits_fk" FOREIGN KEY ("toolkits_id") REFERENCES "toolkits"("id") ON DELETE cascade ON UPDATE no action;
  `)
}
