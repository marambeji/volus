import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeApprovalWorkflowFieldsOptional1784860000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make country_id and leave_type_id nullable in approval_workflows table
    await queryRunner.query(`
      ALTER TABLE "approval_workflows"
      ALTER COLUMN "country_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_workflows"
      ALTER COLUMN "leave_type_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: make columns NOT NULL again
    // Note: This will fail if there are NULL values in these columns
    await queryRunner.query(`
      ALTER TABLE "approval_workflows"
      ALTER COLUMN "country_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_workflows"
      ALTER COLUMN "leave_type_id" SET NOT NULL
    `);
  }
}
