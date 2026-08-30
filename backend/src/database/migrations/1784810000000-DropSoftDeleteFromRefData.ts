import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'departments',
  'divisions',
  'countries',
  'leave_types',
  'leave_policies',
  'approval_workflows',
];

export class DropSoftDeleteFromRefData1784810000000
  implements MigrationInterface
{
  name = 'DropSoftDeleteFromRefData1784810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reference-data deletes are now hard deletes; drop the now-unused soft-delete column.
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deletedAt"`,
      );
    }

    // The overlap trigger referenced "deletedAt" to skip soft-deleted rows.
    // With hard deletes, any row still present is live, so drop those checks.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_workflow_overlap()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'ACTIVE' THEN
          IF EXISTS (
            SELECT 1 FROM approval_workflows
            WHERE id <> NEW.id
              AND status = 'ACTIVE'
              AND country_id = NEW.country_id
              AND leave_type_id = NEW.leave_type_id
              AND (
                (NEW.effective_to IS NULL AND (effective_to IS NULL OR effective_to >= NEW.effective_from))
                OR (NEW.effective_to IS NOT NULL AND (
                  (effective_to IS NULL AND effective_from <= NEW.effective_to)
                  OR (effective_to IS NOT NULL AND effective_from <= NEW.effective_to AND effective_to >= NEW.effective_from)
                ))
              )
          ) THEN
            RAISE EXCEPTION 'Config validation error: An active workflow already exists for the same country, leave type and date range.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_workflow_overlap()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'ACTIVE' AND NEW."deletedAt" IS NULL THEN
          IF EXISTS (
            SELECT 1 FROM approval_workflows
            WHERE id <> NEW.id
              AND status = 'ACTIVE'
              AND country_id = NEW.country_id
              AND leave_type_id = NEW.leave_type_id
              AND "deletedAt" IS NULL
              AND (
                (NEW.effective_to IS NULL AND (effective_to IS NULL OR effective_to >= NEW.effective_from))
                OR (NEW.effective_to IS NOT NULL AND (
                  (effective_to IS NULL AND effective_from <= NEW.effective_to)
                  OR (effective_to IS NOT NULL AND effective_from <= NEW.effective_to AND effective_to >= NEW.effective_from)
                ))
              )
          ) THEN
            RAISE EXCEPTION 'Config validation error: An active workflow already exists for the same country, leave type and date range.';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
      );
    }
  }
}
