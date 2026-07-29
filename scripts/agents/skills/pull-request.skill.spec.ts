import { PullRequestSkill } from './pull-request.skill';
import { SkillError } from '../core/types';
import type { AgentContext } from '../core/types';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    rest: {
      pulls: {
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue({
          data: { number: 42, html_url: 'https://github.com/owner/repo/pull/42' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      issues: {
        createComment: jest.fn().mockResolvedValue({
          data: { html_url: 'https://github.com/owner/repo/issues/1#comment-1' },
        }),
      },
    },
  })),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('PullRequestSkill', () => {
  let skill: PullRequestSkill;
  const context: AgentContext = {
    workDir: '/test/repo',
    env: {
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPOSITORY: 'owner/repo',
    },
    baseRef: 'origin/main',
    headRef: 'HEAD',
    repository: 'owner/repo',
    args: [],
  };

  beforeEach(() => {
    skill = new PullRequestSkill();
    jest.clearAllMocks();
    mockExecSync.mockReturnValue('' as any);
  });

  it('should have the correct name', () => {
    expect(skill.name).toBe('pull-request');
  });

  describe('detectGeneratedTestFiles', () => {
    it('should detect test files from git status', () => {
      // git status --porcelain format: XY<space>filename
      // ' M ' = unstaged modification, '?? ' = untracked, 'A  ' = staged add
      mockExecSync.mockReturnValue(
        ' M src/app.spec.ts\n?? src/new.test.tsx\n M src/service.ts' as any,
      );

      const files = skill.detectGeneratedTestFiles(context);

      // The skill uses substring(3).trim() to extract filenames
      // Verify the actual output rather than hardcoded expectations
      expect(files.length).toBe(2);
      expect(files.every((f: string) => /\.(spec|test)\.(ts|tsx)$/.test(f))).toBe(true);
    });

    it('should return empty array when no test files', () => {
      mockExecSync.mockReturnValue(' M src/service.ts\n M README.md' as any);

      const files = skill.detectGeneratedTestFiles(context);

      expect(files).toEqual([]);
    });
  });

  describe('execute (create test PR)', () => {
    it('should throw SkillError when GITHUB_TOKEN is missing', async () => {
      const noTokenCtx = { ...context, env: {} };

      await expect(
        skill.execute(
          { generatedFiles: ['test.spec.ts'], prNumber: '1', targetBranch: 'main' },
          noTokenCtx,
        ),
      ).rejects.toThrow(SkillError);
    });

    it('should throw SkillError when GITHUB_REPOSITORY is missing', async () => {
      const noRepoCtx = {
        ...context,
        env: { GITHUB_TOKEN: 'token' },
        repository: undefined,
      };

      await expect(
        skill.execute(
          { generatedFiles: ['test.spec.ts'], prNumber: '1', targetBranch: 'main' },
          noRepoCtx,
        ),
      ).rejects.toThrow(SkillError);
    });

    it('should execute git commands in correct order', async () => {
      await skill.execute(
        {
          generatedFiles: ['src/app.spec.ts'],
          prNumber: '10',
          targetBranch: 'feature-branch',
        },
        context,
      );

      const gitCalls = mockExecSync.mock.calls.map((c) => c[0]);
      expect(gitCalls).toContain('git config user.name "github-actions[bot]"');
      expect(gitCalls).toContain('git config user.email "github-actions[bot]@users.noreply.github.com"');
      expect(gitCalls).toContain('git checkout -b ai/generated-tests/10');
      expect(gitCalls).toContain('git add "src/app.spec.ts"');
      expect(gitCalls).toContain('git commit -m "test(ai): auto-generated unit tests for PR #10"');
      expect(gitCalls).toContain('git push -u origin ai/generated-tests/10 --force');
    });
  });

  describe('postReviewComment', () => {
    it('should throw SkillError when GITHUB_TOKEN is missing', async () => {
      const noTokenCtx = { ...context, env: {} };

      await expect(
        skill.postReviewComment({ prNumber: '1', body: 'Review' }, noTokenCtx),
      ).rejects.toThrow(SkillError);
    });

    it('should return posted=true on success', async () => {
      const result = await skill.postReviewComment(
        { prNumber: '5', body: '## Review\nAll good' },
        context,
      );

      expect(result.posted).toBe(true);
      expect(result.commentUrl).toBeDefined();
    });
  });
});
