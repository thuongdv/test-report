import { CodeReviewAgent } from './code-review.agent';
import type { AgentContext } from '../core/types';
import { GeminiClient } from '../core/gemini-client';
import { GitDiffSkill } from '../skills/git-diff.skill';
import { PromptLoaderSkill } from '../skills/prompt-loader.skill';
import { PullRequestSkill } from '../skills/pull-request.skill';

// Mock all dependencies
jest.mock('../core/gemini-client');
jest.mock('../skills/git-diff.skill');
jest.mock('../skills/prompt-loader.skill');
jest.mock('../skills/pull-request.skill');

describe('CodeReviewAgent', () => {
  let agent: CodeReviewAgent;
  let mockGemini: jest.Mocked<GeminiClient>;
  let mockGitDiff: jest.Mocked<GitDiffSkill>;
  let mockPromptLoader: jest.Mocked<PromptLoaderSkill>;
  let mockPullRequest: jest.Mocked<PullRequestSkill>;

  const context: AgentContext = {
    workDir: '/test/repo',
    env: {
      GEMINI_API_KEY: 'test-key',
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPOSITORY: 'owner/repo',
    },
    baseRef: 'origin/main',
    headRef: 'HEAD',
    prNumber: '5',
    repository: 'owner/repo',
    args: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Suppress logger output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Create mock instances
    mockGemini = {
      modelName: 'gemini-2.5-flash',
      generateContent: jest.fn(),
      generateCode: jest.fn(),
    } as any;

    // The constructor uses new, so we mock the prototype methods
    mockGitDiff = GitDiffSkill.prototype as any;
    mockGitDiff.execute = jest.fn();

    mockPromptLoader = PromptLoaderSkill.prototype as any;
    mockPromptLoader.execute = jest.fn();

    mockPullRequest = PullRequestSkill.prototype as any;
    mockPullRequest.postReviewComment = jest.fn();

    agent = new CodeReviewAgent(mockGemini);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have the correct name', () => {
    expect(agent.name).toBe('code-review');
  });

  it('should return skipped when no diff content', async () => {
    mockGitDiff.execute.mockResolvedValue({ diff: '', changedFiles: [] });

    const result = await agent.run(context);

    expect(result.status).toBe('skipped');
    expect(result.summary).toContain('No code changes');
  });

  it('should return success when no blocking issues found', async () => {
    mockGitDiff.execute.mockResolvedValue({
      diff: 'diff content',
      changedFiles: ['app.ts'],
    });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'Review prompt' });
    mockGemini.generateContent.mockResolvedValue('STATUS: PASS - No blocking issues found');
    mockPullRequest.postReviewComment.mockResolvedValue({
      posted: true,
      commentUrl: 'https://github.com/...',
    });

    const result = await agent.run(context);

    expect(result.status).toBe('success');
    expect(result.data?.isBlocking).toBe(false);
  });

  it('should return failure when BLOCKING issues found', async () => {
    mockGitDiff.execute.mockResolvedValue({
      diff: 'diff content',
      changedFiles: ['app.ts'],
    });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'Review prompt' });
    mockGemini.generateContent.mockResolvedValue(
      'STATUS: BLOCKING - Action required\n[CRITICAL] SQL injection in app.ts',
    );
    mockPullRequest.postReviewComment.mockResolvedValue({ posted: true });

    const result = await agent.run(context);

    expect(result.status).toBe('failure');
    expect(result.data?.isBlocking).toBe(true);
  });

  it('should handle PR comment posting failure gracefully', async () => {
    mockGitDiff.execute.mockResolvedValue({
      diff: 'diff content',
      changedFiles: ['app.ts'],
    });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'Review prompt' });
    mockGemini.generateContent.mockResolvedValue('STATUS: PASS');
    mockPullRequest.postReviewComment.mockRejectedValue(new Error('API error'));

    // Should not throw — comment posting failure is non-fatal
    const result = await agent.run(context);

    expect(result.status).toBe('success');
  });

  it('should skip comment posting when no PR number', async () => {
    const noPrCtx = { ...context, prNumber: undefined, env: { ...context.env } };
    delete (noPrCtx.env as any).PR_NUMBER;

    mockGitDiff.execute.mockResolvedValue({
      diff: 'diff content',
      changedFiles: ['app.ts'],
    });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'Review prompt' });
    mockGemini.generateContent.mockResolvedValue('STATUS: PASS');

    const result = await agent.run(noPrCtx);

    expect(result.status).toBe('success');
    expect(mockPullRequest.postReviewComment).not.toHaveBeenCalled();
  });
});
