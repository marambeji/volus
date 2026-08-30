import { MigrationInterface, QueryRunner } from 'typeorm';

// Move approval workflow assignment from policy-level to leave-rule-level.
// Each leave type within a policy can now have its own approval workflow,
// enabling different approval sequences for Annual Leave, Sick Leave, etc.
// within the same country policy.
//
// Data migration: Copy each policy's approval_workflow_id to all its
// associated leave_rules, then drop the policy-level column.
export class MoveApprovalWorkflowToLeaveRules1784850000000
  implements MigrationInterface
{
  name = 'MoveApprovalWorkflowToLeaveRules1784850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add approval_workflow_id to leave_rules (nullable initially for data migration)
    await queryRunner.query(`
      ALTER TABLE "leave_rules"
      ADD COLUMN "approval_workflow_id" uuid
    `);

    // 2. Migrate existing data: copy policy-level workflow to all associated rules
    await queryRunner.query(`
      UPDATE "leave_rules" lr
      SET "approval_workflow_id" = lp."approval_workflow_id"
      FROM "leave_policies" lp
      WHERE lr."policy_id" = lp."id"
      AND lp."approval_workflow_id" IS NOT NULL
    `);

    // 3. Validate that all leave rules now have a workflow
    const rulesWithoutWorkflow = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM "leave_rules"
      WHERE "approval_workflow_id" IS NULL
    `);

    if (rulesWithoutWorkflow[0]?.count > 0) {
      throw new Error(
        `Migration failed: ${rulesWithoutWorkflow[0].count} leave rules do not have an approval workflow. ` +
        `All leave rules must have an associated workflow before migration can complete.`
      );
    }

    // 4. Make approval_workflow_id NOT NULL
    await queryRunner.query(`
      ALTER TABLE "leave_rules"
      ALTER COLUMN "approval_workflow_id" SET NOT NULL
    `);

    // 5. Add foreign key constraint and index to leave_rules
    await queryRunner.query(`
      ALTER TABLE "leave_rules"
      ADD CONSTRAINT "FK_leave_rules_approval_workflow"
      FOREIGN KEY ("approval_workflow_id")
      REFERENCES "approval_workflows"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_leave_rules_approval_workflow"
      ON "leave_rules"("approval_workflow_id")
    `);

    // 6. Drop the policy-level approval workflow foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "leave_policies"
      DROP CONSTRAINT IF EXISTS "FK_leave_policies_approval_workflow"
    `);

    // Alternative constraint name pattern check (in case it was auto-generated)
    const policyFkConstraints = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'leave_policies'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%approval_workflow%'
    `);

    for (const constraint of policyFkConstraints) {
      await queryRunner.query(`
        ALTER TABLE "leave_policies"
        DROP CONSTRAINT "${constraint.constraint_name}"
      `);
    }

    // 7. Remove approval_workflow_id column from leave_policies
    await queryRunner.query(`
      ALTER TABLE "leave_policies"
      DROP COLUMN "approval_workflow_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add approval_workflow_id to leave_policies (NOT NULL after data migration)
    await queryRunner.query(`
      ALTER TABLE "leave_policies"
      ADD COLUMN "approval_workflow_id" uuid
    `);

    // 2. Migrate data back: pick the first workflow from each policy's rules
    // (This is lossy if rules had different workflows, but it's the best we can do)
    await queryRunner.query(`
      UPDATE "leave_policies" lp
      SET "approval_workflow_id" = (
        SELECT lr."approval_workflow_id"
        FROM "leave_rules" lr
        WHERE lr."policy_id" = lp."id"
        AND lr."approval_workflow_id" IS NOT NULL
        ORDER BY lr."created_at" ASC
        LIMIT 1
      )
    `);

    // 3. Make policy-level approval_workflow_id NOT NULL
    await queryRunner.query(`
      ALTER TABLE "leave_policies"
      ALTER COLUMN "approval_workflow_id" SET NOT NULL
    `);

    // 4. Re-add foreign key constraint to leave_policies
    await queryRunner.query(`
      ALTER TABLE "leave_policies"
      ADD CONSTRAINT "FK_leave_policies_approval_workflow"
      FOREIGN KEY ("approval_workflow_id")
      REFERENCES "approval_workflows"("id")
      ON DELETE RESTRICT
    `);

    // 5. Drop the rule-level index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_leave_rules_approval_workflow"
    `);

    // 6. Drop the rule-level foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "leave_rules"
      DROP CONSTRAINT "FK_leave_rules_approval_workflow"
    `);

    // 7. Remove approval_workflow_id from leave_rules
    await queryRunner.query(`
      ALTER TABLE "leave_rules"
      DROP COLUMN "approval_workflow_id"
    `);
  }
}
