## Why

Currently, test reporting requires separate mechanisms or endpoints for submitting raw test result metrics/payloads and binary trace attachments. Exposing a single unified endpoint `POST /api/v1/runs/ingest` allows CLI reporters (such as Playwright or Cypress uploaders) to send test execution metadata, suite/case results, and attached trace ZIP files in a single atomic payload.

## What Changes

- Implement a unified NestJS controller endpoint `POST /api/v1/runs/ingest` supporting `multipart/form-data` requests containing:
  - `payload`: JSON string or body containing test run execution summary, test suite details, duration, status, and attachment metadata.
  - `files` / `trace`: Multipart file uploads for attached Playwright/Cypress trace files or screenshot artifacts.
- Parse and validate incoming DTO payload using NestJS `ValidationPipe` and Zod/class-validator.
- Store attached trace files to local storage/object storage and associate stored file paths with test run records.
- Persist test run summary and test case metadata in the database service.
- Return structured API response containing `runId`, ingestion status, processed count, and stored artifact metadata.

## Capabilities

### New Capabilities
- `run-ingestion`: Unified ingestion endpoint `POST /api/v1/runs/ingest` accepting test result JSON payloads and attached trace files in a single request.

### Modified Capabilities

## Impact

- **apps/api**: Add `RunsModule`, `RunsController`, `RunsService`, and file upload interceptors (`FileFieldsInterceptor` or `FilesInterceptor`).
- **packages/shared**: Define unified ingest DTO contracts, payload interfaces, and response schemas.
- **Dependencies**: Ensure `@nestjs/platform-express` and `multer` (along with types) are present for multipart form handling.
