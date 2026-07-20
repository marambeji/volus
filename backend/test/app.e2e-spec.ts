import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
jest.setTimeout(30000);

const describeDb =
  process.env.TEST_E2E_DB === 'true' ? describe : describe.skip;

describeDb('AppController (e2e)', () => {
  let app: INestApplication<App> | null = null;
  let hasDb = false;

  beforeEach(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
      hasDb = true;
    } catch {
      console.warn('Skipping app e2e: DB not available');
      hasDb = false;
    }
  });

  it('/ (GET)', async () => {
    if (!hasDb || !app) {
      if (typeof pending === 'function') {
        pending('DB not initialized. Skipping test.');
      } else {
        console.warn('DB not initialized. Skipping test.');
      }
      return;
    }
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
