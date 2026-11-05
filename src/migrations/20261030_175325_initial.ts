import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('cohortLead', 'projectTeam');
  CREATE TYPE "public"."enum_users_program" AS ENUM('go-mulan', 'a-idol', 'homestay-manager', 'other');
  CREATE TYPE "public"."enum_users_status" AS ENUM('active', 'disabled');
  CREATE TYPE "public"."enum_invitation_links_purpose" AS ENUM('create-cohort', 'transfer-lead');
  CREATE TYPE "public"."enum_invitation_links_status" AS ENUM('active', 'used', 'revoked', 'expired');
  CREATE TYPE "public"."enum_cohorts_category" AS ENUM('go-mulan', 'a-idol', 'homestay-manager');
  CREATE TYPE "public"."enum_cohorts_status" AS ENUM('active', 'closed');
  CREATE TYPE "public"."enum_activity_plans_budget_items_tier" AS ENUM('open', 'confirm');
  CREATE TYPE "public"."enum_activity_plans_reviews_action" AS ENUM('submitted', 'approved', 'rejected', 'revision_required', 'closed');
  CREATE TYPE "public"."enum_activity_plans_form" AS ENUM('offline', 'online', 'hybrid');
  CREATE TYPE "public"."enum_activity_plans_kind" AS ENUM('技能提升类', 'AI素养类', '健康科普类', '生活成长类');
  CREATE TYPE "public"."enum_activity_plans_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'implemented', 'closed');
  CREATE TYPE "public"."enum_activity_reports_attendees_role" AS ENUM('leader', 'deputy', 'resource', 'materials', 'media', 'core', 'member');
  CREATE TYPE "public"."enum_activity_reports_status" AS ENUM('submitted', 'accepted', 'revision_required');
  CREATE TYPE "public"."enum_reimbursements_items_receipt_type" AS ENUM('invoice', 'receipt', 'paymentScreenshot', 'other');
  CREATE TYPE "public"."enum_reimbursements_reviews_action" AS ENUM('approved', 'rejected');
  CREATE TYPE "public"."enum_reimbursements_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'paid');
  CREATE TYPE "public"."enum_payments_method" AS ENUM('bank', 'third_party', 'other');
  CREATE TYPE "public"."enum_payments_status" AS ENUM('pending', 'processing', 'paid', 'failed');
  CREATE TYPE "public"."enum_resources_type" AS ENUM('doc', 'video');
  CREATE TYPE "public"."enum_resources_category" AS ENUM('vi', 'template', 'guide', 'policy');
  CREATE TYPE "public"."enum_publications_type" AS ENUM('event', 'story', 'template');
  CREATE TYPE "public"."enum_publications_kind" AS ENUM('技能提升类', 'AI素养类', '健康科普类', '生活成长类');
  CREATE TYPE "public"."enum_opportunities_type" AS ENUM('job', 'mentor', 'resource', 'partnership');
  CREATE TYPE "public"."enum_media_visibility" AS ENUM('public', 'internal');
  CREATE TYPE "public"."enum_finance_evidence_kind" AS ENUM('invoice', 'receipt', 'paymentScreenshot', 'other');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"program" "enum_users_program" DEFAULT 'other',
  	"region_province" varchar,
  	"region_province_code" varchar,
  	"region_city" varchar,
  	"region_city_code" varchar,
  	"region_district" varchar,
  	"region_district_code" varchar,
  	"bio" varchar,
  	"avatar_id" integer,
  	"status" "enum_users_status" DEFAULT 'active',
  	"joined_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "ops_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "ops_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"last_login_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "invitation_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"purpose" "enum_invitation_links_purpose" DEFAULT 'create-cohort' NOT NULL,
  	"email" varchar,
  	"cohort_id" integer,
  	"note" varchar,
  	"invited_by_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"status" "enum_invitation_links_status" DEFAULT 'active',
  	"used_at" timestamp(3) with time zone,
  	"used_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "password_resets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "annual_budget_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"default_amount" numeric NOT NULL,
  	"note" varchar,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cohort_budgets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cohort_id" integer NOT NULL,
  	"year" numeric NOT NULL,
  	"amount" numeric NOT NULL,
  	"note" varchar,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cohorts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "cohorts_leader_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"from" timestamp(3) with time zone NOT NULL,
  	"to" timestamp(3) with time zone
  );
  
  CREATE TABLE "cohorts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"region" varchar,
  	"category" "enum_cohorts_category" DEFAULT 'go-mulan' NOT NULL,
  	"location_province" varchar,
  	"location_province_code" varchar,
  	"location_city" varchar,
  	"location_city_code" varchar,
  	"location_district" varchar,
  	"location_district_code" varchar,
  	"theme" varchar,
  	"leader_id" integer,
  	"team_vice_leader" varchar,
  	"team_resource_liaison" varchar,
  	"team_materials" varchar,
  	"team_media" varchar,
  	"status" "enum_cohorts_status" DEFAULT 'active',
  	"dissolved_at" timestamp(3) with time zone,
  	"is_public" boolean DEFAULT true,
  	"description" varchar,
  	"cover_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_plans_budget_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" varchar NOT NULL,
  	"item" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"tier" "enum_activity_plans_budget_items_tier" DEFAULT 'open',
  	"amount" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "activity_plans_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reviewer_id" integer,
  	"reviewer_name" varchar,
  	"action" "enum_activity_plans_reviews_action",
  	"comment" varchar,
  	"at" timestamp(3) with time zone,
  	"version" numeric
  );
  
  CREATE TABLE "activity_plans_versions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"no" numeric NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"submitter_id" integer,
  	"submitter_name" varchar,
  	"snapshot" jsonb
  );
  
  CREATE TABLE "activity_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"cohort_id" integer NOT NULL,
  	"proposer_id" integer,
  	"applicant_name" varchar,
  	"form" "enum_activity_plans_form" DEFAULT 'offline',
  	"theme" varchar,
  	"kind" "enum_activity_plans_kind",
  	"planned_at" timestamp(3) with time zone,
  	"location" varchar,
  	"goals" varchar,
  	"participants" numeric DEFAULT 0,
  	"budget_total" numeric DEFAULT 0,
  	"budget_per_person" numeric DEFAULT 0,
  	"rule_budget_max" numeric,
  	"rule_participants_min" numeric,
  	"status" "enum_activity_plans_status" DEFAULT 'draft',
  	"submitted_at" timestamp(3) with time zone,
  	"approved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_plans_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "activity_reports_expense_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" varchar NOT NULL,
  	"item" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"receipt_id" integer NOT NULL,
  	"receipt_name" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "activity_reports_attendees" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"organization" varchar,
  	"position" varchar,
  	"phone" varchar,
  	"role" "enum_activity_reports_attendees_role" DEFAULT 'core',
  	"signed" boolean DEFAULT false
  );
  
  CREATE TABLE "activity_reports_feelings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"member_name" varchar NOT NULL,
  	"content" varchar NOT NULL
  );
  
  CREATE TABLE "activity_reports_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "activity_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"plan_id" integer NOT NULL,
  	"cohort_id" integer NOT NULL,
  	"submitted_by_id" integer,
  	"theme" varchar,
  	"location" varchar,
  	"actual_at" timestamp(3) with time zone NOT NULL,
  	"actual_start" varchar,
  	"actual_end" varchar,
  	"actual_participants" numeric DEFAULT 0,
  	"actual_spending" numeric DEFAULT 0,
  	"summary" varchar NOT NULL,
  	"signup_sheet_id" integer,
  	"highlights" varchar,
  	"survey_satisfaction" numeric,
  	"survey_gain" varchar,
  	"survey_suggestions" varchar,
  	"recommended_for_publish" boolean DEFAULT false,
  	"recommended_note" varchar,
  	"published_as_id" integer,
  	"status" "enum_activity_reports_status" DEFAULT 'submitted',
  	"revision_note" varchar,
  	"submitted_at" timestamp(3) with time zone,
  	"overdue_days" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_reports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "reimbursements_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" varchar,
  	"item" varchar NOT NULL,
  	"description" varchar,
  	"amount" numeric NOT NULL,
  	"receipt_type" "enum_reimbursements_items_receipt_type" DEFAULT 'invoice' NOT NULL,
  	"receipt_id" integer NOT NULL,
  	"receipt_name" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "reimbursements_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reviewer_id" integer,
  	"reviewer_name" varchar,
  	"action" "enum_reimbursements_reviews_action",
  	"comment" varchar,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "reimbursements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"report_id" integer,
  	"plan_id" integer NOT NULL,
  	"cohort_id" integer,
  	"applicant_id" integer,
  	"total" numeric DEFAULT 0,
  	"approved_amount" numeric DEFAULT 0,
  	"status" "enum_reimbursements_status" DEFAULT 'draft',
  	"approver_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"review_note" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"payment_ref" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"recipient_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"link" varchar,
  	"read" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reimbursement_id" integer NOT NULL,
  	"payee" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"method" "enum_payments_method" DEFAULT 'bank',
  	"status" "enum_payments_status" DEFAULT 'pending',
  	"scheduled_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"external_ref" varchar,
  	"voucher_id" integer,
  	"operator_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "resources_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "enum_resources_type" DEFAULT 'doc' NOT NULL,
  	"category" "enum_resources_category" DEFAULT 'guide' NOT NULL,
  	"summary" varchar,
  	"body" jsonb,
  	"url" varchar,
  	"file_id" integer,
  	"cover_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"related_cohort_id" integer,
  	"author_id" integer,
  	"downloads" numeric DEFAULT 0,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "publications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "enum_publications_type" DEFAULT 'event',
  	"kind" "enum_publications_kind",
  	"event_date" timestamp(3) with time zone,
  	"event_location" varchar,
  	"attendee_count" numeric,
  	"related_plan_id" integer,
  	"related_report_id" integer,
  	"related_resource_id" integer,
  	"related_cohort_id" integer,
  	"file_id" integer,
  	"byline" varchar,
  	"excerpt" varchar NOT NULL,
  	"content" jsonb,
  	"cover_id" integer,
  	"featured" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"author_id" integer,
  	"views" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opportunities" (
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
  
  CREATE TABLE "toolkits" (
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
  
  CREATE TABLE "toolkits_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"visibility" "enum_media_visibility" DEFAULT 'public',
  	"cohort_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "finance_evidence" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_finance_evidence_kind" DEFAULT 'invoice',
  	"cohort_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"ops_users_id" integer,
  	"invitation_links_id" integer,
  	"password_resets_id" integer,
  	"annual_budget_settings_id" integer,
  	"cohort_budgets_id" integer,
  	"cohorts_id" integer,
  	"activity_plans_id" integer,
  	"activity_reports_id" integer,
  	"reimbursements_id" integer,
  	"notifications_id" integer,
  	"payments_id" integer,
  	"resources_id" integer,
  	"publications_id" integer,
  	"opportunities_id" integer,
  	"toolkits_id" integer,
  	"media_id" integer,
  	"finance_evidence_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"ops_users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"budget_max" numeric DEFAULT 500 NOT NULL,
  	"participants_min" numeric DEFAULT 1 NOT NULL,
  	"plan_reviewer_id" integer,
  	"reimbursement_reviewer_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ops_users_sessions" ADD CONSTRAINT "ops_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ops_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "annual_budget_settings" ADD CONSTRAINT "annual_budget_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cohort_budgets" ADD CONSTRAINT "cohort_budgets_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cohort_budgets" ADD CONSTRAINT "cohort_budgets_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cohorts_tags" ADD CONSTRAINT "cohorts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cohorts_leader_terms" ADD CONSTRAINT "cohorts_leader_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cohorts_leader_terms" ADD CONSTRAINT "cohorts_leader_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_plans_budget_items" ADD CONSTRAINT "activity_plans_budget_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_plans_reviews" ADD CONSTRAINT "activity_plans_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_plans_reviews" ADD CONSTRAINT "activity_plans_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_plans_versions" ADD CONSTRAINT "activity_plans_versions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_plans_versions" ADD CONSTRAINT "activity_plans_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_plans_rels" ADD CONSTRAINT "activity_plans_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_plans_rels" ADD CONSTRAINT "activity_plans_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports_expense_items" ADD CONSTRAINT "activity_reports_expense_items_receipt_id_finance_evidence_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."finance_evidence"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports_expense_items" ADD CONSTRAINT "activity_reports_expense_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports_attendees" ADD CONSTRAINT "activity_reports_attendees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports_feelings" ADD CONSTRAINT "activity_reports_feelings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports_materials" ADD CONSTRAINT "activity_reports_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports" ADD CONSTRAINT "activity_reports_plan_id_activity_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."activity_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports" ADD CONSTRAINT "activity_reports_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports" ADD CONSTRAINT "activity_reports_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports" ADD CONSTRAINT "activity_reports_signup_sheet_id_media_id_fk" FOREIGN KEY ("signup_sheet_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports" ADD CONSTRAINT "activity_reports_published_as_id_publications_id_fk" FOREIGN KEY ("published_as_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_reports_rels" ADD CONSTRAINT "activity_reports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_reports_rels" ADD CONSTRAINT "activity_reports_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reimbursements_items" ADD CONSTRAINT "reimbursements_items_receipt_id_finance_evidence_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."finance_evidence"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements_items" ADD CONSTRAINT "reimbursements_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reimbursements_reviews" ADD CONSTRAINT "reimbursements_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements_reviews" ADD CONSTRAINT "reimbursements_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_report_id_activity_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."activity_reports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_plan_id_activity_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."activity_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_reimbursement_id_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."reimbursements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_voucher_id_finance_evidence_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."finance_evidence"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources_tags" ADD CONSTRAINT "resources_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_related_cohort_id_cohorts_id_fk" FOREIGN KEY ("related_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_related_plan_id_activity_plans_id_fk" FOREIGN KEY ("related_plan_id") REFERENCES "public"."activity_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_related_report_id_activity_reports_id_fk" FOREIGN KEY ("related_report_id") REFERENCES "public"."activity_reports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_related_resource_id_resources_id_fk" FOREIGN KEY ("related_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_related_cohort_id_cohorts_id_fk" FOREIGN KEY ("related_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "toolkits" ADD CONSTRAINT "toolkits_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "toolkits" ADD CONSTRAINT "toolkits_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "toolkits_rels" ADD CONSTRAINT "toolkits_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."toolkits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "toolkits_rels" ADD CONSTRAINT "toolkits_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "finance_evidence" ADD CONSTRAINT "finance_evidence_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ops_users_fk" FOREIGN KEY ("ops_users_id") REFERENCES "public"."ops_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invitation_links_fk" FOREIGN KEY ("invitation_links_id") REFERENCES "public"."invitation_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_password_resets_fk" FOREIGN KEY ("password_resets_id") REFERENCES "public"."password_resets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_annual_budget_settings_fk" FOREIGN KEY ("annual_budget_settings_id") REFERENCES "public"."annual_budget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cohort_budgets_fk" FOREIGN KEY ("cohort_budgets_id") REFERENCES "public"."cohort_budgets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cohorts_fk" FOREIGN KEY ("cohorts_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_plans_fk" FOREIGN KEY ("activity_plans_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_reports_fk" FOREIGN KEY ("activity_reports_id") REFERENCES "public"."activity_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reimbursements_fk" FOREIGN KEY ("reimbursements_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_toolkits_fk" FOREIGN KEY ("toolkits_id") REFERENCES "public"."toolkits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_evidence_fk" FOREIGN KEY ("finance_evidence_id") REFERENCES "public"."finance_evidence"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_ops_users_fk" FOREIGN KEY ("ops_users_id") REFERENCES "public"."ops_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_settings" ADD CONSTRAINT "activity_settings_plan_reviewer_id_users_id_fk" FOREIGN KEY ("plan_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_settings" ADD CONSTRAINT "activity_settings_reimbursement_reviewer_id_users_id_fk" FOREIGN KEY ("reimbursement_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "ops_users_sessions_order_idx" ON "ops_users_sessions" USING btree ("_order");
  CREATE INDEX "ops_users_sessions_parent_id_idx" ON "ops_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "ops_users_updated_at_idx" ON "ops_users" USING btree ("updated_at");
  CREATE INDEX "ops_users_created_at_idx" ON "ops_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "ops_users_email_idx" ON "ops_users" USING btree ("email");
  CREATE UNIQUE INDEX "invitation_links_token_idx" ON "invitation_links" USING btree ("token");
  CREATE INDEX "invitation_links_purpose_idx" ON "invitation_links" USING btree ("purpose");
  CREATE INDEX "invitation_links_email_idx" ON "invitation_links" USING btree ("email");
  CREATE INDEX "invitation_links_cohort_idx" ON "invitation_links" USING btree ("cohort_id");
  CREATE INDEX "invitation_links_invited_by_idx" ON "invitation_links" USING btree ("invited_by_id");
  CREATE INDEX "invitation_links_status_idx" ON "invitation_links" USING btree ("status");
  CREATE INDEX "invitation_links_used_by_idx" ON "invitation_links" USING btree ("used_by_id");
  CREATE INDEX "invitation_links_updated_at_idx" ON "invitation_links" USING btree ("updated_at");
  CREATE INDEX "invitation_links_created_at_idx" ON "invitation_links" USING btree ("created_at");
  CREATE UNIQUE INDEX "password_resets_token_idx" ON "password_resets" USING btree ("token");
  CREATE INDEX "password_resets_user_idx" ON "password_resets" USING btree ("user_id");
  CREATE INDEX "password_resets_created_by_idx" ON "password_resets" USING btree ("created_by_id");
  CREATE INDEX "password_resets_updated_at_idx" ON "password_resets" USING btree ("updated_at");
  CREATE INDEX "password_resets_created_at_idx" ON "password_resets" USING btree ("created_at");
  CREATE UNIQUE INDEX "annual_budget_settings_year_idx" ON "annual_budget_settings" USING btree ("year");
  CREATE INDEX "annual_budget_settings_updated_by_idx" ON "annual_budget_settings" USING btree ("updated_by_id");
  CREATE INDEX "annual_budget_settings_updated_at_idx" ON "annual_budget_settings" USING btree ("updated_at");
  CREATE INDEX "annual_budget_settings_created_at_idx" ON "annual_budget_settings" USING btree ("created_at");
  CREATE INDEX "cohort_budgets_cohort_idx" ON "cohort_budgets" USING btree ("cohort_id");
  CREATE INDEX "cohort_budgets_year_idx" ON "cohort_budgets" USING btree ("year");
  CREATE INDEX "cohort_budgets_updated_by_idx" ON "cohort_budgets" USING btree ("updated_by_id");
  CREATE INDEX "cohort_budgets_updated_at_idx" ON "cohort_budgets" USING btree ("updated_at");
  CREATE INDEX "cohort_budgets_created_at_idx" ON "cohort_budgets" USING btree ("created_at");
  CREATE INDEX "cohorts_tags_order_idx" ON "cohorts_tags" USING btree ("_order");
  CREATE INDEX "cohorts_tags_parent_id_idx" ON "cohorts_tags" USING btree ("_parent_id");
  CREATE INDEX "cohorts_leader_terms_order_idx" ON "cohorts_leader_terms" USING btree ("_order");
  CREATE INDEX "cohorts_leader_terms_parent_id_idx" ON "cohorts_leader_terms" USING btree ("_parent_id");
  CREATE INDEX "cohorts_leader_terms_user_idx" ON "cohorts_leader_terms" USING btree ("user_id");
  CREATE UNIQUE INDEX "cohorts_slug_idx" ON "cohorts" USING btree ("slug");
  CREATE INDEX "cohorts_category_idx" ON "cohorts" USING btree ("category");
  CREATE INDEX "cohorts_leader_idx" ON "cohorts" USING btree ("leader_id");
  CREATE INDEX "cohorts_cover_idx" ON "cohorts" USING btree ("cover_id");
  CREATE INDEX "cohorts_updated_at_idx" ON "cohorts" USING btree ("updated_at");
  CREATE INDEX "cohorts_created_at_idx" ON "cohorts" USING btree ("created_at");
  CREATE INDEX "activity_plans_budget_items_order_idx" ON "activity_plans_budget_items" USING btree ("_order");
  CREATE INDEX "activity_plans_budget_items_parent_id_idx" ON "activity_plans_budget_items" USING btree ("_parent_id");
  CREATE INDEX "activity_plans_reviews_order_idx" ON "activity_plans_reviews" USING btree ("_order");
  CREATE INDEX "activity_plans_reviews_parent_id_idx" ON "activity_plans_reviews" USING btree ("_parent_id");
  CREATE INDEX "activity_plans_reviews_reviewer_idx" ON "activity_plans_reviews" USING btree ("reviewer_id");
  CREATE INDEX "activity_plans_versions_order_idx" ON "activity_plans_versions" USING btree ("_order");
  CREATE INDEX "activity_plans_versions_parent_id_idx" ON "activity_plans_versions" USING btree ("_parent_id");
  CREATE INDEX "activity_plans_versions_submitter_idx" ON "activity_plans_versions" USING btree ("submitter_id");
  CREATE UNIQUE INDEX "activity_plans_slug_idx" ON "activity_plans" USING btree ("slug");
  CREATE INDEX "activity_plans_cohort_idx" ON "activity_plans" USING btree ("cohort_id");
  CREATE INDEX "activity_plans_proposer_idx" ON "activity_plans" USING btree ("proposer_id");
  CREATE INDEX "activity_plans_status_idx" ON "activity_plans" USING btree ("status");
  CREATE INDEX "activity_plans_updated_at_idx" ON "activity_plans" USING btree ("updated_at");
  CREATE INDEX "activity_plans_created_at_idx" ON "activity_plans" USING btree ("created_at");
  CREATE INDEX "activity_plans_rels_order_idx" ON "activity_plans_rels" USING btree ("order");
  CREATE INDEX "activity_plans_rels_parent_idx" ON "activity_plans_rels" USING btree ("parent_id");
  CREATE INDEX "activity_plans_rels_path_idx" ON "activity_plans_rels" USING btree ("path");
  CREATE INDEX "activity_plans_rels_media_id_idx" ON "activity_plans_rels" USING btree ("media_id");
  CREATE INDEX "activity_reports_expense_items_order_idx" ON "activity_reports_expense_items" USING btree ("_order");
  CREATE INDEX "activity_reports_expense_items_parent_id_idx" ON "activity_reports_expense_items" USING btree ("_parent_id");
  CREATE INDEX "activity_reports_expense_items_receipt_idx" ON "activity_reports_expense_items" USING btree ("receipt_id");
  CREATE INDEX "activity_reports_attendees_order_idx" ON "activity_reports_attendees" USING btree ("_order");
  CREATE INDEX "activity_reports_attendees_parent_id_idx" ON "activity_reports_attendees" USING btree ("_parent_id");
  CREATE INDEX "activity_reports_feelings_order_idx" ON "activity_reports_feelings" USING btree ("_order");
  CREATE INDEX "activity_reports_feelings_parent_id_idx" ON "activity_reports_feelings" USING btree ("_parent_id");
  CREATE INDEX "activity_reports_materials_order_idx" ON "activity_reports_materials" USING btree ("_order");
  CREATE INDEX "activity_reports_materials_parent_id_idx" ON "activity_reports_materials" USING btree ("_parent_id");
  CREATE INDEX "activity_reports_plan_idx" ON "activity_reports" USING btree ("plan_id");
  CREATE INDEX "activity_reports_cohort_idx" ON "activity_reports" USING btree ("cohort_id");
  CREATE INDEX "activity_reports_submitted_by_idx" ON "activity_reports" USING btree ("submitted_by_id");
  CREATE INDEX "activity_reports_signup_sheet_idx" ON "activity_reports" USING btree ("signup_sheet_id");
  CREATE INDEX "activity_reports_recommended_for_publish_idx" ON "activity_reports" USING btree ("recommended_for_publish");
  CREATE INDEX "activity_reports_published_as_idx" ON "activity_reports" USING btree ("published_as_id");
  CREATE INDEX "activity_reports_status_idx" ON "activity_reports" USING btree ("status");
  CREATE INDEX "activity_reports_updated_at_idx" ON "activity_reports" USING btree ("updated_at");
  CREATE INDEX "activity_reports_created_at_idx" ON "activity_reports" USING btree ("created_at");
  CREATE INDEX "activity_reports_rels_order_idx" ON "activity_reports_rels" USING btree ("order");
  CREATE INDEX "activity_reports_rels_parent_idx" ON "activity_reports_rels" USING btree ("parent_id");
  CREATE INDEX "activity_reports_rels_path_idx" ON "activity_reports_rels" USING btree ("path");
  CREATE INDEX "activity_reports_rels_media_id_idx" ON "activity_reports_rels" USING btree ("media_id");
  CREATE INDEX "reimbursements_items_order_idx" ON "reimbursements_items" USING btree ("_order");
  CREATE INDEX "reimbursements_items_parent_id_idx" ON "reimbursements_items" USING btree ("_parent_id");
  CREATE INDEX "reimbursements_items_receipt_idx" ON "reimbursements_items" USING btree ("receipt_id");
  CREATE INDEX "reimbursements_reviews_order_idx" ON "reimbursements_reviews" USING btree ("_order");
  CREATE INDEX "reimbursements_reviews_parent_id_idx" ON "reimbursements_reviews" USING btree ("_parent_id");
  CREATE INDEX "reimbursements_reviews_reviewer_idx" ON "reimbursements_reviews" USING btree ("reviewer_id");
  CREATE INDEX "reimbursements_report_idx" ON "reimbursements" USING btree ("report_id");
  CREATE INDEX "reimbursements_plan_idx" ON "reimbursements" USING btree ("plan_id");
  CREATE INDEX "reimbursements_cohort_idx" ON "reimbursements" USING btree ("cohort_id");
  CREATE INDEX "reimbursements_applicant_idx" ON "reimbursements" USING btree ("applicant_id");
  CREATE INDEX "reimbursements_status_idx" ON "reimbursements" USING btree ("status");
  CREATE INDEX "reimbursements_approver_idx" ON "reimbursements" USING btree ("approver_id");
  CREATE INDEX "reimbursements_updated_at_idx" ON "reimbursements" USING btree ("updated_at");
  CREATE INDEX "reimbursements_created_at_idx" ON "reimbursements" USING btree ("created_at");
  CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
  CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "payments_reimbursement_idx" ON "payments" USING btree ("reimbursement_id");
  CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
  CREATE INDEX "payments_voucher_idx" ON "payments" USING btree ("voucher_id");
  CREATE INDEX "payments_operator_idx" ON "payments" USING btree ("operator_id");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "resources_tags_order_idx" ON "resources_tags" USING btree ("_order");
  CREATE INDEX "resources_tags_parent_id_idx" ON "resources_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "resources_slug_idx" ON "resources" USING btree ("slug");
  CREATE INDEX "resources_type_idx" ON "resources" USING btree ("type");
  CREATE INDEX "resources_file_idx" ON "resources" USING btree ("file_id");
  CREATE INDEX "resources_cover_idx" ON "resources" USING btree ("cover_id");
  CREATE INDEX "resources_related_cohort_idx" ON "resources" USING btree ("related_cohort_id");
  CREATE INDEX "resources_author_idx" ON "resources" USING btree ("author_id");
  CREATE INDEX "resources_updated_at_idx" ON "resources" USING btree ("updated_at");
  CREATE INDEX "resources_created_at_idx" ON "resources" USING btree ("created_at");
  CREATE UNIQUE INDEX "publications_slug_idx" ON "publications" USING btree ("slug");
  CREATE INDEX "publications_type_idx" ON "publications" USING btree ("type");
  CREATE INDEX "publications_event_date_idx" ON "publications" USING btree ("event_date");
  CREATE INDEX "publications_related_plan_idx" ON "publications" USING btree ("related_plan_id");
  CREATE INDEX "publications_related_report_idx" ON "publications" USING btree ("related_report_id");
  CREATE INDEX "publications_related_resource_idx" ON "publications" USING btree ("related_resource_id");
  CREATE INDEX "publications_related_cohort_idx" ON "publications" USING btree ("related_cohort_id");
  CREATE INDEX "publications_file_idx" ON "publications" USING btree ("file_id");
  CREATE INDEX "publications_cover_idx" ON "publications" USING btree ("cover_id");
  CREATE INDEX "publications_published_at_idx" ON "publications" USING btree ("published_at");
  CREATE INDEX "publications_author_idx" ON "publications" USING btree ("author_id");
  CREATE INDEX "publications_updated_at_idx" ON "publications" USING btree ("updated_at");
  CREATE INDEX "publications_created_at_idx" ON "publications" USING btree ("created_at");
  CREATE INDEX "opportunities_type_idx" ON "opportunities" USING btree ("type");
  CREATE INDEX "opportunities_updated_at_idx" ON "opportunities" USING btree ("updated_at");
  CREATE INDEX "opportunities_created_at_idx" ON "opportunities" USING btree ("created_at");
  CREATE UNIQUE INDEX "toolkits_slug_idx" ON "toolkits" USING btree ("slug");
  CREATE INDEX "toolkits_cohort_idx" ON "toolkits" USING btree ("cohort_id");
  CREATE INDEX "toolkits_author_idx" ON "toolkits" USING btree ("author_id");
  CREATE INDEX "toolkits_updated_at_idx" ON "toolkits" USING btree ("updated_at");
  CREATE INDEX "toolkits_created_at_idx" ON "toolkits" USING btree ("created_at");
  CREATE INDEX "toolkits_rels_order_idx" ON "toolkits_rels" USING btree ("order");
  CREATE INDEX "toolkits_rels_parent_idx" ON "toolkits_rels" USING btree ("parent_id");
  CREATE INDEX "toolkits_rels_path_idx" ON "toolkits_rels" USING btree ("path");
  CREATE INDEX "toolkits_rels_media_id_idx" ON "toolkits_rels" USING btree ("media_id");
  CREATE INDEX "media_visibility_idx" ON "media" USING btree ("visibility");
  CREATE INDEX "media_cohort_idx" ON "media" USING btree ("cohort_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "finance_evidence_kind_idx" ON "finance_evidence" USING btree ("kind");
  CREATE INDEX "finance_evidence_cohort_idx" ON "finance_evidence" USING btree ("cohort_id");
  CREATE INDEX "finance_evidence_updated_at_idx" ON "finance_evidence" USING btree ("updated_at");
  CREATE INDEX "finance_evidence_created_at_idx" ON "finance_evidence" USING btree ("created_at");
  CREATE UNIQUE INDEX "finance_evidence_filename_idx" ON "finance_evidence" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_ops_users_id_idx" ON "payload_locked_documents_rels" USING btree ("ops_users_id");
  CREATE INDEX "payload_locked_documents_rels_invitation_links_id_idx" ON "payload_locked_documents_rels" USING btree ("invitation_links_id");
  CREATE INDEX "payload_locked_documents_rels_password_resets_id_idx" ON "payload_locked_documents_rels" USING btree ("password_resets_id");
  CREATE INDEX "payload_locked_documents_rels_annual_budget_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("annual_budget_settings_id");
  CREATE INDEX "payload_locked_documents_rels_cohort_budgets_id_idx" ON "payload_locked_documents_rels" USING btree ("cohort_budgets_id");
  CREATE INDEX "payload_locked_documents_rels_cohorts_id_idx" ON "payload_locked_documents_rels" USING btree ("cohorts_id");
  CREATE INDEX "payload_locked_documents_rels_activity_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_plans_id");
  CREATE INDEX "payload_locked_documents_rels_activity_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_reports_id");
  CREATE INDEX "payload_locked_documents_rels_reimbursements_id_idx" ON "payload_locked_documents_rels" USING btree ("reimbursements_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_resources_id_idx" ON "payload_locked_documents_rels" USING btree ("resources_id");
  CREATE INDEX "payload_locked_documents_rels_publications_id_idx" ON "payload_locked_documents_rels" USING btree ("publications_id");
  CREATE INDEX "payload_locked_documents_rels_opportunities_id_idx" ON "payload_locked_documents_rels" USING btree ("opportunities_id");
  CREATE INDEX "payload_locked_documents_rels_toolkits_id_idx" ON "payload_locked_documents_rels" USING btree ("toolkits_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_finance_evidence_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_evidence_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_ops_users_id_idx" ON "payload_preferences_rels" USING btree ("ops_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "activity_settings_plan_reviewer_idx" ON "activity_settings" USING btree ("plan_reviewer_id");
  CREATE INDEX "activity_settings_reimbursement_reviewer_idx" ON "activity_settings" USING btree ("reimbursement_reviewer_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "ops_users_sessions" CASCADE;
  DROP TABLE "ops_users" CASCADE;
  DROP TABLE "invitation_links" CASCADE;
  DROP TABLE "password_resets" CASCADE;
  DROP TABLE "annual_budget_settings" CASCADE;
  DROP TABLE "cohort_budgets" CASCADE;
  DROP TABLE "cohorts_tags" CASCADE;
  DROP TABLE "cohorts_leader_terms" CASCADE;
  DROP TABLE "cohorts" CASCADE;
  DROP TABLE "activity_plans_budget_items" CASCADE;
  DROP TABLE "activity_plans_reviews" CASCADE;
  DROP TABLE "activity_plans_versions" CASCADE;
  DROP TABLE "activity_plans" CASCADE;
  DROP TABLE "activity_plans_rels" CASCADE;
  DROP TABLE "activity_reports_expense_items" CASCADE;
  DROP TABLE "activity_reports_attendees" CASCADE;
  DROP TABLE "activity_reports_feelings" CASCADE;
  DROP TABLE "activity_reports_materials" CASCADE;
  DROP TABLE "activity_reports" CASCADE;
  DROP TABLE "activity_reports_rels" CASCADE;
  DROP TABLE "reimbursements_items" CASCADE;
  DROP TABLE "reimbursements_reviews" CASCADE;
  DROP TABLE "reimbursements" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "resources_tags" CASCADE;
  DROP TABLE "resources" CASCADE;
  DROP TABLE "publications" CASCADE;
  DROP TABLE "opportunities" CASCADE;
  DROP TABLE "toolkits" CASCADE;
  DROP TABLE "toolkits_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "finance_evidence" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "activity_settings" CASCADE;
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_users_program";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_invitation_links_purpose";
  DROP TYPE "public"."enum_invitation_links_status";
  DROP TYPE "public"."enum_cohorts_category";
  DROP TYPE "public"."enum_cohorts_status";
  DROP TYPE "public"."enum_activity_plans_budget_items_tier";
  DROP TYPE "public"."enum_activity_plans_reviews_action";
  DROP TYPE "public"."enum_activity_plans_form";
  DROP TYPE "public"."enum_activity_plans_kind";
  DROP TYPE "public"."enum_activity_plans_status";
  DROP TYPE "public"."enum_activity_reports_attendees_role";
  DROP TYPE "public"."enum_activity_reports_status";
  DROP TYPE "public"."enum_reimbursements_items_receipt_type";
  DROP TYPE "public"."enum_reimbursements_reviews_action";
  DROP TYPE "public"."enum_reimbursements_status";
  DROP TYPE "public"."enum_payments_method";
  DROP TYPE "public"."enum_payments_status";
  DROP TYPE "public"."enum_resources_type";
  DROP TYPE "public"."enum_resources_category";
  DROP TYPE "public"."enum_publications_type";
  DROP TYPE "public"."enum_publications_kind";
  DROP TYPE "public"."enum_opportunities_type";
  DROP TYPE "public"."enum_media_visibility";
  DROP TYPE "public"."enum_finance_evidence_kind";`)
}
