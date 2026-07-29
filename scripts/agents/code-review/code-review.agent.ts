/**
 * CodeReviewAgent — Performs AI-powered code review on PR diffs.
 *
 * Replaces the `ai-review` job's inline bash + gemini CLI steps
 * in pr-validation.yml (lines 39-104).
 *
 * Execution flow:
 * 1. GitDiffSkill → extract diff content
 * 2. PromptLoaderSkill → load code-review/prompt.md with diff injected
 * 3. GeminiClient → generate review
 * 4. PullRequestSkill → post review comment on PR
 * 5. Parse output for BLOCKING/CRITICAL → return AgentResult
 */

import * as path from 'path';
import type { IAgent, AgentContext, AgentResult } from '../core/types';
import { Logger } from '../core/logger';
import { GeminiClient } from '../core/gemini-client';
import { GitDiffSkill } from '../skills/git-diff.skill';
import { PromptLoaderSkill } from '../skills/prompt-loader.skill';
import { PullRequestSkill } from '../skills/pull-request.skill';

export class CodeReviewAgent implements IAgent {
  readonly name = 'code-review';

  private readonly logger = new Logger('CodeReviewAgent');
  private readonly gitDiff = new GitDiffSkill();
  private readonly promptLoader = new PromptLoaderSkill();
  private readonly pullRequest = new PullRequestSkill();
  private readonly gemini: GeminiClient;

  constructor(geminiClient?: GeminiClient) {
    this.gemini = geminiClient || new GeminiClient();
  }

  async run(context: AgentContext): Promise<AgentResult> {
    this.logger.agent(`Starting code review with model: ${this.gemini.modelName}`);

    // 1. Extract diff
    this.logger.info(this.gitDiff.name, 'Extracting diff...');
    const { diff } = await this.gitDiff.execute({}, context);

    if (!diff || diff.trim().length === 0) {
      this.logger.agent('No code changes detected in diff. Skipping review.');
      return {
        status: 'skipped',
        summary: 'No code changes detected in diff.',
      };
    }

    this.logger.info(this.gitDiff.name, `Diff extracted (${diff.length} bytes).`);

    // 2. Load prompt template
    const agentDir = path.resolve(__dirname);
    this.logger.info(this.promptLoader.name, 'Loading review prompt template...');
    const { prompt } = await this.promptLoader.execute(
      {
        agentDir,
        templateName: 'prompt.md',
        variables: { diff },
      },
      context,
    );

    // 3. Call Gemini for review
    this.logger.info('gemini-client', 'Calling Gemini API for code review...');
    const reviewOutput = await this.gemini.generateContent(prompt);
    this.logger.success('gemini-client', `Review generated (${reviewOutput.length} bytes).`);

    // 4. Post review comment to PR
    const prNumber = context.prNumber || context.env.PR_NUMBER;
    if (prNumber) {
      const isBlocking = /STATUS:\s*BLOCKING|\[BLOCKING\]|\[CRITICAL\]/i.test(reviewOutput);
      const icon = isBlocking ? '🚨' : '✅';
      const commentBody = `## ${icon} Gemini AI Code Review Summary\n\n${reviewOutput}`;

      this.logger.info(this.pullRequest.name, `Posting review comment on PR #${prNumber}...`);
      try {
        const { commentUrl } = await this.pullRequest.postReviewComment(
          { prNumber, body: commentBody },
          context,
        );
        this.logger.success(this.pullRequest.name, `Comment posted: ${commentUrl || 'OK'}`);
      } catch (error) {
        // Non-fatal: log warning but don't fail the review
        this.logger.warn(this.pullRequest.name, `Failed to post comment: ${error}`);
      }
    } else {
      this.logger.warn(this.pullRequest.name, 'No PR_NUMBER set. Skipping comment posting.');
    }

    // 5. Determine review status
    const isBlocking = /STATUS:\s*BLOCKING|\[BLOCKING\]|\[CRITICAL\]/i.test(reviewOutput);

    if (isBlocking) {
      this.logger.agent('❌ Review identified BLOCKING/CRITICAL issues.');
      return {
        status: 'failure',
        summary: 'Gemini AI review identified critical or blocking issues. Please check the PR review comment.',
        data: { reviewOutput, isBlocking: true },
      };
    }

    this.logger.agent('✅ Review passed — no blocking issues found.');
    return {
      status: 'success',
      summary: 'Code review passed. No blocking issues found.',
      data: { reviewOutput, isBlocking: false },
    };
  }
}
