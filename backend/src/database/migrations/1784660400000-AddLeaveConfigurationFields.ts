import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeaveConfigurationFields1784660400000 implements MigrationInterface {
    name = 'AddLeaveConfigurationFields1784660400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Safely rename max_consecutive to max_consecutive_days and change its type
        await queryRunner.query(`ALTER TABLE "leave_rules" RENAME COLUMN "max_consecutive" TO "max_consecutive_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" TYPE numeric(5,2) USING "max_consecutive_days"::numeric`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" DROP NOT NULL`);
        // If it was 0, it means no limit in the old logic. Let's convert 0 to NULL
        await queryRunner.query(`UPDATE "leave_rules" SET "max_consecutive_days" = NULL WHERE "max_consecutive_days" = 0`);

        // Add new columns with safe defaults
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "allows_half_day" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "requires_note" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "requires_document" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "requires_positive_balance" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "min_request_days" numeric(5,2) NOT NULL DEFAULT 0.5`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "max_request_days" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD "allowed_countries" jsonb`);

        // Add appropriate check constraints
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD CONSTRAINT "CHK_leave_rules_min_request_days" CHECK ("min_request_days" > 0)`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD CONSTRAINT "CHK_leave_rules_max_request_days" CHECK ("max_request_days" IS NULL OR "max_request_days" >= "min_request_days")`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD CONSTRAINT "CHK_leave_rules_max_consecutive_days" CHECK ("max_consecutive_days" IS NULL OR "max_consecutive_days" > 0)`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ADD CONSTRAINT "CHK_leave_rules_waiting_period_days" CHECK ("waiting_period_days" >= 0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop constraints
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP CONSTRAINT "CHK_leave_rules_waiting_period_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP CONSTRAINT "CHK_leave_rules_max_consecutive_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP CONSTRAINT "CHK_leave_rules_max_request_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP CONSTRAINT "CHK_leave_rules_min_request_days"`);

        // Drop new columns
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "allowed_countries"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "max_request_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "min_request_days"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "requires_positive_balance"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "requires_document"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "requires_note"`);
        await queryRunner.query(`ALTER TABLE "leave_rules" DROP COLUMN "allows_half_day"`);

        // Convert max_consecutive_days back to max_consecutive (int, default 0)
        await queryRunner.query(`UPDATE "leave_rules" SET "max_consecutive_days" = 0 WHERE "max_consecutive_days" IS NULL`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" TYPE int USING "max_consecutive_days"::int`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" SET DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "leave_rules" ALTER COLUMN "max_consecutive_days" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leave_rules" RENAME COLUMN "max_consecutive_days" TO "max_consecutive"`);
    }
}
