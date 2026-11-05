import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 2026-11-03 第五十一轮：报销单加**报销审核人快照**。
 *
 * - `reviewer_id_id`：报销单生成那一刻的报销审核负责人（`users` 关系）。
 *   为空表示当时未指定负责人 → 这一单**永远不流转**（不推送、不进待办、
 *   之后设了负责人也不回审）。
 * - `reviewer_name`：同一时刻的姓名快照（展示用，不用再查一次）。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "reviewer_id_id" integer;
    ALTER TABLE "reimbursements" ADD COLUMN IF NOT EXISTS "reviewer_name" character varying;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "reimbursements_reviewer_id_idx" ON "reimbursements" USING btree ("reviewer_id_id");
  `)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reimbursements_reviewer_id_id_fkey'
      ) THEN
        ALTER TABLE "reimbursements"
          ADD CONSTRAINT "reimbursements_reviewer_id_id_fkey"
          FOREIGN KEY ("reviewer_id_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reimbursements" DROP CONSTRAINT IF EXISTS "reimbursements_reviewer_id_id_fkey";
    DROP INDEX IF EXISTS "reimbursements_reviewer_id_idx";
    ALTER TABLE "reimbursements" DROP COLUMN IF EXISTS "reviewer_name";
    ALTER TABLE "reimbursements" DROP COLUMN IF EXISTS "reviewer_id_id";
  `)
}
