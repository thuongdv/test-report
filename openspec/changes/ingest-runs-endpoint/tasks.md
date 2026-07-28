## 1. DTO Contracts & Utilities

- [x] 1.1 Create DTO schemas and interfaces for run ingestion request and response payloads in `packages/shared` or `apps/api`
- [x] 1.2 Implement NestJS custom pipe `ParseJsonPipe` to safely extract and validate JSON body payloads from multipart form requests

## 2. Storage Service & Module

- [x] 2.1 Create storage service interface and local disk storage driver for trace archive files under `uploads/traces`
- [x] 2.2 Configure file upload options (max file size, file filter for `.zip` and trace extensions)

## 3. NestJS Endpoint Implementation

- [x] 3.1 Create `RunsModule`, `RunsController`, and `RunsService` in `apps/api/src/runs`
- [x] 3.2 Implement `POST /api/v1/runs/ingest` handler with `FileFieldsInterceptor` / `FileInterceptor`
- [x] 3.3 Register `RunsModule` in `AppModule`

## 4. Testing & Verification

- [x] 4.1 Create unit tests for `RunsController` and `RunsService`
- [x] 4.2 Create E2E test verifying multipart `POST /api/v1/runs/ingest` with JSON payload and attached trace file
