/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  HttpStatus,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
jest.setTimeout(60000);

const describeDb =
  process.env.TEST_E2E_DB === 'true' ? describe : describe.skip;

/** Generate a unique <=3-char alphanumeric code, stable for the duration of a test run. */
function uniqueCode(prefix: string): string {
  // base-36 of full timestamp → last 2 chars give 1296 unique values cycling every ~1.3 s
  const ts = Date.now().toString(36).toUpperCase().slice(-2);
  return (prefix + ts).slice(0, 3);
}

describeDb('Leave System (e2e) - Requires Database', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let hasDb = false;

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
    } catch (err) {
      console.log(
        'Skipping e2e database-dependent setup: no database connection.',
      );
      hasDb = false;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Database Dependent Tests', () => {
    beforeEach(function () {
      if (!hasDb) {
        if (typeof pending === 'function') {
          pending('Database is not initialized. Skipping test.');
        } else {
          console.warn('Database is not initialized. Skipping test.');
        }
      }
    });

    // ── Countries ────────────────────────────────────────────────────────────
    it('should CRUD countries', async () => {
      if (!hasDb) return;

      const suffix = Date.now();
      const code = uniqueCode('X');

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/countries')
        .send({ name: `E2ECountry${suffix}`, code, flag: 'TC' })
        .expect(HttpStatus.CREATED);

      const countryId = createRes.body.id;
      expect(countryId).toBeDefined();

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/countries?q=E2ECountry${suffix}`)
        .expect(HttpStatus.OK);
      expect(listRes.body.data.some((c: any) => c.id === countryId)).toBe(true);

      await request(app.getHttpServer())
        .put(`/api/v1/countries/${countryId}`)
        .send({ flag: 'UP' })
        .expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .delete(`/api/v1/countries/${countryId}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    // ── Divisions ────────────────────────────────────────────────────────────
    it('should CRUD divisions', async () => {
      if (!hasDb) return;

      const suffix = Date.now();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/divisions')
        .send({ name: `E2EDivision${suffix}` })
        .expect(HttpStatus.CREATED);

      const divId = createRes.body.id;
      expect(divId).toBeDefined();

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/divisions')
        .expect(HttpStatus.OK);
      expect(listRes.body.data.some((d: any) => d.id === divId)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/divisions/${divId}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    // ── Leave Types ──────────────────────────────────────────────────────────
    it('should CRUD leave types', async () => {
      if (!hasDb) return;

      const suffix = Date.now();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/leave-types')
        .send({
          key: `e2e_type_${suffix}`,
          label: `E2E Leave ${suffix}`,
          trackingMode: 'AVAILABLE_BALANCE',
          color: '#3B82F6',
          displayOrder: 99,
        })
        .expect(HttpStatus.CREATED);

      const typeId = createRes.body.id;
      expect(typeId).toBeDefined();

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/leave-types')
        .expect(HttpStatus.OK);
      expect(listRes.body.data.some((lt: any) => lt.id === typeId)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/leave-types/${typeId}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    // ── Approval Workflows ───────────────────────────────────────────────────
    it('should CRUD approval workflows and validate steps', async () => {
      if (!hasDb) return;

      const suffix = Date.now();

      // 1. Invalid: duplicate step orders → 400
      await request(app.getHttpServer())
        .post('/api/v1/approval-workflows')
        .send({
          name: `Invalid WF ${suffix}`,
          steps: [
            { stepOrder: 1, approverType: 'MANAGER' },
            { stepOrder: 1, approverType: 'HR' },
          ],
        })
        .expect(HttpStatus.BAD_REQUEST);

      // 2. Valid creation
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/approval-workflows')
        .send({
          name: `E2E WF ${suffix}`,
          steps: [
            { stepOrder: 1, approverType: 'MANAGER' },
            { stepOrder: 2, approverType: 'HR' },
          ],
        })
        .expect(HttpStatus.CREATED);

      const wfId = createRes.body.id;
      expect(wfId).toBeDefined();
      expect(createRes.body.steps).toHaveLength(2);

      // 3. Update
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/approval-workflows/${wfId}`)
        .send({ steps: [{ stepOrder: 1, approverType: 'MANAGERS_MANAGER' }] })
        .expect(HttpStatus.OK);
      expect(updateRes.body.steps).toHaveLength(1);
      expect(updateRes.body.steps[0].approverType).toBe('MANAGERS_MANAGER');

      // 4. Soft-delete (no policies reference this workflow)
      await request(app.getHttpServer())
        .delete(`/api/v1/approval-workflows/${wfId}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    // ── Public Holidays ──────────────────────────────────────────────────────
    it('should CRUD public holidays with duplicate prevention and projection', async () => {
      if (!hasDb) return;

      const suffix = Date.now();
      const code = uniqueCode('H');

      const countryRes = await request(app.getHttpServer())
        .post('/api/v1/countries')
        .send({ name: `E2EHolCountry${suffix}`, code, flag: 'HC' })
        .expect(HttpStatus.CREATED);
      const countryId = countryRes.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .send({
          name: 'E2E Holiday',
          date: '2026-12-25',
          countryId,
          isRecurring: true,
        })
        .expect(HttpStatus.CREATED);

      // Duplicate recurring (same month/day + country) → 409
      await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .send({
          name: 'Dupe E2E Holiday',
          date: '2026-12-25',
          countryId,
          isRecurring: true,
        })
        .expect(HttpStatus.CONFLICT);

      // Leap-year projection for 2028
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/holidays?countryId=${countryId}&year=2028`)
        .expect(HttpStatus.OK);
      expect(
        listRes.body.some(
          (h: any) => h.name === 'E2E Holiday' && h.date === '2028-12-25',
        ),
      ).toBe(true);

      // Cleanup country (holidays have ON DELETE CASCADE? No — RESTRICT for country. Soft-delete country is fine)
      await request(app.getHttpServer())
        .delete(`/api/v1/countries/${countryId}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    // ── Leave Policies ───────────────────────────────────────────────────────
    it('should CRUD policies with nested rules & validation constraints', async () => {
      if (!hasDb) return;

      const suffix = Date.now();
      const countryCode = uniqueCode('P');
      const divName = `E2EDiv${suffix}`;
      const ltKey = `e2e_lt_${suffix}`;

      // Create prerequisites
      await request(app.getHttpServer())
        .post('/api/v1/countries')
        .send({ name: `E2EPolCountry${suffix}`, code: countryCode, flag: 'PL' })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/v1/divisions')
        .send({ name: divName })
        .expect(HttpStatus.CREATED);

      const wfRes = await request(app.getHttpServer())
        .post('/api/v1/approval-workflows')
        .send({
          name: `E2E Pol WF ${suffix}`,
          steps: [{ stepOrder: 1, approverType: 'MANAGER' }],
        })
        .expect(HttpStatus.CREATED);
      const approvalWorkflowId = wfRes.body.id;

      await request(app.getHttpServer())
        .post('/api/v1/leave-types')
        .send({
          key: ltKey,
          label: `E2E LT ${suffix}`,
          trackingMode: 'AVAILABLE_BALANCE',
          color: '#3B82F6',
          displayOrder: 1,
        })
        .expect(HttpStatus.CREATED);

      // Create policy
      const policyPayload = {
        policyName: `E2E Policy ${suffix}`,
        countryCode,
        workingHoursPerDay: 8,
        approvalWorkflowId,
        divisionAssignment: divName,
        weekendDays: [5, 6],
        leaveQuotas: [
          {
            leaveType: ltKey,
            entitlementDays: 25,
            isAccrued: false,
            cutOffType: 'FIXED_DATE',
            cutOffMonth: 1,
            cutOffDay: 1,
            resetType: 'YEARLY',
            carryOverEnabled: true,
            maxCarryOver: 5,
          },
        ],
      };

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/policies')
        .send(policyPayload)
        .expect(HttpStatus.CREATED);

      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.divisionAssignment).toBe(divName);
      expect(createRes.body.leaveQuotas[0].leaveType).toBe(ltKey);

      // Update policy
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/policies/${createRes.body.id}`)
        .send({
          policyName: `E2E Policy ${suffix} Updated`,
          leaveQuotas: [
            {
              leaveType: ltKey,
              entitlementDays: 28,
              isAccrued: true,
              accrualInterval: 'MONTHLY',
              accrualRate: 2.33,
              cutOffType: 'HIRE_DATE',
              resetType: 'NONE',
              carryOverEnabled: false,
            },
          ],
        })
        .expect(HttpStatus.OK);

      expect(updateRes.body.policyName).toBe(`E2E Policy ${suffix} Updated`);
      expect(updateRes.body.leaveQuotas[0].isAccrued).toBe(true);
      expect(updateRes.body.leaveQuotas[0].accrualInterval).toBe('MONTHLY');

      // Cleanup: delete policy (releases FK lock on workflow/country)
      await request(app.getHttpServer())
        .delete(`/api/v1/policies/${createRes.body.id}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
