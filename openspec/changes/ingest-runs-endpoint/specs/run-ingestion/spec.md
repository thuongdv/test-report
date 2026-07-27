## ADDED Requirements

### Requirement: Unified Ingest Endpoint
The NestJS backend SHALL expose a POST endpoint at `/api/v1/runs/ingest` accepting `multipart/form-data` requests containing test execution data and optional trace binary attachments.

#### Scenario: Ingesting valid test run payload with attached trace file
- **WHEN** a client sends a `POST /api/v1/runs/ingest` request with valid JSON metadata in the `payload` field and a `.zip` file in the `trace` upload field
- **THEN** the server SHALL accept the request, process test run metadata, store the uploaded trace file, and return an HTTP 201 Created status.

#### Scenario: Ingesting valid test run payload without attachments
- **WHEN** a client sends a `POST /api/v1/runs/ingest` request with a valid `payload` JSON field but no attached files
- **THEN** the server SHALL process the test run metadata and return an HTTP 201 Created status.

### Requirement: Payload & Attachment Validation
The system SHALL validate the structure of the JSON payload and restrict uploaded trace attachment file types and sizes.

#### Scenario: Rejecting invalid payload structure
- **WHEN** a client sends a `POST /api/v1/runs/ingest` request with malformed JSON or missing required fields (e.g. `projectName`, `suiteName`, `results`) in the `payload` field
- **THEN** the server SHALL return an HTTP 400 Bad Request error detailing validation failures.

#### Scenario: Rejecting unsupported file formats
- **WHEN** a client uploads an attachment with an unsupported extension or MIME type (non-zip/trace archive)
- **THEN** the server SHALL reject the upload with an HTTP 400 Bad Request error.

### Requirement: Trace File Storage & Metadata Linking
The system SHALL store uploaded trace files to designated storage (local uploads directory or object storage) and record the storage URI and file metadata linked to the corresponding test run/case record.

#### Scenario: Trace persistence and linkage
- **WHEN** an attachment is successfully received during run ingestion
- **THEN** the server SHALL save the file, generate a persistent storage path/URL, and link the trace file metadata to the ingested test run record.

### Requirement: Unified Response Format
The server SHALL return a consistent JSON response containing the generated `runId`, ingestion timestamp, counts of processed tests, and file upload references.

#### Scenario: Response structure verification
- **WHEN** run ingestion succeeds
- **THEN** the response body SHALL contain `success: true`, `runId`, `ingestedAt`, `summary` (total, passed, failed, skipped), and an array of `attachments` metadata.
