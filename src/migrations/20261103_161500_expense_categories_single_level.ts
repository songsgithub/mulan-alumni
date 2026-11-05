import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 2026-11-03 第五十一轮：费用类别**只留一级**，移除二级明细项。
 *
 * - `activity_settings_expense_categories_items`（二级明细项子表）整体删除；
 * - `activity_settings_expense_categories`（一级类别）保留原样，只是明细项没了。
 *
 * ⚠️ 历史数据不受影响：活动方案 / 反馈 / 报销单里存的是**类别名的快照**，
 *    不依赖这里的表结构，所以这次删表不会动到老记录。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "activity_settings_expense_categories_items";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "activity_settings_expense_categories_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar NOT NULL,
      "item" varchar NOT NULL,
      CONSTRAINT "activity_settings_expense_categories_items_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "activity_settings_expense_categories_items_order_idx" ON "activity_settings_expense_categories_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "activity_settings_expense_categories_items_parent_id_idx" ON "activity_settings_expense_categories_items" USING btree ("_parent_id");
    ALTER TABLE "activity_settings_expense_categories_items"
      ADD CONSTRAINT "activity_settings_expense_categories_items_parent_id_fkey"
      FOREIGN KEY ("_parent_id") REFERENCES "activity_settings_expense_categories"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  `)
}
