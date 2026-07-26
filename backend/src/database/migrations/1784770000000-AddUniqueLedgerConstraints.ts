import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueLedgerConstraints1784770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. One USAGE per leave_request_id
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_usage_per_leave_request" 
      ON "leave_ledger_entries" ("leave_request_id") 
      WHERE "transaction_type" = 'USAGE' AND "leave_request_id" IS NOT NULL;
    `);

    // 2. One REVERSAL per original_entry_id (referenced via reference_id or original_entry_id if exists)
    // Note: leave_ledger_entries table has reference_id pointing to original entry for reversals
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_reversal_per_original_entry" 
      ON "leave_ledger_entries" ("reference_id") 
      WHERE "transaction_type" = 'REVERSAL' AND "reference_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_unique_reversal_per_original_entry";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_unique_usage_per_leave_request";`);
  }
}
