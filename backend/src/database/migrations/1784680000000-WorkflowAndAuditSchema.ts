import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkflowAndAuditSchema1784680000000 implements MigrationInterface {
  name = 'WorkflowAndAuditSchema1784680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create Audit Logs Table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"             uuid DEFAULT gen_random_uuid() NOT NULL,
        "actor_id"       uuid,
        "actor_name"     character varying(255) NOT NULL,
        "actor_role"     character varying(100) NOT NULL,
        "action_type"    character varying(100) NOT NULL,
        "entity_type"    character varying(100) NOT NULL,
        "entity_id"      character varying(255) NOT NULL,
        "timestamp"      TIMESTAMP NOT NULL DEFAULT now(),
        "old_values"     jsonb,
        "new_values"     jsonb,
        "changed_fields" jsonb,
        "reason"         text,
        "correlation_id" uuid,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Indexing for record-level history APIs
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp" DESC)`);

    // ── 2. Alter Approval Workflows Table ────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "country_id" uuid`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "leave_type_id" uuid`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "effective_from" date NOT NULL DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "effective_to" date`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "created_by" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ADD "last_modified_by" character varying(255)`);

    // For existing seeded default workflows, link to seeded Lebanon and Annual Leave to satisfy NOT NULL constraints.
    await queryRunner.query(`
      UPDATE "approval_workflows" 
      SET 
        "country_id" = (SELECT id FROM countries LIMIT 1),
        "leave_type_id" = (SELECT id FROM leave_types WHERE key = 'annual' LIMIT 1)
      WHERE "country_id" IS NULL OR "leave_type_id" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "approval_workflows" ALTER COLUMN "country_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" ALTER COLUMN "leave_type_id" SET NOT NULL`);

    // Add Foreign Key Constraints for approval_workflows
    await queryRunner.query(`
      ALTER TABLE "approval_workflows" ADD CONSTRAINT "FK_approval_workflows_country" 
      FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_workflows" ADD CONSTRAINT "FK_approval_workflows_leave_type" 
      FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT
    `);

    // Add Date Validity constraint
    await queryRunner.query(`
      ALTER TABLE "approval_workflows" ADD CONSTRAINT "CHK_approval_workflows_dates" 
      CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from")
    `);

    // ── 3. Overlap Trigger Constraint ──────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_workflow_overlap()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'ACTIVE' AND NEW."deletedAt" IS NULL THEN
          IF EXISTS (
            SELECT 1 FROM approval_workflows
            WHERE id <> NEW.id
              AND status = 'ACTIVE'
              AND country_id = NEW.country_id
              AND leave_type_id = NEW.leave_type_id
              AND "deletedAt" IS NULL
              AND (
                (NEW.effective_to IS NULL AND (effective_to IS NULL OR effective_to >= NEW.effective_from))
                OR (NEW.effective_to IS NOT NULL AND (
                  (effective_to IS NULL AND effective_from <= NEW.effective_to)
                  OR (effective_to IS NOT NULL AND effective_from <= NEW.effective_to AND effective_to >= NEW.effective_from)
                ))
              )
          ) THEN
            RAISE EXCEPTION 'Config validation error: An active workflow already exists for the same country, leave type and date range.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER tg_check_workflow_overlap
      BEFORE INSERT OR UPDATE ON approval_workflows
      FOR EACH ROW EXECUTE FUNCTION check_workflow_overlap();
    `);

    // ── 4. Add Step Validation Constraint ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "CHK_workflow_step_specific_person"
      CHECK (
        "approver_type" <> 'SPECIFIC_PERSON' 
        OR ("specific_approver_id" IS NOT NULL OR "specific_approver_email" IS NOT NULL)
      )
    `);

    // ── 5. Alter Leave Requests Table ────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "leave_requests" ADD "workflow_snapshot" jsonb`);

    // ── 6. Create Approval Step Instances Table ──────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "approval_instance_status_enum" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')
    `);

    await queryRunner.query(`
      CREATE TABLE "approval_instances" (
        "id"                   uuid DEFAULT gen_random_uuid() NOT NULL,
        "request_id"           uuid NOT NULL,
        "workflow_id"          uuid NOT NULL,
        "step_id"              uuid NOT NULL,
        "step_order"           integer NOT NULL,
        "approver_type"        "public"."approval_workflow_steps_approver_type_enum" NOT NULL,
        "resolved_approver_id" uuid,
        "status"               "approval_instance_status_enum" NOT NULL DEFAULT 'WAITING',
        "decision_note"        text,
        "action_date"          TIMESTAMP,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_instances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_instances_request" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_approval_instances_workflow" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_approval_instances_step" FOREIGN KEY ("step_id") REFERENCES "approval_workflow_steps"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_approval_instances_approver" FOREIGN KEY ("resolved_approver_id") REFERENCES "employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_request_step_order" UNIQUE ("request_id", "step_order")
      )
    `);

    // ── 7. Ledger Uniqueness Constraints (One USAGE / One REVERSAL) ──────────
    // Rayan requirement: "One USAGE effect per request", "One reversal per original USAGE entry"
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_one_usage_per_request" ON "leave_ledger_entries" ("reference_id") 
      WHERE ("transaction_type" = 'USAGE' AND "reference_type" = 'LEAVE_REQUEST')
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_one_reversal_per_request" ON "leave_ledger_entries" ("reference_id") 
      WHERE ("transaction_type" = 'REVERSAL' AND "reference_type" = 'LEAVE_REQUEST')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_one_reversal_per_request"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_one_usage_per_request"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_instances" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_instance_status_enum"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "workflow_snapshot"`);
    await queryRunner.query(`ALTER TABLE "approval_workflow_steps" DROP CONSTRAINT "CHK_workflow_step_specific_person"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS tg_check_workflow_overlap ON approval_workflows`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_workflow_overlap()`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP CONSTRAINT "CHK_approval_workflows_dates"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP CONSTRAINT "FK_approval_workflows_leave_type"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP CONSTRAINT "FK_approval_workflows_country"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "last_modified_by"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "created_by"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "effective_to"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "effective_from"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "leave_type_id"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "country_id"`);
    await queryRunner.query(`ALTER TABLE "approval_workflows" DROP COLUMN "description"`);
    await queryRunner.query("DROP TABLE IF EXISTS \"audit_logs\" CASCADE");
  }
}
