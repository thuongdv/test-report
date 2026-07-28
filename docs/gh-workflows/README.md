# GitHub Actions Pipeline: PR Validation & AI Unit Test Generation

This directory documents the multi-stage GitHub Actions pipeline designed to validate Pull Requests and automatically generate unit tests for modified source files using Gemini.

---

## 🏗️ Workflows Architecture

```text
Developer creates/updates PR
            │
            ▼
┌──────────────────────────────────────┐
│ .github/workflows/pr-validation.yml   │
├──────────────────────────────────────┤
│ 1. npm run format:check              │
│ 2. npm run lint                      │
│ 3. npm test                          │
│ 4. Gemini AI PR Review (CLI)         │
└──────────────────────────────────────┘
            │
      (Success Only)
            ▼
┌───────────────────────────────────────────────┐
│ .github/workflows/generate-unit-tests.yml     │
├───────────────────────────────────────────────┤
│ 1. Detect changed production source files     │
│ 2. Generate NestJS/Jest unit tests via Gemini │
│ 3. Validation & Retry Loop (Up to 3 Attempts) │
│    - npm run format                           │
│    - npm run lint -- --fix                    │
│    - npm test                                 │
│ 4. Commit generated tests to temporary branch │
│ 5. Create PR targeting developer's branch     │
└───────────────────────────────────────────────┘
```

---

## 🔑 Required Secrets & Variables

### Secrets

Configure in GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**:

- `GEMINI_API_KEY`: Google Gemini API key (from Google AI Studio). Required by both workflows.
- `GITHUB_TOKEN`: Standard GitHub Actions token automatically provided by GitHub. Requires:
  - `contents: write`
  - `pull-requests: write`

### Variables (Optional)

- `GEMINI_MODEL`: Gemini model version to use. Defaults to `gemini-2.5-flash` if not set. Recommended options: `gemini-2.5-flash`, `gemini-2.5-pro`.

---

## 🛡️ Loop Prevention

To prevent infinite workflow recursion when AI-generated test PRs are submitted:
- Both workflows exclude branches beginning with `ai/` (`branches-ignore: ['ai/**']`).
- `generate-unit-tests.yml` checks `!startsWith(github.event.workflow_run.head_branch, 'ai/')`.

---

## 🔄 Retry Loop Logic

When generated unit tests fail initial execution:
1. The error log is saved to `test_run.log`.
2. `generate-tests.ts` is called with `--fix-mode --error-output test_run.log`.
3. Gemini receives the source file, the failing test file, and the error traceback.
4. Gemini regenerates corrected test files without altering production logic.
5. Up to 3 attempts are executed. If tests still fail after 3 attempts, the workflow fails fast and does NOT create a PR.

---

## 🚀 How AI PRs are Handled

1. Generated unit tests (`*.spec.ts` or `*.test.tsx`) are committed to a temporary branch named `ai/generated-tests/<PR-number>`.
2. A child Pull Request is automatically opened against the developer's original feature branch.
3. The developer reviews the generated test cases and chooses whether to merge them into their feature branch.
