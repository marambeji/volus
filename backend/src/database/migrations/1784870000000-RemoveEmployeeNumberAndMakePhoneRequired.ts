import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEmployeeNumberAndMakePhoneRequired1784870000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, update any NULL phone values to a default placeholder
    // This ensures the NOT NULL constraint won't fail
    await queryRunner.query(`
      UPDATE "employees"
      SET "phone" = 'N/A'
      WHERE "phone" IS NULL
    `);

    // Make phone column NOT NULL
    await queryRunner.query(`
      ALTER TABLE "employees"
      ALTER COLUMN "phone" SET NOT NULL
    `);

    // Drop employee_number column
    await queryRunner.query(`
      ALTER TABLE "employees"
      DROP COLUMN "employee_number"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add employee_number column
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN "employee_number" varchar(50) NULL
    `);

    // Make phone column nullable again
    await queryRunner.query(`
      ALTER TABLE "employees"
      ALTER COLUMN "phone" DROP NOT NULL
    `);
  }
}
