import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenderToEmployees1784820000000 implements MigrationInterface {
  name = 'AddGenderToEmployees1784820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "employees_gender_enum" AS ENUM ('MALE', 'FEMALE')
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" ADD "gender" "employees_gender_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "gender"`);
    await queryRunner.query(`DROP TYPE "employees_gender_enum"`);
  }
}
