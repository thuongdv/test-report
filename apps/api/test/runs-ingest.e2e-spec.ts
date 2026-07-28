import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Runs Ingest (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/runs/ingest - successful multipart ingest with trace file', async () => {
    const payload = {
      projectName: 'Frontend E2E',
      suiteName: 'Playwright Suite',
      environment: 'CI',
      tests: [
        { title: 'Login test', status: 'passed', duration: 1200 },
        {
          title: 'Checkout test',
          status: 'failed',
          duration: 3400,
          error: 'Element not found',
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/runs/ingest')
      .field('payload', JSON.stringify(payload))
      .attach('trace', Buffer.from('mock trace zip binary contents'), {
        filename: 'playwright-trace.zip',
        contentType: 'application/zip',
      })
      .expect(201);

    const body = response.body as Record<string, any>;
    expect(body.success).toBe(true);
    expect(body.runId).toBeDefined();
    expect(body.summary).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
    });
    const attachments = body.attachments as Array<Record<string, any>>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].originalname).toBe('playwright-trace.zip');
  });

  it('POST /api/v1/runs/ingest - 400 Bad Request on missing payload', async () => {
    await request(app.getHttpServer()).post('/api/v1/runs/ingest').expect(400);
  });
});
