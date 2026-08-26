import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDayPortionToLeaveRequests1787700000000
  implements MigrationInterface
{
  name = 'AddDayPortionToLeaveRequests1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."leave_requests_day_portion_enum" AS ENUM('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF')
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_requests" ADD "day_portion" "public"."leave_requests_day_portion_enum" NOT NULL DEFAULT 'FULL_DAY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "day_portion"`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_day_portion_enum"`);
  }
}
