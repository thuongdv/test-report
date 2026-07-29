import { JestRunnerSkill } from './jest-runner.skill';
import type { AgentContext } from '../core/types';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('JestRunnerSkill', () => {
  let skill: JestRunnerSkill;
  const context: AgentContext = {
    workDir: '/test/repo',
    env: {},
    baseRef: 'origin/main',
    headRef: 'HEAD',
    args: [],
  };

  beforeEach(() => {
    skill = new JestRunnerSkill();
    jest.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(skill.name).toBe('jest-runner');
  });

  describe('execute', () => {
    it('should return passed=true when tests pass', async () => {
      mockExecSync.mockReturnValue('All tests passed' as any);

      const result = await skill.execute({}, context);

      expect(result.passed).toBe(true);
      expect(result.output).toBe('All tests passed');
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm test',
        expect.objectContaining({ cwd: '/test/repo' }),
      );
    });

    it('should return passed=false when tests fail', async () => {
      const error = new Error('test failed') as any;
      error.stdout = 'FAIL src/app.spec.ts';
      error.stderr = 'Test suite failed';
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = await skill.execute({}, context);

      expect(result.passed).toBe(false);
      expect(result.output).toContain('FAIL src/app.spec.ts');
    });

    it('should use custom test command when provided', async () => {
      mockExecSync.mockReturnValue('ok' as any);

      await skill.execute({ command: 'npx jest --coverage' }, context);

      expect(mockExecSync).toHaveBeenCalledWith(
        'npx jest --coverage',
        expect.anything(),
      );
    });
  });

  describe('runFormatAndLint', () => {
    it('should run format and lint commands', async () => {
      mockExecSync.mockReturnValue('formatted' as any);

      const output = await skill.runFormatAndLint(context);

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm run format',
        expect.objectContaining({ cwd: '/test/repo' }),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm run lint -- --fix',
        expect.objectContaining({ cwd: '/test/repo' }),
      );
      expect(output).toContain('[format]');
      expect(output).toContain('[lint]');
    });

    it('should handle format failure gracefully', async () => {
      const error = new Error('format error') as any;
      error.stdout = 'parse error';
      error.stderr = '';
      mockExecSync
        .mockImplementationOnce(() => {
          throw error;
        })
        .mockReturnValueOnce('lint ok' as any);

      const output = await skill.runFormatAndLint(context);

      expect(output).toContain('[format] Warning');
      expect(output).toContain('[lint]');
    });

    it('should handle lint failure gracefully', async () => {
      const error = new Error('lint error') as any;
      error.stdout = '';
      error.stderr = 'lint failed';
      mockExecSync
        .mockReturnValueOnce('format ok' as any)
        .mockImplementationOnce(() => {
          throw error;
        });

      const output = await skill.runFormatAndLint(context);

      expect(output).toContain('[format]');
      expect(output).toContain('[lint] Warning');
    });
  });
});
