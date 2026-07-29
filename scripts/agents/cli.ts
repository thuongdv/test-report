/**
 * Unified Agent CLI — Entry point for all agent invocations from GitHub Actions workflows.
 *
 * Usage:
 *   npx ts-node scripts/agents/cli.ts <agent-name> [options]
 *
 * Agents:
 *   review           Run AI code review on PR diff
 *   generate-tests   Generate unit tests for changed source files
 *   create-pr        Create AI PR with generated test files
 *
 * Options:
 *   --base-ref <ref>   Base branch reference (default: from BASE_REF env or 'origin/main')
 *   --head-ref <ref>   Head branch reference (default: 'HEAD')
 *   --help             Show help
 *
 * Environment variables consumed:
 *   GEMINI_API_KEY / GOOGLE_API_KEY — Gemini API key
 *   GEMINI_MODEL — Model name (default: gemini-2.5-flash)
 *   GITHUB_TOKEN — GitHub API token
 *   GITHUB_REPOSITORY — owner/repo
 *   PR_NUMBER — Pull request number
 *   PR_BRANCH — PR head branch name
 *   BASE_REF — Base branch for diff comparison
 */

import type { AgentContext, IAgent } from './core/types';
import { CodeReviewAgent } from './code-review/code-review.agent';
import { UnitTestGeneratorAgent } from './unit-test/unit-test.agent';
import { CreatePRAgent } from './create-pr/create-pr.agent';

// ---------------------------------------------------------------------------
// Agent Registry
// ---------------------------------------------------------------------------

const AGENTS: Record<string, () => IAgent> = {
  'review': () => new CodeReviewAgent(),
  'generate-tests': () => new UnitTestGeneratorAgent(),
  'create-pr': () => new CreatePRAgent(),
};

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  agentName: string | null;
  baseRef: string;
  headRef: string;
  showHelp: boolean;
  extraArgs: string[];
}

function parseCliArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // skip node, script path
  let agentName: string | null = null;
  let baseRef = process.env.BASE_REF || 'origin/main';
  let headRef = 'HEAD';
  let showHelp = false;
  const extraArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--base-ref' && i + 1 < args.length) {
      baseRef = args[++i];
    } else if (arg === '--head-ref' && i + 1 < args.length) {
      headRef = args[++i];
    } else if (!arg.startsWith('--') && !agentName) {
      agentName = arg;
    } else {
      extraArgs.push(arg);
    }
  }

  return { agentName, baseRef, headRef, showHelp, extraArgs };
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
Agent CLI — Unified entry point for AI agents.

Usage:
  npx ts-node scripts/agents/cli.ts <agent-name> [options]

Available agents:
  review           Run AI code review on PR diff
  generate-tests   Generate unit tests for changed source files
  create-pr        Create AI PR with generated test files

Options:
  --base-ref <ref>   Base branch reference (default: from BASE_REF env or 'origin/main')
  --head-ref <ref>   Head branch reference (default: 'HEAD')
  --help, -h         Show this help message
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv);

  if (cli.showHelp) {
    printHelp();
    process.exit(0);
  }

  if (!cli.agentName) {
    console.error('Error: No agent name specified.\n');
    printHelp();
    process.exit(1);
  }

  const agentFactory = AGENTS[cli.agentName];
  if (!agentFactory) {
    console.error(`Error: Unknown agent "${cli.agentName}".`);
    console.error(`Available agents: ${Object.keys(AGENTS).join(', ')}\n`);
    process.exit(1);
  }

  // Build AgentContext from environment + CLI args
  const context: AgentContext = {
    workDir: process.cwd(),
    env: process.env as Record<string, string>,
    baseRef: cli.baseRef,
    headRef: cli.headRef,
    prNumber: process.env.PR_NUMBER,
    prBranch: process.env.PR_BRANCH,
    repository: process.env.GITHUB_REPOSITORY,
    args: cli.extraArgs,
  };

  // Instantiate and run the agent
  const agent = agentFactory();
  console.log(`\n🤖 Running agent: ${agent.name}\n`);

  try {
    const result = await agent.run(context);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Agent: ${agent.name}`);
    console.log(`Status: ${result.status}`);
    console.log(`Summary: ${result.summary}`);
    console.log(`${'='.repeat(50)}\n`);

    if (result.status === 'failure') {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Agent "${agent.name}" crashed with an unhandled error:`);
    console.error(error);
    process.exit(1);
  }
}

main();
