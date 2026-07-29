/**
 * Core type definitions for the Agent-Skill architecture.
 *
 * Design: Composition over inheritance — all contracts are interfaces,
 * no abstract base classes.
 */

// ---------------------------------------------------------------------------
// Context & Result
// ---------------------------------------------------------------------------

/**
 * Shared runtime context threaded through all agents and skills.
 * Built from environment variables + CLI arguments by cli.ts.
 */
export interface AgentContext {
  /** Working directory (usually repo root). */
  workDir: string;

  /** All environment variables available to the agent. */
  env: Record<string, string>;

  /** Base git ref for diff comparison (e.g., 'origin/main'). */
  baseRef: string;

  /** Head git ref (e.g., 'HEAD'). */
  headRef: string;

  /** PR number (from GITHUB_REPOSITORY context). */
  prNumber?: string;

  /** PR head branch name. */
  prBranch?: string;

  /** GitHub repository in 'owner/repo' format. */
  repository?: string;

  /** Additional CLI arguments forwarded to the agent. */
  args: string[];
}

/**
 * Structured result returned by every agent.
 * Workflows use `status` to decide exit codes.
 */
export interface AgentResult {
  /** Overall execution outcome. */
  status: 'success' | 'failure' | 'skipped';

  /** Human-readable summary for CI logs. */
  summary: string;

  /** Agent-specific typed output payload. */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent & Skill Interfaces
// ---------------------------------------------------------------------------

/**
 * An Agent is a high-level orchestrator that composes skills to accomplish
 * a discrete CI task (e.g., code review, test generation).
 */
export interface IAgent {
  /** Unique agent identifier (e.g., 'code-review', 'unit-test'). */
  readonly name: string;

  /** Execute the agent's workflow and return a structured result. */
  run(context: AgentContext): Promise<AgentResult>;
}

/**
 * A Skill is a stateless, reusable capability that agents compose.
 *
 * @typeParam TInput  - Typed input the skill expects.
 * @typeParam TOutput - Typed output the skill produces.
 */
export interface ISkill<TInput, TOutput> {
  /** Unique skill identifier (e.g., 'git-diff', 'jest-runner'). */
  readonly name: string;

  /** Execute the skill with the given input and shared context. */
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Typed error thrown by skills for structured error propagation.
 * Agents catch these to decide whether to retry, skip, or fail.
 */
export class SkillError extends Error {
  constructor(
    public readonly skillName: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${skillName}] ${message}`);
    this.name = 'SkillError';
  }
}
