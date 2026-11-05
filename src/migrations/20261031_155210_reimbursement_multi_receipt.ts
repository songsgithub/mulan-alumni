import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 一笔支出可以附**多个**凭证（原来一个），报销单加**版本追溯**（像活动申请那样）。
 *
 * 迁移分三步走，顺序不能换：
 * 1. 建表 / 加列（reimbursements_versions、reimbursements_rels、activity_reports_rels.finance_evidence_id…）；
 * 2. **搬数据**：旧的 receipt_id 挪进关联表（path 指到具体那一行明细）；
 * 3. 删掉旧的两列 receipt_id。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ① 建表 / 加列
  await db.execute(sql`
   CREATE TABLE "reimbursements_versions" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"no" numeric NOT NULL,
   	"submitted_at" timestamp(3) with time zone,
   	"submitter_id" integer,
   	"submitter_name" varchar,
   	"snapshot" jsonb
  );

   CREATE TABLE "reimbursements_rels" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order" integer,
   	"parent_id" integer NOT NULL,
   	"path" varchar NOT NULL,
   	"finance_evidence_id" integer
  );

   ALTER TABLE "activity_reports_expense_items" DROP CONSTRAINT "activity_reports_expense_items_receipt_id_finance_evidence_id_fk";

   ALTER TABLE "reimbursements_items" DROP CONSTRAINT "reimbursements_items_receipt_id_finance_evidence_id_fk";

   DROP INDEX "activity_reports_expense_items_receipt_idx";
   DROP INDEX "reimbursements_items_receipt_idx";
   ALTER TABLE "activity_reports_rels" ADD COLUMN "finance_evidence_id" integer;
   ALTER TABLE "reimbursements_reviews" ADD COLUMN "version" numeric;
   ALTER TABLE "reimbursements_versions" ADD CONSTRAINT "reimbursements_versions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "reimbursements_versions" ADD CONSTRAINT "reimbursements_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "reimbursements_rels" ADD CONSTRAINT "reimbursements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "reimbursements_rels" ADD CONSTRAINT "reimbursements_rels_finance_evidence_fk" FOREIGN KEY ("finance_evidence_id") REFERENCES "public"."finance_evidence"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "reimbursements_versions_order_idx" ON "reimbursements_versions" USING btree ("_order");
   CREATE INDEX "reimbursements_versions_parent_id_idx" ON "reimbursements_versions" USING btree ("_parent_id");
   CREATE INDEX "reimbursements_versions_submitter_idx" ON "reimbursements_versions" USING btree ("submitter_id");
   CREATE INDEX "reimbursements_rels_order_idx" ON "reimbursements_rels" USING btree ("order");
   CREATE INDEX "reimbursements_rels_parent_idx" ON "reimbursements_rels" USING btree ("parent_id");
   CREATE INDEX "reimbursements_rels_path_idx" ON "reimbursements_rels" USING btree ("path");
   CREATE INDEX "reimbursements_rels_finance_evidence_id_idx" ON "reimbursements_rels" USING btree ("finance_evidence_id");
   ALTER TABLE "activity_reports_rels" ADD CONSTRAINT "activity_reports_rels_finance_evidence_fk" FOREIGN KEY ("finance_evidence_id") REFERENCES "public"."finance_evidence"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "activity_reports_rels_finance_evidence_id_idx" ON "activity_reports_rels" USING btree ("finance_evidence_id");`)

  // ② 搬数据：原来"一笔支出 = 一个凭证"，现在一行支出可以附多个
  await db.execute(sql`
   INSERT INTO "activity_reports_rels" ("order", "parent_id", "path", "finance_evidence_id")
   SELECT 1, e."_parent_id",
          'expenseItems.' || (ROW_NUMBER() OVER (PARTITION BY e."_parent_id" ORDER BY e."_order") - 1) || '.receipt',
          e."receipt_id"
   FROM "activity_reports_expense_items" e
   WHERE e."receipt_id" IS NOT NULL;

   INSERT INTO "reimbursements_rels" ("order", "parent_id", "path", "finance_evidence_id")
   SELECT 1, i."_parent_id",
          'items.' || (ROW_NUMBER() OVER (PARTITION BY i."_parent_id" ORDER BY i."_order") - 1) || '.receipt',
          i."receipt_id"
   FROM "reimbursements_items" i
   WHERE i."receipt_id" IS NOT NULL;`)

  // ③ 删旧列
  await db.execute(sql`
   ALTER TABLE "activity_reports_expense_items" DROP COLUMN "receipt_id";
   ALTER TABLE "reimbursements_items" DROP COLUMN "receipt_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // ① 把旧列加回来（先可空，搬完数据再补 NOT NULL）
  await db.execute(sql`
   ALTER TABLE "activity_reports_expense_items" ADD COLUMN "receipt_id" integer;
   ALTER TABLE "reimbursements_items" ADD COLUMN "receipt_id" integer;`)

  // ② 多附件压回"每行第一个"
  await db.execute(sql`
   UPDATE "activity_reports_expense_items" e
   SET "receipt_id" = r."finance_evidence_id"
   FROM "activity_reports_rels" r
   WHERE r."path" LIKE 'expenseItems.' || e."_order" - 1 || '.receipt' AND r."finance_evidence_id" IS NOT NULL;

   UPDATE "reimbursements_items" i
   SET "receipt_id" = r."finance_evidence_id"
   FROM "reimbursements_rels" r
   WHERE r."path" LIKE 'items.' || i."_order" - 1 || '.receipt' AND r."finance_evidence_id" IS NOT NULL;`)

  // ③ 收尾
  await db.execute(sql`
   ALTER TABLE "reimbursements_versions" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "reimbursements_rels" DISABLE ROW LEVEL SECURITY;
   DROP TABLE "reimbursements_versions" CASCADE;
   DROP TABLE "reimbursements_rels" CASCADE;
   ALTER TABLE "activity_reports_rels" DROP CONSTRAINT "activity_reports_rels_finance_evidence_fk";
   DROP INDEX "activity_reports_rels_finance_evidence_id_idx";
   ALTER TABLE "activity_reports_expense_items" ADD CONSTRAINT "activity_reports_expense_items_receipt_id_finance_evidence_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."finance_evidence"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "reimbursements_items" ADD CONSTRAINT "reimbursements_items_receipt_id_finance_evidence_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."finance_evidence"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "activity_reports_expense_items_receipt_idx" ON "activity_reports_expense_items" USING btree ("receipt_id");
   CREATE INDEX "reimbursements_items_receipt_idx" ON "reimbursements_items" USING btree ("receipt_id");
   ALTER TABLE "activity_reports_expense_items" ALTER COLUMN "receipt_id" SET NOT NULL;
   ALTER TABLE "reimbursements_items" ALTER COLUMN "receipt_id" SET NOT NULL;
   ALTER TABLE "activity_reports_rels" DROP COLUMN "finance_evidence_id";
   ALTER TABLE "reimbursements_reviews" DROP COLUMN "version";`)
}
