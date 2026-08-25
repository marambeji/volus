import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveReminders1784790000000 implements MigrationInterface {
  name = 'CreateLeaveReminders1784790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Reminder Settings (singleton config row) ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reminder_settings" (
        "id"          uuid DEFAULT gen_random_uuid() NOT NULL,
        "enabled"     boolean NOT NULL DEFAULT true,
        "delay_hours" integer NOT NULL DEFAULT 48,
        "updated_by"  uuid,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminder_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reminder_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO "reminder_settings" ("enabled", "delay_hours") VALUES (true, 48)
    `);

    // ── Sent Reminder History ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "leave_reminder_notifications" (
        "id"                   uuid DEFAULT gen_random_uuid() NOT NULL,
        "approval_instance_id" uuid NOT NULL,
        "request_id"           uuid NOT NULL,
        "approver_id"          uuid NOT NULL,
        "approver_email"       character varying(255) NOT NULL,
        "sent_at"              TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_reminder_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_reminder_notifications_instance" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_reminder_notifications_request" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_reminder_notifications_approver" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_reminder_instance_approver" UNIQUE ("approval_instance_id", "approver_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_leave_reminder_notifications_sent_at" ON "leave_reminder_notifications" ("sent_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_reminder_notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reminder_settings" CASCADE`);
  }
}
