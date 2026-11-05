import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "activity_settings_change_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"by_id" integer,
  	"by_name" varchar,
  	"summary" varchar
  );
  
  ALTER TABLE "activity_settings_change_log" ADD CONSTRAINT "activity_settings_change_log_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_settings_change_log" ADD CONSTRAINT "activity_settings_change_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_settings_change_log_order_idx" ON "activity_settings_change_log" USING btree ("_order");
  CREATE INDEX "activity_settings_change_log_parent_id_idx" ON "activity_settings_change_log" USING btree ("_parent_id");
  CREATE INDEX "activity_settings_change_log_by_idx" ON "activity_settings_change_log" USING btree ("by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "activity_settings_change_log" CASCADE;`)
}
