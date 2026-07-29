/**
 * PullRequestSkill — Handles Git branch operations and GitHub PR management.
 *
 * Consolidates all functionality from create-pr.ts:
 * - Git config, branch creation, staging, committing, pushing
 * - GitHub PR creation / update via Octokit
 * - PR comment posting (for code review results)
 */

import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import type { ISkill, AgentContext } from '../core/types';
import { SkillError } from '../core/types';

// ---------------------------------------------------------------------------
// Create Test PR
// ---------------------------------------------------------------------------

export interface CreateTestPRInput {
  /** List of generated test file paths to commit. */
  generatedFiles: string[];
  /** PR number of the original feature PR. */
  prNumber: string;
  /** Target developer branch name. */
  targetBranch: string;
}

export interface CreateTestPROutput {
  /** URL of the created/updated PR. */
  prUrl: string;
  /** PR number of the AI-generated test PR. */
  prNumber: number;
  /** Whether an existing PR was updated vs a new one created. */
  isUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Post Review Comment
// ---------------------------------------------------------------------------

export interface PostReviewCommentInput {
  /** PR number to post the comment on. */
  prNumber: string;
  /** Markdown body of the review comment. */
  body: string;
}

export interface PostReviewCommentOutput {
  /** Whether the comment was posted successfully. */
  posted: boolean;
  /** URL of the posted comment. */
  commentUrl?: string;
}

export class PullRequestSkill implements ISkill<CreateTestPRInput, CreateTestPROutput> {
  readonly name = 'pull-request';

  /**
   * ISkill.execute — Create or update a PR with generated test files.
   * This is the primary skill operation (equivalent to create-pr.ts).
   */
  async execute(input: CreateTestPRInput, context: AgentContext): Promise<CreateTestPROutput> {
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      throw new SkillError(this.name, 'GITHUB_TOKEN environment variable is required.');
    }

    const repository = context.repository || context.env.GITHUB_REPOSITORY;
    if (!repository) {
      throw new SkillError(this.name, 'GITHUB_REPOSITORY is required.');
    }

    const [owner, repo] = repository.split('/');
    const aiBranch = `ai/generated-tests/${input.prNumber}`;

    // Configure git user
    this.runGit('config user.name "github-actions[bot]"', context.workDir);
    this.runGit('config user.email "github-actions[bot]@users.noreply.github.com"', context.workDir);

    // Create and switch to AI branch
    this.runGit(`checkout -b ${aiBranch}`, context.workDir);

    // Stage generated test files
    for (const file of input.generatedFiles) {
      this.runGit(`add "${file}"`, context.workDir);
    }

    // Commit
    const commitMsg = `test(ai): auto-generated unit tests for PR #${input.prNumber}`;
    this.runGit(`commit -m "${commitMsg}"`, context.workDir);

    // Push
    this.runGit(`push -u origin ${aiBranch} --force`, context.workDir);

    // Create or update PR via Octokit
    const octokit = new Octokit({ auth: token });

    const fileListMd = input.generatedFiles.map((f) => `- \`${f}\``).join('\n');
    const prTitle = `test(ai): generated unit tests for PR #${input.prNumber}`;
    const prBody = `## 🤖 AI-Generated Unit Tests

This Pull Request contains unit tests generated automatically by Gemini for changes in PR #${input.prNumber}.

### 📄 Generated Test Files
${fileListMd}

### ℹ️ Details
- Target Branch: \`${input.targetBranch}\`
- Generated using Jest and NestJS / React testing conventions.
- All tests passed validation before this PR was created.

---
*Please review the generated test cases and merge this PR into your feature branch \`${input.targetBranch}\` when ready.*`;

    try {
      const existingPrs = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${aiBranch}`,
        base: input.targetBranch,
        state: 'open',
      });

      if (existingPrs.data.length > 0) {
        const existing = existingPrs.data[0];
        await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: existing.number,
          body: prBody,
        });
        return {
          prUrl: existing.html_url,
          prNumber: existing.number,
          isUpdate: true,
        };
      } else {
        const createdPr = await octokit.rest.pulls.create({
          owner,
          repo,
          title: prTitle,
          head: aiBranch,
          base: input.targetBranch,
          body: prBody,
        });
        return {
          prUrl: createdPr.data.html_url,
          prNumber: createdPr.data.number,
          isUpdate: false,
        };
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new SkillError(
        this.name,
        `Failed to create or update Pull Request: ${err.message || 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Post a review comment on an existing PR.
   * Used by CodeReviewAgent to post AI review results.
   */
  async postReviewComment(
    input: PostReviewCommentInput,
    context: AgentContext,
  ): Promise<PostReviewCommentOutput> {
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      throw new SkillError(this.name, 'GITHUB_TOKEN environment variable is required.');
    }

    const repository = context.repository || context.env.GITHUB_REPOSITORY;
    if (!repository) {
      throw new SkillError(this.name, 'GITHUB_REPOSITORY is required.');
    }

    const [owner, repo] = repository.split('/');
    const octokit = new Octokit({ auth: token });

    try {
      const comment = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(input.prNumber, 10),
        body: input.body,
      });

      return {
        posted: true,
        commentUrl: comment.data.html_url,
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new SkillError(
        this.name,
        `Failed to post review comment: ${err.message || 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Detect generated test files from git status.
   * Returns file paths matching *.spec.ts or *.test.tsx patterns.
   */
  detectGeneratedTestFiles(context: AgentContext): string[] {
    const statusOutput = this.runGit('status --porcelain', context.workDir);
    const lines = statusOutput.split('\n').filter((l) => l.trim() !== '');
    const testFileRegex = /\.(spec|test)\.(ts|tsx)$/;

    return lines
      .map((line) => line.substring(3).trim())
      .filter((filePath) => testFileRegex.test(filePath));
  }

  private runGit(command: string, cwd: string): string {
    try {
      return execSync(`git ${command}`, { cwd, encoding: 'utf8' }).trim();
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      throw new SkillError(
        this.name,
        `Git command failed: git ${command}\n${execError.stderr || execError.message}`,
        error,
      );
    }
  }
}
