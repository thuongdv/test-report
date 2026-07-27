import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { StorageService } from '../storage/storage.service';
import {
  IngestRunPayloadDto,
  IngestRunResponseDto,
  StoredAttachmentMeta,
  TestStatus,
} from './dto/ingest-run.dto';

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(private readonly storageService: StorageService) {}

  async ingestRun(
    payload: IngestRunPayloadDto,
    files?: Express.Multer.File[],
  ): Promise<IngestRunResponseDto> {
    const runId = `run_${crypto.randomUUID()}`;
    const ingestedAt = new Date().toISOString();

    const tests = payload.tests ?? [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    tests.forEach((test) => {
      if (test.status === TestStatus.PASSED) passed++;
      else if (test.status === TestStatus.FAILED) failed++;
      else if (test.status === TestStatus.SKIPPED) skipped++;
    });

    const summary = {
      total: tests.length,
      passed,
      failed,
      skipped,
    };

    const attachments: StoredAttachmentMeta[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const savedMeta = await this.storageService.saveTraceFile(file);
        attachments.push(savedMeta);
      }
    }

    this.logger.log(
      `Ingested run ${runId} for project '${payload.projectName}' (suite: '${payload.suiteName}') with ${attachments.length} attachment(s).`,
    );

    return {
      success: true,
      runId,
      ingestedAt,
      summary,
      attachments,
    };
  }
}
