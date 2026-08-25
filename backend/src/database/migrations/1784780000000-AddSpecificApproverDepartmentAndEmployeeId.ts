import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecificApproverDepartmentAndEmployeeId1784780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_workflow_steps"
      ADD COLUMN IF NOT EXISTS "department_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "specific_approver_employee_id" uuid NULL;
    `);

    // Add foreign key constraint to employees table if specific_approver_employee_id exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_workflow_steps_employee'
        ) THEN
          ALTER TABLE "approval_workflow_steps"
          ADD CONSTRAINT "fk_approval_workflow_steps_employee"
          FOREIGN KEY ("specific_approver_employee_id")
          REFERENCES "employees"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_workflow_steps"
      DROP CONSTRAINT IF EXISTS "fk_approval_workflow_steps_employee",
      DROP COLUMN IF EXISTS "department_id",
      DROP COLUMN IF EXISTS "specific_approver_employee_id";
    `);
  }
}
