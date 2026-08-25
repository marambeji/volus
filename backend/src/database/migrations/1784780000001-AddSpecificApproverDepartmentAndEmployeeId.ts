import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecificApproverDepartmentAndEmployeeId1784780000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add department_id (varchar, not uuid — can hold names or UUIDs)
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps"
       ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(255) NULL`,
    );

    // Add specific_approver_employee_id (uuid)
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps"
       ADD COLUMN IF NOT EXISTS "specific_approver_employee_id" UUID NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps" DROP COLUMN IF EXISTS "specific_approver_employee_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps" DROP COLUMN IF EXISTS "department_id"`,
    );
  }
}
