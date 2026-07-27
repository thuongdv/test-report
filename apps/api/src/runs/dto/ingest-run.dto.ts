import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum TestStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum RunStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  COMPLETED = 'completed',
}

export class TestCaseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(TestStatus)
  status: TestStatus;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;
}

export class IngestRunPayloadDto {
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @IsString()
  @IsNotEmpty()
  suiteName: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  commit?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsEnum(RunStatus)
  status?: RunStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  tests?: TestCaseDto[];
}

export interface StoredAttachmentMeta {
  filename: string;
  originalname: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface IngestRunResponseDto {
  success: boolean;
  runId: string;
  ingestedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  attachments: StoredAttachmentMeta[];
}
