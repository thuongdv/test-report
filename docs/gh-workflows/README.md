# GitHub Actions Pipeline: PR Validation & AI Agent Architecture

This directory documents the multi-stage GitHub Actions pipeline designed to validate Pull Requests and automatically generate unit tests using modular AI agents.

---

## 🏗️ Architecture Overview

The pipeline uses a **modular Agent-Skill architecture** where each AI task is handled by a dedicated agent composed of reusable skills.

```text
Developer creates/updates PR
            │
            ▼
┌──────────────────────────────────────┐
│ .github/workflows/pr-validation.yml  │
├──────────────────────────────────────┤
│ 1. npm run format:check              │
│ 2. npm run lint                      │
│ 3. npm test                          │
│ 4. CodeReviewAgent (cli.ts review)   │
└──────────────────────────────────────┘
            │
      (Success Only)
            ▼
┌───────────────────────────────────────────────────┐
│ .github/workflows/generate-unit-tests.yml         │
├───────────────────────────────────────────────────┤
│ 1. UnitTestGeneratorAgent (cli.ts generate-tests) │
│    - Detect changed production source files       │
│    - Generate Jest unit tests via Gemini          │
│    - Validation & Retry Loop (Up to 3 Attempts)  │
│ 2. CreatePRAgent (cli.ts create-pr)               │
│    - Commit tests to ai/ branch & open PR         │
└───────────────────────────────────────────────────┘
```

---

## 🤖 Agent Architecture

All agents live under `scripts/agents/` and are invoked via a unified CLI:

```bash
npx ts-node scripts/agents/cli.ts <agent-name> [options]
```

### Agents

| Agent | CLI Command | Description |
|-------|-------------|-------------|
| `CodeReviewAgent` | `cli.ts review` | AI-powered code review on PR diffs |
| `UnitTestGeneratorAgent` | `cli.ts generate-tests` | Generate & validate unit tests |
| `CreatePRAgent` | `cli.ts create-pr` | Create/update AI PR with generated tests |

### Skills (Reusable Components)

| Skill | Description |
|-------|-------------|
| `GitDiffSkill` | Extracts git diffs between refs |
| `FileAnalysisSkill` | Detects changed source files + discovers nearby test context |
| `PromptLoaderSkill` | Loads co-located prompt templates with variable substitution |
| `JestRunnerSkill` | Runs Jest test suite, captures results, format/lint auto-fix |
| `PullRequestSkill` | Git branch ops, GitHub PR creation/update, comment posting |

### Design Principles

- **Composition over Inheritance**: Agents implement `IAgent` interface; skills implement `ISkill` interface. No abstract base classes.
- **Skills are stateless**: Each skill receives context as input and returns a typed result.
- **Structured observability**: Every agent and skill logs with `[AgentName][SkillName]` prefixes for CI debugging.

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

When generated unit tests fail initial execution (handled inside `UnitTestGeneratorAgent`):
1. Format & lint auto-fix is applied.
2. Tests are re-run.
3. If still failing, Gemini receives the source file, the failing test file, and the error traceback via `fix-prompt.md`.
4. Gemini regenerates corrected test files without altering production logic.
5. Up to 3 attempts are executed. If tests still fail after 3 attempts, the agent returns failure and the workflow stops.

---

## 🚀 How AI PRs are Handled

1. Generated unit tests (`*.spec.ts` or `*.test.tsx`) are committed to a temporary branch named `ai/generated-tests/<PR-number>`.
2. A child Pull Request is automatically opened against the developer's original feature branch.
3. The developer reviews the generated test cases and chooses whether to merge them into their feature branch.
