import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrDeleteToLeaveRequests1784880000000 implements MigrationInterface {
  name = 'AddHrDeleteToLeaveRequests1784880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."leave_requests_status_enum" RENAME TO "leave_requests_status_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."leave_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'DELETED_BY_HR')`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" TYPE "public"."leave_requests_status_enum" USING "status"::"text"::"public"."leave_requests_status_enum"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_status_enum_old"`);

    await queryRunner.query(`ALTER TABLE "leave_requests" ADD "deletion_reason" text`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ADD "deleted_by_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_leave_requests_deleted_by" FOREIGN KEY ("deleted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_leave_requests_deleted_by"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "deleted_by_id"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "deletion_reason"`);

    await queryRunner.query(`ALTER TYPE "public"."leave_requests_status_enum" RENAME TO "leave_requests_status_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."leave_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" TYPE "public"."leave_requests_status_enum" USING "status"::"text"::"public"."leave_requests_status_enum"`);
    await queryRunner.query(`ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_status_enum_old"`);
  }
}
