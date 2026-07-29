/**
 * CreatePRAgent — Creates or updates a GitHub PR with generated test files.
 *
 * Replaces: create-pr.ts (entire file).
 *
 * Execution flow:
 * 1. PullRequestSkill.detectGeneratedTestFiles() → find staged test files
 * 2. PullRequestSkill.execute() → branch, commit, push, open/update PR
 */

import type { IAgent, AgentContext, AgentResult } from '../core/types';
import { Logger } from '../core/logger';
import { PullRequestSkill } from '../skills/pull-request.skill';

export class CreatePRAgent implements IAgent {
  readonly name = 'create-pr';

  private readonly logger = new Logger('CreatePRAgent');
  private readonly pullRequest = new PullRequestSkill();

  async run(context: AgentContext): Promise<AgentResult> {
    this.logger.agent('Starting AI PR creation...');

    const prNumber = context.prNumber || context.env.PR_NUMBER;
    const targetBranch = context.prBranch || context.env.PR_BRANCH;

    if (!prNumber || !targetBranch) {
      this.logger.error(
        this.pullRequest.name,
        'PR_NUMBER and PR_BRANCH environment variables are required.',
      );
      return {
        status: 'failure',
        summary: 'Missing PR_NUMBER or PR_BRANCH environment variables.',
      };
    }

    // 1. Detect generated test files from git status
    this.logger.info(this.pullRequest.name, 'Detecting generated test files...');
    const generatedFiles = this.pullRequest.detectGeneratedTestFiles(context);

    if (generatedFiles.length === 0) {
      this.logger.agent('No new or modified test files found to commit.');
      return {
        status: 'skipped',
        summary: 'No generated test files to commit.',
      };
    }

    this.logger.info(
      this.pullRequest.name,
      `Found ${generatedFiles.length} test file(s) to commit:`,
    );
    generatedFiles.forEach((f) => this.logger.info(this.pullRequest.name, `  - ${f}`));

    // 2. Create or update PR
    this.logger.info(this.pullRequest.name, 'Creating AI pull request...');
    const result = await this.pullRequest.execute(
      {
        generatedFiles,
        prNumber,
        targetBranch,
      },
      context,
    );

    const action = result.isUpdate ? 'Updated' : 'Created';
    this.logger.success(
      this.pullRequest.name,
      `✅ ${action} AI PR #${result.prNumber}: ${result.prUrl}`,
    );

    return {
      status: 'success',
      summary: `${action} AI Pull Request #${result.prNumber}: ${result.prUrl}`,
      data: {
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        isUpdate: result.isUpdate,
        generatedFiles,
      },
    };
  }
}
