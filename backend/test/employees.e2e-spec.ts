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

describeDb('Employees E2E (PostgreSQL live)', () => {
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
      console.log('Skipping Employees E2E: DB not available');
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
    'POST /api/v1/employees -> Create employee with policy assignment & balances',
    skipIfNoDb(async () => {
      const policiesRes = await request(app.getHttpServer()).get(
        '/api/v1/policies',
      );
      expect(policiesRes.status).toBe(200);
      const policy = policiesRes.body.data[0];
      expect(policy).toBeDefined();

      const createPayload = {
        fullName: `E2E User ${runId}`,
        email: `e2e.${runId}@novelus.com`,
        jobTitle: 'QA Engineer',
        department: 'Quality Assurance',
        countryCode: policy.country?.code || 'LB',
        policyId: policy.id,
        hireDate: '2024-01-01',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .send(createPayload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(`e2e.${runId}@novelus.com`);

      createdIds.employees.push(res.body.id);

      // Track generated sub-resources
      const epas = await dataSource.query(
        `SELECT id FROM employee_policy_assignments WHERE employee_id = $1`,
        [res.body.id],
      );
      createdIds.assignments.push(...epas.map((r: { id: string }) => r.id));

      const bals = await dataSource.query(
        `SELECT id FROM leave_balances WHERE employee_id = $1`,
        [res.body.id],
      );
      createdIds.balances.push(...bals.map((r: { id: string }) => r.id));

      const lles = await dataSource.query(
        `SELECT id FROM leave_ledger_entries WHERE employee_id = $1`,
        [res.body.id],
      );
      createdIds.ledgerEntries.push(...lles.map((r: { id: string }) => r.id));
    }),
  );

  it(
    'GET /api/v1/employees -> List and filter created employee',
    skipIfNoDb(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .query({ q: runId });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].email).toBe(`e2e.${runId}@novelus.com`);
    }),
  );

  it(
    'DELETE /api/v1/employees/:id -> Soft delete (archive) employee',
    skipIfNoDb(async () => {
      const empId = createdIds.employees[0];
      const res = await request(app.getHttpServer()).delete(
        `/api/v1/employees/${empId}`,
      );
      expect(res.status).toBe(204);

      const getRes = await request(app.getHttpServer()).get(
        `/api/v1/employees/${empId}`,
      );
      expect(getRes.status).toBe(404);
    }),
  );
});
