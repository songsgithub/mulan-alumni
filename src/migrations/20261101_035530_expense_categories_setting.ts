import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "activity_settings_expense_categories_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL
  );
  
  CREATE TABLE "activity_settings_expense_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" varchar NOT NULL
  );
  
  ALTER TABLE "activity_settings_expense_categories_items" ADD CONSTRAINT "activity_settings_expense_categories_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_settings_expense_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_settings_expense_categories" ADD CONSTRAINT "activity_settings_expense_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_settings_expense_categories_items_order_idx" ON "activity_settings_expense_categories_items" USING btree ("_order");
  CREATE INDEX "activity_settings_expense_categories_items_parent_id_idx" ON "activity_settings_expense_categories_items" USING btree ("_parent_id");
  CREATE INDEX "activity_settings_expense_categories_order_idx" ON "activity_settings_expense_categories" USING btree ("_order");
  CREATE INDEX "activity_settings_expense_categories_parent_id_idx" ON "activity_settings_expense_categories" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "activity_settings_expense_categories_items" CASCADE;
  DROP TABLE "activity_settings_expense_categories" CASCADE;`)
}
