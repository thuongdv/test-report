/**
 * GitDiffSkill — Extracts Git diffs between two refs.
 *
 * Replaces the inline bash `git diff` calls in pr-validation.yml
 * and generate-unit-tests.yml.
 */

import { execSync } from 'child_process';
import type { ISkill, AgentContext } from '../core/types';
import { SkillError } from '../core/types';

export interface GitDiffInput {
  /** Base ref to diff against (e.g., 'origin/main'). Falls back to context.baseRef. */
  baseRef?: string;
  /** Head ref to diff from (e.g., 'HEAD'). Falls back to context.headRef. */
  headRef?: string;
  /** If true, return only file names without diff content. */
  namesOnly?: boolean;
}

export interface GitDiffOutput {
  /** Full diff content (empty string if namesOnly is true). */
  diff: string;
  /** List of changed file paths. */
  changedFiles: string[];
}

export class GitDiffSkill implements ISkill<GitDiffInput, GitDiffOutput> {
  readonly name = 'git-diff';

  async execute(input: GitDiffInput, context: AgentContext): Promise<GitDiffOutput> {
    const baseRef = input.baseRef || context.baseRef;
    const headRef = input.headRef || context.headRef;

    try {
      const changedFilesRaw = execSync(`git diff --name-only "${baseRef}...${headRef}"`, {
        cwd: context.workDir,
        encoding: 'utf8',
      }).trim();

      const changedFiles = changedFilesRaw
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      let diff = '';
      if (!input.namesOnly) {
        diff = execSync(`git diff "${baseRef}...${headRef}"`, {
          cwd: context.workDir,
          encoding: 'utf8',
        }).trim();
      }

      return { diff, changedFiles };
    } catch (error) {
      throw new SkillError(
        this.name,
        `Failed to extract git diff between ${baseRef} and ${headRef}`,
        error,
      );
    }
  }
}
