/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
jest.setTimeout(60000);

const describeDb =
  process.env.TEST_E2E_DB === 'true' ? describe : describe.skip;

describeDb('LeaveBalances E2E (PostgreSQL live)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let hasDb = false;

  const runId = Date.now().toString(36);
  const createdIds: {
    employees: string[];
    assignments: string[];
    balances: string[];
    ledgerEntries: string[];
  } = {
    employees: [],
    assignments: [],
    balances: [],
    ledgerEntries: [],
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();

      dataSource = app.get(DataSource);
      hasDb = dataSource.isInitialized;
    } catch {
      console.log('Skipping LeaveBalances E2E: DB not available');
      hasDb = false;
    }
  });

  afterAll(async () => {
    if (!hasDb || !dataSource) return;

    try {
      await dataSource.transaction(async (em) => {
        if (createdIds.ledgerEntries.length) {
          await em.query(
            `DELETE FROM leave_ledger_entries WHERE id = ANY($1)`,
            [createdIds.ledgerEntries],
          );
        }
        if (createdIds.balances.length) {
          await em.query(`DELETE FROM leave_balances WHERE id = ANY($1)`, [
            createdIds.balances,
          ]);
        }
        if (createdIds.assignments.length) {
          await em.query(
            `DELETE FROM employee_policy_assignments WHERE id = ANY($1)`,
            [createdIds.assignments],
          );
        }
        if (createdIds.employees.length) {
          await em.query(`DELETE FROM employees WHERE id = ANY($1)`, [
            createdIds.employees,
          ]);
        }
      });
    } catch (e) {
      console.error('E2E cleanup error:', e);
    }

    if (app) await app.close();
  });

  const skipIfNoDb = (fn: () => Promise<void>) => async () => {
    if (!hasDb) {
      console.warn('DB not initialized. Skipping test.');
      return;
    }
    await fn();
  };

  it(
    'POST /api/v1/leave-balances/adjust -> Atomic adjustment & ledger entry',
    skipIfNoDb(async () => {
      // Get a policy to create an employee with
      const policiesRes = await request(app.getHttpServer()).get(
        '/api/v1/policies',
      );
      const policy = policiesRes.body.data[0];

      // Get leave types (paginated response: { data: [...] })
      const leaveTypesRes = await request(app.getHttpServer()).get(
        '/api/v1/leave-types',
      );
      const annualLt = leaveTypesRes.body.data.find(
        (lt: { key: string }) => lt.key === 'annual',
      );
      expect(annualLt).toBeDefined();

      // Create employee
      const empRes = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .send({
          fullName: `Bal User ${runId}`,
          email: `bal.${runId}@novelus.com`,
          jobTitle: 'Accountant',
          department: 'Finance',
          countryCode: policy.country?.code || 'LB',
          policyId: policy.id,
          hireDate: '2024-01-01',
        });
      expect(empRes.status).toBe(201);
      const empId = empRes.body.id as string;
      createdIds.employees.push(empId);

      // Track sub-resources for cleanup
      const epas = await dataSource.query(
        `SELECT id FROM employee_policy_assignments WHERE employee_id = $1`,
        [empId],
      );
      createdIds.assignments.push(...epas.map((r: { id: string }) => r.id));

      const bals = await dataSource.query(
        `SELECT id FROM leave_balances WHERE employee_id = $1`,
        [empId],
      );
      createdIds.balances.push(...bals.map((r: { id: string }) => r.id));

      const existingLles = await dataSource.query(
        `SELECT id FROM leave_ledger_entries WHERE employee_id = $1`,
        [empId],
      );
      createdIds.ledgerEntries.push(
        ...existingLles.map((r: { id: string }) => r.id),
      );

      // Adjust balance
      const key = `idemp-${runId}-1`;
      const adjustRes = await request(app.getHttpServer())
        .post('/api/v1/leave-balances/adjust')
        .send({
          employeeId: empId,
          leaveTypeId: annualLt.id,
          year: 2026,
          amount: 5,
          reason: 'E2E adjustment test',
          idempotencyKey: key,
        });

      expect(adjustRes.status).toBe(201);
      expect(adjustRes.body.signedAmount).toBe(5);
      expect(adjustRes.body.idempotencyKey).toBe(key);
      createdIds.ledgerEntries.push(adjustRes.body.id as string);

      // Test Idempotency reuse with SAME payload -> 201 (same record returned)
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/leave-balances/adjust')
        .send({
          employeeId: empId,
          leaveTypeId: annualLt.id,
          year: 2026,
          amount: 5,
          reason: 'E2E adjustment test',
          idempotencyKey: key,
        });
      expect(reuseRes.status).toBe(201);
      expect(reuseRes.body.id).toBe(adjustRes.body.id);

      // Test Idempotency reuse with DIFFERENT payload -> 409 Conflict
      const conflictRes = await request(app.getHttpServer())
        .post('/api/v1/leave-balances/adjust')
        .send({
          employeeId: empId,
          leaveTypeId: annualLt.id,
          year: 2026,
          amount: 10,
          reason: 'Different payload',
          idempotencyKey: key,
        });
      expect(conflictRes.status).toBe(409);
    }),
  );

  it(
    'GET /api/v1/leave-balances/ledger -> Query ledger history',
    skipIfNoDb(async () => {
      const empId = createdIds.employees[0];
      const res = await request(app.getHttpServer())
        .get('/api/v1/leave-balances/ledger')
        .query({ employeeId: empId });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    }),
  );
});
