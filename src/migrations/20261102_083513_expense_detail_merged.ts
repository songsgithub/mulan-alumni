import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_plans_budget_items" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "activity_reports_expense_items" ALTER COLUMN "description" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_plans_budget_items" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "activity_reports_expense_items" ALTER COLUMN "description" SET NOT NULL;`)
}
