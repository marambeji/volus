import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecificApproverEmail1721498500000 implements MigrationInterface {
  name = 'AddSpecificApproverEmail1721498500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps" ADD COLUMN "specific_approver_email" character varying(255);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "approval_workflow_steps" DROP COLUMN "specific_approver_email";`,
    );
  }
}
