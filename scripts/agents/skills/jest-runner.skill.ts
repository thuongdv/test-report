/**
 * JestRunnerSkill — Runs Jest test suite and captures results.
 *
 * Also provides format/lint auto-fix as a utility method.
 * Replaces the bash retry loop logic in generate-unit-tests.yml (lines 91-119).
 */

import { execSync } from 'child_process';
import type { ISkill, AgentContext } from '../core/types';
import { SkillError } from '../core/types';

export interface JestRunnerInput {
  /** Test command to run. Defaults to 'npm test'. */
  command?: string;
}

export interface JestRunnerOutput {
  /** Whether all tests passed. */
  passed: boolean;
  /** Full stdout + stderr output from the test run. */
  output: string;
}

export class JestRunnerSkill implements ISkill<JestRunnerInput, JestRunnerOutput> {
  readonly name = 'jest-runner';

  /**
   * Run the test suite and return structured results.
   * Does NOT throw on test failure — returns `passed: false` instead.
   */
  async execute(input: JestRunnerInput, context: AgentContext): Promise<JestRunnerOutput> {
    const command = input.command || 'npm test';

    try {
      const output = execSync(command, {
        cwd: context.workDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { passed: true, output };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      const output = [execError.stdout || '', execError.stderr || ''].join('\n').trim();
      return { passed: false, output: output || execError.message || 'Test run failed' };
    }
  }

  /**
   * Run code formatting and linting auto-fix.
   * Failures are non-fatal (returns output for logging).
   */
  async runFormatAndLint(context: AgentContext): Promise<string> {
    const logs: string[] = [];

    // Format
    try {
      const formatOutput = execSync('npm run format', {
        cwd: context.workDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      logs.push(`[format] ${formatOutput}`);
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string };
      logs.push(`[format] Warning: ${execError.stdout || ''} ${execError.stderr || ''}`);
    }

    // Lint auto-fix
    try {
      const lintOutput = execSync('npm run lint -- --fix', {
        cwd: context.workDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      logs.push(`[lint] ${lintOutput}`);
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string };
      logs.push(`[lint] Warning: ${execError.stdout || ''} ${execError.stderr || ''}`);
    }

    return logs.join('\n');
  }
}
