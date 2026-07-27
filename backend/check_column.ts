import { AppDataSource } from './src/database/data-source';

async function main() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  const hasColumn = await queryRunner.hasColumn('audit_logs', 'description');
  console.log('Has description column:', hasColumn);
  await AppDataSource.destroy();
}

main().catch(console.error);
