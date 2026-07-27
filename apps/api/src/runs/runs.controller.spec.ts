import { Test, TestingModule } from '@nestjs/testing';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { TestStatus } from './dto/ingest-run.dto';

describe('RunsController', () => {
  let controller: RunsController;
  let runsService: RunsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunsController],
      providers: [
        {
          provide: RunsService,
          useValue: {
            ingestRun: jest.fn().mockResolvedValue({
              success: true,
              runId: 'run_123456',
              ingestedAt: '2026-07-27T00:00:00.000Z',
              summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
              attachments: [],
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<RunsController>(RunsController);
    runsService = module.get<RunsService>(RunsService);
  });

  it('should process ingest request with payload', async () => {
    const payloadObj = {
      projectName: 'Test App',
      suiteName: 'Unit Tests',
      tests: [{ title: 'Spec 1', status: TestStatus.PASSED }],
    };

    const response = await controller.ingest(payloadObj);

    expect(response.success).toBe(true);
    expect(response.runId).toBe('run_123456');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(runsService.ingestRun).toHaveBeenCalled();
  });
});
