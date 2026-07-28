import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { traceUploadMulterOptions } from '../common/config/multer-options.config';
import { ParseJsonPipe } from '../common/pipes/parse-json.pipe';
import {
  IngestRunPayloadDto,
  IngestRunResponseDto,
} from './dto/ingest-run.dto';
import { RunsService } from './runs.service';

@Controller('api/v1/runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(AnyFilesInterceptor(traceUploadMulterOptions))
  async ingest(
    @Body('payload') rawPayload?: string | object,
    @Body() fullBody?: Record<string, unknown>,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<IngestRunResponseDto> {
    const targetPayload = rawPayload ?? fullBody;

    if (
      !targetPayload ||
      (typeof targetPayload === 'object' &&
        Object.keys(targetPayload).length === 0)
    ) {
      throw new BadRequestException(
        "Ingestion requires 'payload' body field or JSON body",
      );
    }

    const parseJsonPipe = new ParseJsonPipe();
    const parsedPayload = parseJsonPipe.transform(targetPayload, {
      type: 'body',
      data: 'payload',
    });

    const validationPipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    });

    const validatedPayload = (await validationPipe.transform(parsedPayload, {
      type: 'body',
      metatype: IngestRunPayloadDto,
    })) as IngestRunPayloadDto;

    return this.runsService.ingestRun(validatedPayload, files);
  }
}
