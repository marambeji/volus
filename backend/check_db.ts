import { AppDataSource } from './src/database/data-source';

async function main() {
  console.log('Migrations glob:', AppDataSource.options.migrations);
  await AppDataSource.initialize();
  console.log('Registered migrations classes:', AppDataSource.migrations.map(m => m.name));
  await AppDataSource.destroy();
}

main().catch(console.error);
