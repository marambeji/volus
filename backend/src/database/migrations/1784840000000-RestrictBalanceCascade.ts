import { MigrationInterface, QueryRunner } from 'typeorm';

// The previous migration made leave_balances -> leave_rules and
// leave_ledger_entries -> leave_balances CASCADE so a full policy deletion
// could tear down employee history. But PoliciesService.update() deletes and
// recreates ALL of a policy's leave_rules on every quota save (even for
// leave types that didn't change), so that CASCADE was silently wiping every
// employee's balances/ledger on routine policy edits, not just intentional
// deletes. Put these two back to RESTRICT; PoliciesService.remove() now
// explicitly deletes the dependent balances/ledger entries itself before
// removing the policy, so intentional full deletion still cascades, but a
// quota edit that fails to touch balances/ledger will now be blocked
// (409) instead of silently destroying them.
export class RestrictBalanceCascade1784840000000
  implements MigrationInterface
{
  name = 'RestrictBalanceCascade1784840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      ALTER TABLE "leave_ledger_entries"
      DROP CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_ledger_entries"
      ADD CONSTRAINT "FK_1332ac120b5fdd03179c04be0a2"
      FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("id") ON DELETE RESTRICT
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
      FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("id") ON DELETE CASCADE
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
  }
}
