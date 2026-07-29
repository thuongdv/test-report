import { GitDiffSkill } from './git-diff.skill';
import { SkillError } from '../core/types';
import type { AgentContext } from '../core/types';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('GitDiffSkill', () => {
  let skill: GitDiffSkill;
  const context: AgentContext = {
    workDir: '/test/repo',
    env: {},
    baseRef: 'origin/main',
    headRef: 'HEAD',
    args: [],
  };

  beforeEach(() => {
    skill = new GitDiffSkill();
    jest.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(skill.name).toBe('git-diff');
  });

  it('should extract changed files and diff content', async () => {
    mockExecSync
      .mockReturnValueOnce('src/app.ts\nsrc/utils.ts' as any) // --name-only
      .mockReturnValueOnce('diff --git a/src/app.ts...' as any); // full diff

    const result = await skill.execute({}, context);

    expect(result.changedFiles).toEqual(['src/app.ts', 'src/utils.ts']);
    expect(result.diff).toBe('diff --git a/src/app.ts...');
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });

  it('should return only file names when namesOnly is true', async () => {
    mockExecSync.mockReturnValueOnce('src/app.ts' as any);

    const result = await skill.execute({ namesOnly: true }, context);

    expect(result.changedFiles).toEqual(['src/app.ts']);
    expect(result.diff).toBe('');
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it('should use input baseRef and headRef over context defaults', async () => {
    mockExecSync
      .mockReturnValueOnce('file.ts' as any)
      .mockReturnValueOnce('diff content' as any);

    await skill.execute(
      { baseRef: 'origin/develop', headRef: 'feature-branch' },
      context,
    );

    expect(mockExecSync).toHaveBeenCalledWith(
      'git diff --name-only "origin/develop...feature-branch"',
      expect.objectContaining({ cwd: '/test/repo' }),
    );
  });

  it('should handle empty diff gracefully', async () => {
    mockExecSync
      .mockReturnValueOnce('' as any)
      .mockReturnValueOnce('' as any);

    const result = await skill.execute({}, context);

    expect(result.changedFiles).toEqual([]);
    expect(result.diff).toBe('');
  });

  it('should throw SkillError on git failure', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('git error');
    });

    await expect(skill.execute({}, context)).rejects.toThrow(SkillError);
  });
});
