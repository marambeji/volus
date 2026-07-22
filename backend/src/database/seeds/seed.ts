/* eslint-disable */
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
      { key: 'annual', label: 'Annual Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#3B82F6', displayOrder: 1 },
      { key: 'public_holiday', label: 'Public Holiday', trackingMode: 'AVAILABLE_BALANCE', color: '#EF4444', displayOrder: 2 },
      { key: 'compensation', label: 'Compensation Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#F59E0B', displayOrder: 3 },
      { key: 'overtime', label: 'Overtime Leave', trackingMode: 'AVAILABLE_BALANCE', color: '#10B981', displayOrder: 4 },
      { key: 'sick', label: 'Sick Leave', trackingMode: 'USAGE_YTD', color: '#6366F1', displayOrder: 5 },
      { key: 'maternity', label: 'Maternity Leave', trackingMode: 'USAGE_YTD', color: '#EC4899', displayOrder: 6 },
      { key: 'paternity', label: 'Paternity Leave', trackingMode: 'USAGE_YTD', color: '#8B5CF6', displayOrder: 7 },
      { key: 'bereavement', label: 'Bereavement Leave', trackingMode: 'USAGE_YTD', color: '#6B7280', displayOrder: 8 },
      { key: 'unpaid', label: 'Unpaid Leave', trackingMode: 'USAGE_YTD', color: '#9CA3AF', displayOrder: 9 },
      { key: 'other', label: 'Other Leave', trackingMode: 'USAGE_YTD', color: '#D97706', displayOrder: 10 },
    ];

    for (const lt of leaveTypes) {
      const existing = await qr.query(`SELECT id FROM leave_types WHERE key = $1`, [lt.key]);
      if (existing.length === 0) {
        await qr.query(
          `INSERT INTO leave_types (key, label, "trackingMode", color, "displayOrder", "isActive")
           VALUES ($1, $2, $3, $4, $5, true)`,
          [lt.key, lt.label, lt.trackingMode, lt.color, lt.displayOrder],
        );
        console.log(`  ✓ LeaveType seeded: ${lt.label}`);
      }
    }

    // ── 2. Seed Countries ──────────────────────────────────────────────────
    const countries = [
      { name: 'Lebanon', code: 'LB', flag: 'LB' },
      { name: 'United Arab Emirates', code: 'AE', flag: 'AE' },
      { name: 'Saudi Arabia', code: 'SA', flag: 'SA' },
      { name: 'United Kingdom', code: 'GB', flag: 'GB' },
      { name: 'France', code: 'FR', flag: 'FR' },
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
      }
    }

    // ── 3. Seed Divisions ──────────────────────────────────────────────────
    const divisions = ['Levant', 'Gulf', 'Europe', 'Africa', 'Global'];
    for (const name of divisions) {
      const existing = await qr.query(
        `SELECT id FROM divisions WHERE name = $1 AND "deletedAt" IS NULL`,
        [name],
      );
      if (existing.length === 0) {
        await qr.query(`INSERT INTO divisions (name) VALUES ($1)`, [name]);
        console.log(`  ✓ Division seeded: ${name}`);
      }
    }

    // ── 4. Seed Default Workflow ───────────────────────────────────────────
    const wfName = 'Default Manager Approval';
    let wfId: string;
    const existingWf = await qr.query(
      `SELECT id FROM approval_workflows WHERE name = $1 AND "deletedAt" IS NULL`,
      [wfName],
    );

    if (existingWf.length === 0) {
      const [wf] = await qr.query(
        `INSERT INTO approval_workflows (name, status) VALUES ($1, 'ACTIVE') RETURNING id`,
        [wfName],
      );
      wfId = wf.id;
      await qr.query(
        `INSERT INTO approval_workflow_steps ("workflow_id", "step_order", "approver_type", "is_required")
         VALUES ($1, 1, 'MANAGER', true)`,
        [wfId],
      );
      console.log(`  ✓ Workflow seeded: ${wfName}`);
    } else {
      wfId = existingWf[0].id;
    }

    // ── 5. Seed Default Leave Policy ──────────────────────────────────────
    const policyName = 'Standard Global Leave Policy';
    let policyId: string;
    const [lbCountry] = await qr.query(`SELECT id FROM countries WHERE code = 'LB'`);
    const existingPol = await qr.query(
      `SELECT id FROM leave_policies WHERE policy_name = $1 AND "deletedAt" IS NULL`,
      [policyName],
    );

    if (existingPol.length === 0) {
      const [pol] = await qr.query(
        `INSERT INTO leave_policies ("policy_name", "country_id", "working_hours_per_day", "approval_workflow_id", "weekend_days", "status")
         VALUES ($1, $2, 8.0, $3, '{0,6}', 'ACTIVE')
         RETURNING id`,
        [policyName, lbCountry.id, wfId],
      );
      policyId = pol.id;
      console.log(`  ✓ Policy seeded: ${policyName}`);
    } else {
      policyId = existingPol[0].id;
    }

    // Seed additional rules
    const leaveTypesToSeed = [
      { key: 'annual', entitlement: 20.00 },
      { key: 'sick', entitlement: 10.00 },
      { key: 'unpaid', entitlement: 0.00 },
      { key: 'maternity', entitlement: 90.00 },
      { key: 'bereavement', entitlement: 3.00 },
    ];

    for (const ltData of leaveTypesToSeed) {
      const [lt] = await qr.query(`SELECT id FROM leave_types WHERE key = $1`, [ltData.key]);
      if (lt) {
        // Check if rule already exists
        const [existingRule] = await qr.query(
          `SELECT id FROM leave_rules WHERE policy_id = $1 AND leave_type_id = $2`,
          [policyId, lt.id]
        );
        if (!existingRule) {
          await qr.query(
            `INSERT INTO leave_rules ("policy_id", "leave_type_id", "entitlement_days", "is_accrued", "cut_off_type", "reset_type")
             VALUES ($1, $2, $3, false, 'HIRE_DATE', 'NONE')`,
            [policyId, lt.id, ltData.entitlement],
          );
        }
      }
    }

    // ── 6. Seed Sample Employees ───────────────────────────────────────────
    const employeesData = [
      {
        fullName: 'HR Admin User',
        email: 'admin@novelus.com',
        jobTitle: 'HR Director',
        department: 'Human Resources',
        role: 'HR_ADMIN',
        hireDate: '2022-01-10',
      },
      {
        fullName: 'Gabriel Habre',
        email: 'gabriel@novelus.com',
        jobTitle: 'Engineering Manager',
        department: 'Engineering',
        role: 'MANAGER',
        hireDate: '2021-03-15',
      },
      {
        fullName: 'Maram El-Din',
        email: 'maram@novelus.com',
        jobTitle: 'Senior Frontend Developer',
        department: 'Engineering',
        role: 'EMPLOYEE',
        hireDate: '2023-06-01',
      },
    ];

    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().slice(0, 10);
    const [annualLt] = await qr.query(`SELECT id FROM leave_types WHERE key = 'annual'`);

    for (const emp of employeesData) {
      const existingEmp = await qr.query(
        `SELECT id FROM employees WHERE email = $1 AND "deletedAt" IS NULL`,
        [emp.email],
      );

      let empId: string;
      if (existingEmp.length === 0) {
        const [inserted] = await qr.query(
          `INSERT INTO employees ("full_name", "email", "job_title", "department", "country_id", "status", "role", "hire_date")
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
           RETURNING id`,
          [emp.fullName, emp.email, emp.jobTitle, emp.department, lbCountry.id, emp.role, emp.hireDate],
        );
        empId = inserted.id;

        // Policy Assignment
        await qr.query(
          `INSERT INTO employee_policy_assignments ("employee_id", "leave_policy_id", "effective_from", "is_active")
           VALUES ($1, $2, $3, true)`,
          [empId, policyId, currentDate],
        );

        // Balance & Initial Grant Ledger (20.00 days for annual leave)
        if (annualLt) {
          const [bal] = await qr.query(
            `INSERT INTO leave_balances ("employee_id", "leave_type_id", "year", "available_balance")
             VALUES ($1, $2, $3, 20.00)
             RETURNING id`,
            [empId, annualLt.id, currentYear],
          );

          await qr.query(
            `INSERT INTO leave_ledger_entries ("balance_id", "employee_id", "leave_type_id", "transaction_type", "signed_amount", "resulting_balance", "reason", "reference_type")
             VALUES ($1, $2, $3, 'INITIAL_GRANT', 20.00, 20.00, 'Initial frontloaded policy grant', 'LEAVE_POLICY')`,
            [bal.id, empId, annualLt.id],
          );
        }
        console.log(`  ✓ Employee & Balance seeded: ${emp.fullName}`);
      } else {
        console.log(`  ○ Employee skipped (exists): ${emp.fullName}`);
      }
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
