## Context

Currently, test reporting clients need to report test runs and upload artifacts separately. To streamline reporting and eliminate multi-step upload orchestration, NestJS needs a single `POST /api/v1/runs/ingest` endpoint capable of processing both JSON metadata (run summary, test cases, execution duration) and attached trace binary archives (Playwright/Cypress `.zip` traces, screenshots) in a unified `multipart/form-data` request.

## Goals / Non-Goals

**Goals:**
- Provide a unified `POST /api/v1/runs/ingest` endpoint in the NestJS API app.
- Accept multipart requests with a `payload` field (JSON containing run details) and file attachments (`trace` / `files`).
- Parse and validate JSON payload data using NestJS pipes and shared contract DTOs in `packages/shared`.
- Persist uploaded binary trace files to local storage (`uploads/traces`) with generated unique filenames.
- Return structured status summary response with `runId`, processed test statistics, and stored attachment URLs.

**Non-Goals:**
- Real-time WebSocket streaming of live test execution progress during run ingestion.
- Full cloud S3 object storage driver setup (start with configurable local disk storage driver with abstraction interface).

## Decisions

### 1. Multipart Form Handling with NestJS File Interceptors
- **Decision:** Use NestJS `@UseInterceptors(FileFieldsInterceptor(...))` or `FilesInterceptor` powered by `multer`.
- **Rationale:** Standard NestJS pattern for receiving JSON fields alongside binary files in a single request.
- **Alternatives Considered:** 
  - *Base64 encoding trace files inside JSON*: Causes ~33% payload bloat and high memory footprint during parsing.
  - *Two-step upload (presigned URL / create run first, upload trace second)*: Adds complexity to CLI reporters.

### 2. DTO Validation and Shared Contracts
- **Decision:** Define `IngestRunPayloadDto` and `IngestRunResponseDto` in `@test-report/shared` package (or `apps/api/src/runs/dto`), using custom transformation pipe to parse stringified JSON in `multipart/form-data` fields.
- **Rationale:** When sending `multipart/form-data`, body fields are sent as strings. A custom `ParseJsonPipe` converts `req.body.payload` to a JS object before passing to `ValidationPipe`.

### 3. File Storage Architecture
- **Decision:** Implement a modular `StorageService` interface with a `LocalStorageDriver` initial implementation, saving files under `uploads/traces/<year>/<month>/<uuid>.zip`.
- **Rationale:** Keeps file management decoupled from controller logic and enables seamless future transition to AWS S3 / Google Cloud Storage.

## Risks / Trade-offs

- **[Risk] Large trace file upload memory impact** → *Mitigation:* Enforce file size limits in Multer options (e.g., 50MB max per trace file) and disk stream writing.
- **[Risk] Malformed JSON payload in multipart text field** → *Mitigation:* Implement `ParseJsonPipe` with explicit `BadRequestException` handling for JSON syntax errors before controller execution.
