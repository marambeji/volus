import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1721498400000 implements MigrationInterface {
  name = 'InitialSchema1721498400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum types ──────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TYPE "leave_tracking_mode_enum" AS ENUM ('AVAILABLE_BALANCE', 'USAGE_YTD')
    `);
    await queryRunner.query(`
      CREATE TYPE "leave_policy_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE')
    `);
    await queryRunner.query(`
      CREATE TYPE "approval_workflow_status_enum" AS ENUM ('ACTIVE', 'INACTIVE')
    `);
    await queryRunner.query(`
      CREATE TYPE "approver_type_enum" AS ENUM ('MANAGER', 'MANAGERS_MANAGER', 'SPECIFIC_PERSON', 'HR')
    `);
    await queryRunner.query(`
      CREATE TYPE "accrual_interval_enum" AS ENUM ('MONTHLY', 'YEARLY')
    `);
    await queryRunner.query(`
      CREATE TYPE "cut_off_type_enum" AS ENUM ('FIXED_DATE', 'HIRE_DATE')
    `);
    await queryRunner.query(`
      CREATE TYPE "reset_type_enum" AS ENUM ('NONE', 'YEARLY', 'POLICY_CUTOFF')
    `);

    // ── Countries ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "countries" (
        "id"         uuid DEFAULT gen_random_uuid() NOT NULL,
        "name"       character varying(100) NOT NULL,
        "code"       character varying(3)   NOT NULL,
        "flag"       character varying(10)  NOT NULL,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"  TIMESTAMP,
        CONSTRAINT "PK_countries" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_countries_name" ON "countries" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_countries_code" ON "countries" ("code")`,
    );

    // ── Divisions ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "divisions" (
        "id"         uuid DEFAULT gen_random_uuid() NOT NULL,
        "name"       character varying(150) NOT NULL,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"  TIMESTAMP,
        CONSTRAINT "PK_divisions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_divisions_name" UNIQUE ("name")
      )
    `);

    // ── Leave Types ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id"            uuid DEFAULT gen_random_uuid() NOT NULL,
        "key"           character varying(50)  NOT NULL,
        "label"         character varying(100) NOT NULL,
        "trackingMode"  "leave_tracking_mode_enum" NOT NULL,
        "color"         character varying(20)  NOT NULL DEFAULT '#3B82F6',
        "displayOrder"  integer NOT NULL DEFAULT 0,
        "isActive"      boolean NOT NULL DEFAULT true,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"     TIMESTAMP,
        CONSTRAINT "PK_leave_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_leave_types_key" UNIQUE ("key")
      )
    `);

    // ── Approval Workflows ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "approval_workflows" (
        "id"         uuid DEFAULT gen_random_uuid() NOT NULL,
        "name"       character varying(150) NOT NULL,
        "status"     "approval_workflow_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"  TIMESTAMP,
        CONSTRAINT "PK_approval_workflows" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_approval_workflows_name" UNIQUE ("name")
      )
    `);

    // ── Approval Workflow Steps ─────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "approval_workflow_steps" (
        "id"                    uuid DEFAULT gen_random_uuid() NOT NULL,
        "workflow_id"           uuid NOT NULL,
        "step_order"            integer NOT NULL,
        "approver_type"         "approver_type_enum" NOT NULL,
        "specific_approver_id"  uuid,
        "is_required"           boolean NOT NULL DEFAULT true,
        "createdAt"             TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_workflow_steps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workflow_step_order" UNIQUE ("workflow_id", "step_order"),
        CONSTRAINT "FK_workflow_steps_workflow" FOREIGN KEY ("workflow_id")
          REFERENCES "approval_workflows"("id") ON DELETE CASCADE
      )
    `);

    // ── Public Holidays ─────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "public_holidays" (
        "id"           uuid DEFAULT gen_random_uuid() NOT NULL,
        "name"         character varying(150) NOT NULL,
        "date"         date NOT NULL,
        "country_id"   uuid NOT NULL,
        "is_recurring" boolean NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_public_holidays" PRIMARY KEY ("id"),
        CONSTRAINT "FK_public_holidays_country" FOREIGN KEY ("country_id")
          REFERENCES "countries"("id") ON DELETE RESTRICT
      )
    `);
    // Partial unique index: non-recurring → unique(country_id, date) where is_recurring = false
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_holiday_nonrecurring" ON "public_holidays" ("country_id", "date")
        WHERE "is_recurring" = false
    `);
    // Partial unique index: recurring → unique(country_id, month, day) where is_recurring = true
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_holiday_recurring" ON "public_holidays" ("country_id", EXTRACT(MONTH FROM "date"), EXTRACT(DAY FROM "date"))
        WHERE "is_recurring" = true
    `);

    // ── Leave Policies ──────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "leave_policies" (
        "id"                     uuid DEFAULT gen_random_uuid() NOT NULL,
        "policy_name"            character varying(255) NOT NULL,
        "country_id"             uuid NOT NULL,
        "working_hours_per_day"  numeric(4,2) NOT NULL,
        "approval_workflow_id"   uuid NOT NULL,
        "weekend_days"           integer[] NOT NULL DEFAULT '{}',
        "status"                 "leave_policy_status_enum" NOT NULL DEFAULT 'DRAFT',
        "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"              TIMESTAMP,
        CONSTRAINT "PK_leave_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_policies_country" FOREIGN KEY ("country_id")
          REFERENCES "countries"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_leave_policies_workflow" FOREIGN KEY ("approval_workflow_id")
          REFERENCES "approval_workflows"("id") ON DELETE RESTRICT
      )
    `);

    // ── Leave Policy ↔ Divisions (junction) ─────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "leave_policy_divisions" (
        "leave_policy_id"  uuid NOT NULL,
        "division_id"      uuid NOT NULL,
        CONSTRAINT "PK_leave_policy_divisions" PRIMARY KEY ("leave_policy_id", "division_id"),
        CONSTRAINT "FK_lpd_policy" FOREIGN KEY ("leave_policy_id")
          REFERENCES "leave_policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lpd_division" FOREIGN KEY ("division_id")
          REFERENCES "divisions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lpd_policy" ON "leave_policy_divisions" ("leave_policy_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lpd_division" ON "leave_policy_divisions" ("division_id")
    `);

    // ── Leave Rules ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "leave_rules" (
        "id"                             uuid DEFAULT gen_random_uuid() NOT NULL,
        "policy_id"                      uuid NOT NULL,
        "leave_type_id"                  uuid NOT NULL,
        "entitlement_days"               numeric(5,2),
        "is_accrued"                     boolean NOT NULL DEFAULT false,
        "accrual_rate"                   numeric(6,2),
        "accrual_interval"               "accrual_interval_enum",
        "cut_off_type"                   "cut_off_type_enum" NOT NULL DEFAULT 'HIRE_DATE',
        "cut_off_month"                  integer,
        "cut_off_day"                    integer,
        "reset_type"                     "reset_type_enum" NOT NULL DEFAULT 'NONE',
        "reset_days_count"               integer,
        "carry_over_enabled"             boolean NOT NULL DEFAULT false,
        "max_carry_over"                 numeric(5,2),
        "carry_over_expiration_enabled"  boolean NOT NULL DEFAULT false,
        "carry_over_expiration_days"     integer,
        "max_consecutive"                integer NOT NULL DEFAULT 0,
        "min_notice_days"                integer NOT NULL DEFAULT 0,
        "max_balance_cap"                numeric(5,2),
        "waiting_period_days"            integer NOT NULL DEFAULT 0,
        "createdAt"                      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_leave_rule_policy_type" UNIQUE ("policy_id", "leave_type_id"),
        CONSTRAINT "FK_leave_rules_policy" FOREIGN KEY ("policy_id")
          REFERENCES "leave_policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_rules_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_accrual_consistency" CHECK (
          ("is_accrued" = true AND "accrual_interval" IS NOT NULL AND "accrual_rate" IS NOT NULL AND "accrual_rate" > 0)
          OR
          ("is_accrued" = false AND "accrual_interval" IS NULL AND "accrual_rate" IS NULL)
        )
      )
    `);

    // ── Seniority Milestones ────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "seniority_milestones" (
        "id"                 uuid DEFAULT gen_random_uuid() NOT NULL,
        "leave_rule_id"      uuid NOT NULL,
        "service_years_from" numeric(5,2) NOT NULL,
        "service_years_to"   numeric(5,2),
        "accrual_rate"       numeric(6,2) NOT NULL,
        "entitlement_days"   numeric(5,2),
        "cap"                numeric(5,2),
        "createdAt"          TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seniority_milestones" PRIMARY KEY ("id"),
        CONSTRAINT "FK_milestones_rule" FOREIGN KEY ("leave_rule_id")
          REFERENCES "leave_rules"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "seniority_milestones" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_rules" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "leave_policy_divisions" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_policies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public_holidays" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "approval_workflow_steps" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "approval_workflows" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_types" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "divisions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "countries" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reset_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cut_off_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "accrual_interval_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approver_type_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "approval_workflow_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "leave_policy_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "leave_tracking_mode_enum"`);
  }
}
