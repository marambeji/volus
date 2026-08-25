import { MigrationInterface, QueryRunner } from 'typeorm';

// Deleting a LeavePolicy is now an intentional full cascade: it takes down
// its rules (already CASCADE), the balances computed from those rules, the
// ledger entries recorded against those balances, and any employee's active
// assignment to that policy. This destroys employee leave history for that
// policy — that's the explicit, chosen behavior, not an oversight.
export class CascadePolicyDeletion1784830000000
  implements MigrationInterface
{
  name = 'CascadePolicyDeletion1784830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employee_policy_assignments"
      DROP CONSTRAINT "FK_e2ba1a94aa34c30e1e340ce7826"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_policy_assignments"
      ADD CONSTRAINT "FK_e2ba1a94aa34c30e1e340ce7826"
      FOREIGN KEY ("leave_policy_id") REFERENCES "leave_policies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "leave_balances"
      DROP CONSTRAINT "FK_be3403d8912e88153688814c19a"
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_balances"
      ADD CONSTRAINT "FK_be3403d8912e88153688814c19a"
      FOREIGN KEY ("leave_policy_rule_id") REFERENCES "leave_rules"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "leave_ledger_entries"
      DROP CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_ledger_entries"
      ADD CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
      FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leave_ledger_entries"
      DROP CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_ledger_entries"
      ADD CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
      FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "leave_balances"
      DROP CONSTRAINT "FK_be3403d8912e88153688814c19a"
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_balances"
      ADD CONSTRAINT "FK_be3403d8912e88153688814c19a"
      FOREIGN KEY ("leave_policy_rule_id") REFERENCES "leave_rules"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_policy_assignments"
      DROP CONSTRAINT "FK_e2ba1a94aa34c30e1e340ce7826"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_policy_assignments"
      ADD CONSTRAINT "FK_e2ba1a94aa34c30e1e340ce7826"
      FOREIGN KEY ("leave_policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT
    `);
  }
}
