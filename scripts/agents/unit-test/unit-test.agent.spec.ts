import { UnitTestGeneratorAgent } from './unit-test.agent';
import type { AgentContext } from '../core/types';
import { GeminiClient } from '../core/gemini-client';
import { GitDiffSkill } from '../skills/git-diff.skill';
import { FileAnalysisSkill } from '../skills/file-analysis.skill';
import { PromptLoaderSkill } from '../skills/prompt-loader.skill';
import { JestRunnerSkill } from '../skills/jest-runner.skill';
import * as fs from 'fs';

jest.mock('../core/gemini-client');
jest.mock('../skills/git-diff.skill');
jest.mock('../skills/file-analysis.skill');
jest.mock('../skills/prompt-loader.skill');
jest.mock('../skills/jest-runner.skill');
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('UnitTestGeneratorAgent', () => {
  let agent: UnitTestGeneratorAgent;
  let mockGemini: jest.Mocked<GeminiClient>;
  let mockGitDiff: jest.Mocked<GitDiffSkill>;
  let mockFileAnalysis: jest.Mocked<FileAnalysisSkill>;
  let mockPromptLoader: jest.Mocked<PromptLoaderSkill>;
  let mockJestRunner: jest.Mocked<JestRunnerSkill>;

  const context: AgentContext = {
    workDir: '/test/repo',
    env: { GEMINI_API_KEY: 'test-key' },
    baseRef: 'origin/main',
    headRef: 'HEAD',
    args: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockGemini = {
      modelName: 'gemini-2.5-flash',
      generateContent: jest.fn(),
      generateCode: jest.fn(),
    } as any;

    mockGitDiff = GitDiffSkill.prototype as any;
    mockGitDiff.execute = jest.fn();

    mockFileAnalysis = FileAnalysisSkill.prototype as any;
    mockFileAnalysis.execute = jest.fn();
    mockFileAnalysis.findNearbyTests = jest.fn();
    mockFileAnalysis.getTargetTestPath = jest.fn();

    mockPromptLoader = PromptLoaderSkill.prototype as any;
    mockPromptLoader.execute = jest.fn();

    mockJestRunner = JestRunnerSkill.prototype as any;
    mockJestRunner.execute = jest.fn();
    mockJestRunner.runFormatAndLint = jest.fn();

    agent = new UnitTestGeneratorAgent(mockGemini);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have the correct name', () => {
    expect(agent.name).toBe('unit-test');
  });

  it('should return skipped when no production source files changed', async () => {
    mockGitDiff.execute.mockResolvedValue({ diff: '', changedFiles: ['README.md'] });
    mockFileAnalysis.execute.mockResolvedValue({ sourceFiles: [], hasChanges: false });

    const result = await agent.run(context);

    expect(result.status).toBe('skipped');
    expect(result.summary).toContain('No production source files');
  });

  it('should generate tests and return success when tests pass', async () => {
    // Setup: one changed file
    mockGitDiff.execute.mockResolvedValue({
      diff: '',
      changedFiles: ['src/service.ts'],
    });
    mockFileAnalysis.execute.mockResolvedValue({
      sourceFiles: ['src/service.ts'],
      hasChanges: true,
    });
    mockFileAnalysis.getTargetTestPath.mockReturnValue('src/service.spec.ts');
    mockFileAnalysis.findNearbyTests.mockReturnValue({ context: 'No nearby test files found.' });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'Generate tests for service.ts' });
    mockGemini.generateCode.mockResolvedValue('describe("Service", () => { it("works", () => {}) });\n');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('export class Service {}' as any);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Tests pass on first attempt
    mockJestRunner.runFormatAndLint.mockResolvedValue('[format] ok\n[lint] ok');
    mockJestRunner.execute.mockResolvedValue({ passed: true, output: 'All tests passed' });

    const result = await agent.run(context);

    expect(result.status).toBe('success');
    expect(result.summary).toContain('1 test file(s)');
    expect(result.data?.generatedFiles).toEqual(['src/service.spec.ts']);
  });

  it('should retry on test failure and succeed', async () => {
    mockGitDiff.execute.mockResolvedValue({
      diff: '',
      changedFiles: ['src/app.ts'],
    });
    mockFileAnalysis.execute.mockResolvedValue({
      sourceFiles: ['src/app.ts'],
      hasChanges: true,
    });
    mockFileAnalysis.getTargetTestPath.mockReturnValue('src/app.spec.ts');
    mockFileAnalysis.findNearbyTests.mockReturnValue({ context: '' });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'prompt' });
    mockGemini.generateCode.mockResolvedValue('test code\n');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('source code' as any);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.writeFileSync.mockReturnValue(undefined);

    mockJestRunner.runFormatAndLint.mockResolvedValue('ok');
    // Fail first, pass second
    mockJestRunner.execute
      .mockResolvedValueOnce({ passed: false, output: 'FAIL' })
      .mockResolvedValueOnce({ passed: true, output: 'PASS' });

    const result = await agent.run(context);

    expect(result.status).toBe('success');
    // Gemini should have been called for fix
    expect(mockGemini.generateCode).toHaveBeenCalledTimes(2); // initial + fix
  });

  it('should return failure after max retry attempts', async () => {
    mockGitDiff.execute.mockResolvedValue({
      diff: '',
      changedFiles: ['src/app.ts'],
    });
    mockFileAnalysis.execute.mockResolvedValue({
      sourceFiles: ['src/app.ts'],
      hasChanges: true,
    });
    mockFileAnalysis.getTargetTestPath.mockReturnValue('src/app.spec.ts');
    mockFileAnalysis.findNearbyTests.mockReturnValue({ context: '' });
    mockPromptLoader.execute.mockResolvedValue({ prompt: 'prompt' });
    mockGemini.generateCode.mockResolvedValue('test code\n');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('source code' as any);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.writeFileSync.mockReturnValue(undefined);

    mockJestRunner.runFormatAndLint.mockResolvedValue('ok');
    // All 3 attempts fail
    mockJestRunner.execute.mockResolvedValue({ passed: false, output: 'FAIL' });

    const result = await agent.run(context);

    expect(result.status).toBe('failure');
    expect(result.summary).toContain('failed validation after 3 attempts');
  });
});
