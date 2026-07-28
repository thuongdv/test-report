import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '../storage/storage.service';
import { IngestRunPayloadDto, TestStatus } from './dto/ingest-run.dto';
import { RunsService } from './runs.service';

describe('RunsService', () => {
  let service: RunsService;
  let storageService: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunsService,
        {
          provide: StorageService,
          useValue: {
            saveTraceFile: jest.fn().mockResolvedValue({
              filename: 'test-trace.zip',
              originalname: 'trace.zip',
              path: 'uploads/traces/test-trace.zip',
              size: 1024,
              mimetype: 'application/zip',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RunsService>(RunsService);
    storageService = module.get<StorageService>(StorageService);
  });

  it('should ingest run payload and return summary', async () => {
    const payload: IngestRunPayloadDto = {
      projectName: 'Demo Project',
      suiteName: 'E2E Suite',
      tests: [
        { title: 'Test 1', status: TestStatus.PASSED },
        { title: 'Test 2', status: TestStatus.FAILED },
        { title: 'Test 3', status: TestStatus.SKIPPED },
      ],
    };

    const mockFile = {
      originalname: 'trace.zip',
      buffer: Buffer.from('fake zip data'),
      size: 1024,
      mimetype: 'application/zip',
    } as Express.Multer.File;

    const result = await service.ingestRun(payload, [mockFile]);

    expect(result.success).toBe(true);
    expect(result.runId).toMatch(/^run_/);
    expect(result.summary).toEqual({
      total: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
    });
    expect(result.attachments.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(storageService.saveTraceFile).toHaveBeenCalledWith(mockFile);
  });
});
