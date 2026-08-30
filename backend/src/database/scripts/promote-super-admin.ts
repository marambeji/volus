/* eslint-disable */
// One-time bootstrap: grant Super Admin (full, unrestricted HR access) to an
// existing HR_ADMIN employee. Run once per deployment for the company's
// first admin — there is deliberately no in-app UI to do this, since a
// Super Admin can never be restricted by another Super Admin.
//
// Usage: npm run promote-super-admin -- email@company.com
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
const host = process.env.DB_HOST;
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME;
const ssl = process.env.DB_SSL === 'true';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
const sslConfig = ssl ? { ssl: { rejectUnauthorized } } : {};
const baseConfig = url ? { url } : { host, port, username, password, database };

async function promoteSuperAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run promote-super-admin -- <email>');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    ...baseConfig,
    ...sslConfig,
    synchronize: false,
    entities: [path.join(__dirname, '../**/*.entity.{ts,js}')],
    logging: false,
  });

  await ds.initialize();

  try {
    const [employee] = await ds.query(
      `SELECT id, email, full_name, role, status FROM employees WHERE email = $1 AND "deletedAt" IS NULL`,
      [email],
    );

    if (!employee) {
      console.error(`❌ No active employee found with email "${email}".`);
      process.exit(1);
    }
    if (employee.role !== 'HR_ADMIN') {
      console.error(
        `❌ ${employee.full_name} (${employee.email}) has role "${employee.role}", not HR_ADMIN. ` +
        `Give them the HR Admin role in the Employees page first, then re-run this script.`,
      );
      process.exit(1);
    }
    if (employee.status !== 'ACTIVE') {
      console.error(`❌ ${employee.full_name} (${employee.email}) is not active (status: ${employee.status}).`);
      process.exit(1);
    }

    await ds.query(`UPDATE employees SET is_super_admin = true WHERE id = $1`, [employee.id]);

    console.log(`✅ ${employee.full_name} (${employee.email}) is now Super Admin.`);
  } finally {
    await ds.destroy();
  }
}

promoteSuperAdmin();
