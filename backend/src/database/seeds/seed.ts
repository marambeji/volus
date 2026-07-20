/* eslint-disable */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Re-use same connection logic as data-source.ts
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

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    ...baseConfig,
    ...sslConfig,
    synchronize: false,
    entities: [path.join(__dirname, '../**/*.entity.{ts,js}')],
    logging: false,
  });

  await ds.initialize();
  console.log('Connected to database for seeding.');

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // ── 1. Seed Leave Types ────────────────────────────────────────────────

    const leaveTypes = [
      {
        key: 'annual',
        label: 'Annual Leave',
        trackingMode: 'AVAILABLE_BALANCE',
        color: '#3B82F6',
        displayOrder: 1,
      },
      {
        key: 'public_holiday',
        label: 'Public Holiday',
        trackingMode: 'AVAILABLE_BALANCE',
        color: '#EF4444',
        displayOrder: 2,
      },
      {
        key: 'compensation',
        label: 'Compensation Leave',
        trackingMode: 'AVAILABLE_BALANCE',
        color: '#F59E0B',
        displayOrder: 3,
      },
      {
        key: 'overtime',
        label: 'Overtime Leave',
        trackingMode: 'AVAILABLE_BALANCE',
        color: '#10B981',
        displayOrder: 4,
      },
      {
        key: 'sick',
        label: 'Sick Leave',
        trackingMode: 'USAGE_YTD',
        color: '#6366F1',
        displayOrder: 5,
      },
      {
        key: 'maternity',
        label: 'Maternity Leave',
        trackingMode: 'USAGE_YTD',
        color: '#EC4899',
        displayOrder: 6,
      },
      {
        key: 'paternity',
        label: 'Paternity Leave',
        trackingMode: 'USAGE_YTD',
        color: '#8B5CF6',
        displayOrder: 7,
      },
      {
        key: 'bereavement',
        label: 'Bereavement Leave',
        trackingMode: 'USAGE_YTD',
        color: '#6B7280',
        displayOrder: 8,
      },
      {
        key: 'unpaid',
        label: 'Unpaid Leave',
        trackingMode: 'USAGE_YTD',
        color: '#9CA3AF',
        displayOrder: 9,
      },
      {
        key: 'other',
        label: 'Other Leave',
        trackingMode: 'USAGE_YTD',
        color: '#D97706',
        displayOrder: 10,
      },
    ];

    for (const lt of leaveTypes) {
      const existing = await qr.query(
        `SELECT id FROM leave_types WHERE key = $1`,
        [lt.key],
      );
      if (existing.length === 0) {
        await qr.query(
          `INSERT INTO leave_types (key, label, "trackingMode", color, "displayOrder", "isActive")
           VALUES ($1, $2, $3, $4, $5, true)`,
          [lt.key, lt.label, lt.trackingMode, lt.color, lt.displayOrder],
        );
        console.log(`  ✓ LeaveType seeded: ${lt.label}`);
      } else {
        console.log(`  ○ LeaveType skipped (exists): ${lt.label}`);
      }
    }

    // ── 2. Seed sample Countries ───────────────────────────────────────────

    const countries = [
      { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
      { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
      { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
      { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
      { name: 'France', code: 'FR', flag: '🇫🇷' },
    ];

    for (const c of countries) {
      const existing = await qr.query(
        `SELECT id FROM countries WHERE code = $1 AND "deletedAt" IS NULL`,
        [c.code],
      );
      if (existing.length === 0) {
        await qr.query(
          `INSERT INTO countries (name, code, flag) VALUES ($1, $2, $3)`,
          [c.name, c.code, c.flag],
        );
        console.log(`  ✓ Country seeded: ${c.name}`);
      } else {
        console.log(`  ○ Country skipped (exists): ${c.name}`);
      }
    }

    // ── 3. Seed sample Divisions ───────────────────────────────────────────

    const divisions = ['Levant', 'Gulf', 'Europe', 'Africa', 'Global'];

    for (const name of divisions) {
      const existing = await qr.query(
        `SELECT id FROM divisions WHERE name = $1 AND "deletedAt" IS NULL`,
        [name],
      );
      if (existing.length === 0) {
        await qr.query(`INSERT INTO divisions (name) VALUES ($1)`, [name]);
        console.log(`  ✓ Division seeded: ${name}`);
      } else {
        console.log(`  ○ Division skipped (exists): ${name}`);
      }
    }

    // ── 4. Seed a default Approval Workflow ────────────────────────────────

    const wfName = 'Default Manager Approval';
    const existingWf = await qr.query(
      `SELECT id FROM approval_workflows WHERE name = $1 AND "deletedAt" IS NULL`,
      [wfName],
    );

    if (existingWf.length === 0) {
      const [wf] = await qr.query(
        `INSERT INTO approval_workflows (name, status)
         VALUES ($1, 'ACTIVE')
         RETURNING id`,
        [wfName],
      );
      await qr.query(
        `INSERT INTO approval_workflow_steps
           ("workflow_id", "step_order", "approver_type", "is_required")
         VALUES ($1, 1, 'MANAGER', true)`,
        [wf.id],
      );
      console.log(`  ✓ Workflow seeded: ${wfName} (1 step)`);
    } else {
      console.log(`  ○ Workflow skipped (exists): ${wfName}`);
    }

    await qr.commitTransaction();
    console.log('\n✅ Seed completed successfully.');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('❌ Seed failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

seed();
