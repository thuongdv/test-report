# Test Report Portal

Automated test reports web application storing test result historical data and AI-assisted failure analysis.

Monorepo workspace structure:
- `apps/api`: NestJS backend API
- `apps/web`: Next.js frontend UI
- `packages/shared`: Shared TypeScript utilities

---

## 🛠 Local Setup & Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation & Commands

```bash
# Install dependencies
npm ci

# Start development servers
npm run dev

# Format code across monorepo
npm run format

# Verify formatting
npm run format:check

# Run linter across monorepo
npm run lint

# Run all unit tests across monorepo
npm test
```

---

## 🚀 GitHub Actions Workflows

This repository uses a two-stage automated pipeline for PR validation and AI unit test generation.

### Workflows

1. **PR Validation (`.github/workflows/pr-validation.yml`)**
   - **Triggers**: Opened, synchronized, or reopened Pull Requests (excluding `ai/*` branches).
   - **Steps**: Runs format checking (`npm run format:check`), linting (`npm run lint`), Jest unit tests (`npm test`), and Gemini AI PR review via the Gemini CLI.
   - **Outcome**: Annotates PR with code review feedback and fails fast if critical issues or failing tests are found.

2. **AI Unit Test Generation (`.github/workflows/generate-unit-tests.yml`)**
   - **Triggers**: Automatically after successful completion of PR Validation (`workflow_run`).
   - **Steps**:
     - Detects changed production source files (ignoring test, doc, and config files).
     - Generates Jest unit tests tailored for NestJS or React using Gemini AI.
     - Validates generated tests in a 3-attempt retry loop (formatting, linting, and running Jest).
     - Commits valid test files to a temporary branch (`ai/generated-tests/<PR-number>`).
     - Opens a child Pull Request targeting the developer's feature branch for manual review.

### Required Secrets & Variables

In your GitHub repository settings under **Settings -> Secrets and variables -> Actions**:

| Name | Type | Description |
|------|------|-------------|
| `GEMINI_API_KEY` | Secret | Required. Google Gemini API key from Google AI Studio. |
| `GEMINI_MODEL` | Variable | Optional. Model version (e.g. `gemini-2.5-flash` or `gemini-2.5-pro`). Default is `gemini-2.5-flash`. |
| `GITHUB_TOKEN` | Secret | Automatic. Requires repository read/write permissions for contents & pull-requests. |

For detailed workflow architecture and troubleshooting, see [docs/gh-workflows/README.md](file:///media/lap25-3582/DATA/Projects/thuongdv/test-report/docs/gh-workflows/README.md).
