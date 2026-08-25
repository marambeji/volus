import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCheckWorkflowStepSpecificPerson1784870000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_workflow_steps"
      DROP CONSTRAINT IF EXISTS "CHK_workflow_step_specific_person"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "CHK_workflow_step_specific_person"
      CHECK (
        "approver_type" <> 'SPECIFIC_PERSON' 
        OR ("specific_approver_id" IS NOT NULL OR "specific_approver_email" IS NOT NULL)
      )
    `);
  }
}
