import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartments1784800000000 implements MigrationInterface {
  name = 'CreateDepartments1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id"               uuid DEFAULT gen_random_uuid() NOT NULL,
        "name"             character varying(150) NOT NULL,
        "color"            character varying(20) NOT NULL DEFAULT '#8B5CF6',
        "head_employee_id" uuid,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt"        TIMESTAMP,
        CONSTRAINT "PK_departments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_departments_name" UNIQUE ("name"),
        CONSTRAINT "FK_departments_head_employee" FOREIGN KEY ("head_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO "departments" ("name", "color") VALUES
        ('Engineering', '#3B82F6'),
        ('Marketing',   '#EC4899'),
        ('Human Resources', '#8B5CF6'),
        ('Finance',     '#F59E0B'),
        ('Sales',       '#10B981'),
        ('Operations',  '#6B7280'),
        ('Legal',       '#EF4444'),
        ('Design',      '#14B8A6'),
        ('Executive',   '#F97316')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "departments" CASCADE`);
  }
}
