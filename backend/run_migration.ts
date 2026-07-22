import { AppDataSource } from './src/database/data-source';
import { WorkflowAndAuditSchema1784680000000 } from './src/database/migrations/1784680000000-WorkflowAndAuditSchema';

async function main() {
  await AppDataSource.initialize();

  const migrations = await AppDataSource.query(`SELECT name FROM migrations`);
  const names = migrations.map((m: any) => m.name);

  const migrationName = 'WorkflowAndAuditSchema1784680000000';
  if (names.includes(migrationName)) {
    console.log(`Migration "${migrationName}" already applied. Skipping.`);
    await AppDataSource.destroy();
    return;
  }

  console.log(`Running migration: ${migrationName}`);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const migration = new WorkflowAndAuditSchema1784680000000();
    await migration.up(queryRunner);
    await AppDataSource.query(
      `INSERT INTO migrations(timestamp, name) VALUES($1, $2)`,
      [1784680000000, migrationName],
    );
    await queryRunner.commitTransaction();
    console.log(`Migration "${migrationName}" completed successfully.`);
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Migration failed, rolled back.', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
