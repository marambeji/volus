import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToAuditLogs1784760000000 implements MigrationInterface {
  name = 'AddDescriptionToAuditLogs1784760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "description" TEXT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "description"`,
    );
  }
}
