import { AppDataSource } from './src/database/data-source';

async function main() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  const rows = await queryRunner.query(
    `SELECT id, action_type, old_values, new_values, changed_fields, description, timestamp 
     FROM audit_logs 
     ORDER BY timestamp DESC 
     LIMIT 5`
  );
  console.log(JSON.stringify(rows, null, 2));
  await AppDataSource.destroy();
}

main().catch(console.error);
