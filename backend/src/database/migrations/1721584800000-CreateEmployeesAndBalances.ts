import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeesAndBalances1721584800000 implements MigrationInterface {
  name = 'CreateEmployeesAndBalances1721584800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Enums ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "employment_type_enum" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN')
    `);
    await queryRunner.query(`
      CREATE TYPE "work_mode_enum" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE')
    `);
    await queryRunner.query(`
      CREATE TYPE "employee_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED')
    `);
    await queryRunner.query(`
      CREATE TYPE "employee_role_enum" AS ENUM ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
    `);
    await queryRunner.query(`
      CREATE TYPE "ledger_transaction_type_enum" AS ENUM (
        'INITIAL_GRANT', 'ACCRUAL', 'USAGE', 'REVERSAL', 'MANUAL_ADJUSTMENT', 'CARRY_OVER', 'RESET'
      )
    `);

    // ── 2. Employees Table ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id"                   uuid DEFAULT gen_random_uuid() NOT NULL,
        "employee_number"      character varying(50),
        "full_name"            character varying(150) NOT NULL,
        "email"                character varying(255) NOT NULL,
        "phone"                character varying(50),
        "avatar"               character varying(255),
        "job_title"            character varying(150) NOT NULL,
        "department"           character varying(150) NOT NULL,
        "unit"                 character varying(150),
        "manager_id"           uuid,
        "country_id"           uuid NOT NULL,
        "division_id"          uuid,
        "approval_workflow_id" uuid,
        "status"               "employee_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "employment_type"      "employment_type_enum" NOT NULL DEFAULT 'FULL_TIME',
        "work_mode"            "work_mode_enum" NOT NULL DEFAULT 'ONSITE',
        "role"                 "employee_role_enum" NOT NULL DEFAULT 'EMPLOYEE',
        "hire_date"            date NOT NULL,
        "emergency_contacts"   jsonb NOT NULL DEFAULT '[]',
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"            TIMESTAMP,
        CONSTRAINT "PK_employees" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employees_manager" FOREIGN KEY ("manager_id")
          REFERENCES "employees"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_employees_country" FOREIGN KEY ("country_id")
          REFERENCES "countries"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_employees_division" FOREIGN KEY ("division_id")
          REFERENCES "divisions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_employees_workflow" FOREIGN KEY ("approval_workflow_id")
          REFERENCES "approval_workflows"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employees_email_active" ON "employees" ("email")
        WHERE ("deletedAt" IS NULL)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employees_number_active" ON "employees" ("employee_number")
        WHERE ("employee_number" IS NOT NULL AND "deletedAt" IS NULL)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_manager_id" ON "employees" ("manager_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_country_id" ON "employees" ("country_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_division_id" ON "employees" ("division_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_approval_workflow_id" ON "employees" ("approval_workflow_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_status" ON "employees" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_role" ON "employees" ("role")`,
    );

    // ── 3. Employee Policy Assignments Table ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "employee_policy_assignments" (
        "id"              uuid DEFAULT gen_random_uuid() NOT NULL,
        "employee_id"     uuid NOT NULL,
        "leave_policy_id" uuid NOT NULL,
        "effective_from"  date NOT NULL,
        "effective_to"    date,
        "is_active"       boolean NOT NULL DEFAULT true,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_policy_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_epa_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_epa_policy" FOREIGN KEY ("leave_policy_id")
          REFERENCES "leave_policies"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_epa_dates" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_active_employee_policy" ON "employee_policy_assignments" ("employee_id")
        WHERE ("is_active" = true)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_epa_employee_id" ON "employee_policy_assignments" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_epa_leave_policy_id" ON "employee_policy_assignments" ("leave_policy_id")`,
    );

    // ── 4. Leave Balances Table ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "leave_balances" (
        "id"                   uuid DEFAULT gen_random_uuid() NOT NULL,
        "employee_id"          uuid NOT NULL,
        "leave_type_id"        uuid NOT NULL,
        "leave_policy_rule_id" uuid,
        "year"                 integer NOT NULL,
        "available_balance"    numeric(6,2) NOT NULL DEFAULT 0.00,
        "used_ytd"             numeric(6,2) NOT NULL DEFAULT 0.00,
        "pending"              numeric(6,2) NOT NULL DEFAULT 0.00,
        "carried_over"         numeric(6,2) NOT NULL DEFAULT 0.00,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_balances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employee_leave_type_year" UNIQUE ("employee_id", "leave_type_id", "year"),
        CONSTRAINT "FK_lb_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_lb_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_lb_policy_rule" FOREIGN KEY ("leave_policy_rule_id")
          REFERENCES "leave_rules"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_lb_employee_id" ON "leave_balances" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lb_leave_type_id" ON "leave_balances" ("leave_type_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lb_policy_rule_id" ON "leave_balances" ("leave_policy_rule_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lb_year" ON "leave_balances" ("year")`,
    );

    // ── 5. Leave Ledger Entries Table ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "leave_ledger_entries" (
        "id"                       uuid DEFAULT gen_random_uuid() NOT NULL,
        "balance_id"               uuid NOT NULL,
        "employee_id"              uuid NOT NULL,
        "leave_type_id"            uuid NOT NULL,
        "transaction_type"         "ledger_transaction_type_enum" NOT NULL,
        "transaction_date"        TIMESTAMP NOT NULL DEFAULT now(),
        "signed_amount"            numeric(6,2) NOT NULL,
        "resulting_balance"        numeric(6,2) NOT NULL,
        "reason"                   text NOT NULL,
        "reference_type"           character varying(50),
        "reference_id"             uuid,
        "idempotency_key"          character varying(100),
        "request_fingerprint"      character varying(64),
        "performed_by_employee_id" uuid,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lle_balance" FOREIGN KEY ("balance_id")
          REFERENCES "leave_balances"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_lle_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_lle_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_lle_performer" FOREIGN KEY ("performed_by_employee_id")
          REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ledger_idempotency_key" ON "leave_ledger_entries" ("idempotency_key")
        WHERE ("idempotency_key" IS NOT NULL)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_balance_id" ON "leave_ledger_entries" ("balance_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_employee_id" ON "leave_ledger_entries" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_leave_type_id" ON "leave_ledger_entries" ("leave_type_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_transaction_type" ON "leave_ledger_entries" ("transaction_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_transaction_date" ON "leave_ledger_entries" ("transaction_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lle_performed_by_employee_id" ON "leave_ledger_entries" ("performed_by_employee_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "leave_ledger_entries" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_balances" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employee_policy_assignments" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employees" CASCADE`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ledger_transaction_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "employee_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employee_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "work_mode_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employment_type_enum"`);
  }
}
