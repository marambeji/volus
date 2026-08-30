import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrPermissions1787600000000 implements MigrationInterface {
  name = 'AddHrPermissions1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "is_super_admin" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "hr_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_id" uuid NOT NULL,
        "module" character varying(50) NOT NULL,
        "can_view" boolean NOT NULL DEFAULT true,
        "can_manage" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_hr_permissions_employee_module" UNIQUE ("employee_id", "module"),
        CONSTRAINT "PK_hr_permissions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_hr_permissions_employee_id" ON "hr_permissions" ("employee_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "hr_permissions"
      ADD CONSTRAINT "FK_hr_permissions_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `UPDATE "employees" SET "is_super_admin" = true WHERE "email" = 'admin@novelus.com'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hr_permissions" DROP CONSTRAINT "FK_hr_permissions_employee"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_permissions_employee_id"`);
    await queryRunner.query(`DROP TABLE "hr_permissions"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "is_super_admin"`);
  }
}
