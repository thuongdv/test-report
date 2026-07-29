import { PromptLoaderSkill } from './prompt-loader.skill';
import { SkillError } from '../core/types';
import type { AgentContext } from '../core/types';
import * as fs from 'fs';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PromptLoaderSkill', () => {
  let skill: PromptLoaderSkill;
  const context: AgentContext = {
    workDir: '/test/repo',
    env: {},
    baseRef: 'origin/main',
    headRef: 'HEAD',
    args: [],
  };

  beforeEach(() => {
    skill = new PromptLoaderSkill();
    jest.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(skill.name).toBe('prompt-loader');
  });

  it('should load and return prompt template', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('You are a reviewer.' as any);

    const result = await skill.execute(
      { agentDir: '/abs/path/to/agent', templateName: 'prompt.md' },
      context,
    );

    expect(result.prompt).toBe('You are a reviewer.');
  });

  it('should substitute {{variables}} in template', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('Review this: {{diff}}\nFile: {{filename}}' as any);

    const result = await skill.execute(
      {
        agentDir: '/abs/path/to/agent',
        templateName: 'prompt.md',
        variables: { diff: 'some diff', filename: 'app.ts' },
      },
      context,
    );

    expect(result.prompt).toBe('Review this: some diff\nFile: app.ts');
  });

  it('should handle multiple occurrences of the same variable', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{{name}} is {{name}}' as any);

    const result = await skill.execute(
      {
        agentDir: '/abs/path',
        templateName: 'prompt.md',
        variables: { name: 'test' },
      },
      context,
    );

    expect(result.prompt).toBe('test is test');
  });

  it('should resolve relative agentDir against workDir', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('template' as any);

    await skill.execute(
      { agentDir: 'scripts/agents/code-review', templateName: 'prompt.md' },
      context,
    );

    expect(mockFs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('scripts/agents/code-review/prompt.md'),
    );
  });

  it('should throw SkillError when template file not found', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await expect(
      skill.execute(
        { agentDir: '/abs/path', templateName: 'missing.md' },
        context,
      ),
    ).rejects.toThrow(SkillError);
  });
});
