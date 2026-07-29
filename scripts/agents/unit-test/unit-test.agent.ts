/**
 * UnitTestGeneratorAgent — Generates and validates unit tests for changed source files.
 *
 * Replaces:
 * - generate-tests.ts (entire file)
 * - generate-unit-tests.yml steps: Detect Changed Source Files, Initial Unit Test
 *   Generation, Validate & Retry Loop (lines 42-124)
 *
 * Execution flow:
 * 1. GitDiffSkill → get list of changed files
 * 2. FileAnalysisSkill → filter to production source files
 * 3. For each source file:
 *    a. FileAnalysisSkill.findNearbyTests() → get context
 *    b. PromptLoaderSkill → build prompt from unit-test/prompt.md
 *    c. GeminiClient → generate test code
 *    d. Write to target test path
 * 4. Validation & retry loop (max 3 attempts):
 *    a. JestRunnerSkill.runFormatAndLint() → auto-fix
 *    b. JestRunnerSkill.execute() → run tests
 *    c. If failed: load fix-prompt.md, re-generate with error context
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IAgent, AgentContext, AgentResult } from '../core/types';
import { Logger } from '../core/logger';
import { GeminiClient } from '../core/gemini-client';
import { GitDiffSkill } from '../skills/git-diff.skill';
import { FileAnalysisSkill } from '../skills/file-analysis.skill';
import { PromptLoaderSkill } from '../skills/prompt-loader.skill';
import { JestRunnerSkill } from '../skills/jest-runner.skill';

const MAX_RETRY_ATTEMPTS = 3;

export class UnitTestGeneratorAgent implements IAgent {
  readonly name = 'unit-test';

  private readonly logger = new Logger('UnitTestGeneratorAgent');
  private readonly gitDiff = new GitDiffSkill();
  private readonly fileAnalysis = new FileAnalysisSkill();
  private readonly promptLoader = new PromptLoaderSkill();
  private readonly jestRunner = new JestRunnerSkill();
  private readonly gemini: GeminiClient;

  constructor(geminiClient?: GeminiClient) {
    this.gemini = geminiClient || new GeminiClient();
  }

  async run(context: AgentContext): Promise<AgentResult> {
    this.logger.agent(`Starting unit test generation with model: ${this.gemini.modelName}`);

    // 1. Detect changed files via git diff
    this.logger.info(this.gitDiff.name, 'Detecting changed files...');
    const { changedFiles } = await this.gitDiff.execute({ namesOnly: true }, context);

    // 2. Filter to production source files
    this.logger.info(this.fileAnalysis.name, 'Filtering to production source files...');
    const { sourceFiles, hasChanges } = await this.fileAnalysis.execute(
      { changedFiles },
      context,
    );

    if (!hasChanges) {
      this.logger.agent('No production source files changed in this PR.');
      return {
        status: 'skipped',
        summary: 'No production source files changed.',
      };
    }

    this.logger.agent(`Found ${sourceFiles.length} source file(s) to generate tests for.`);

    // 3. Generate tests for each source file
    const agentDir = path.resolve(__dirname);
    const generatedTestPaths: string[] = [];

    for (const file of sourceFiles) {
      const fullPath = path.resolve(context.workDir, file);

      if (!fs.existsSync(fullPath)) {
        this.logger.warn(this.fileAnalysis.name, `Source file not found: ${file}, skipping.`);
        continue;
      }

      const sourceContent = fs.readFileSync(fullPath, 'utf8');
      const testPath = this.fileAnalysis.getTargetTestPath(file);

      this.logger.info('generation', `Processing: ${file}`);
      this.logger.info('generation', `Target test file: ${testPath}`);

      // Get nearby test context
      const { context: existingTests } = this.fileAnalysis.findNearbyTests(
        { sourcePath: file },
        context,
      );

      // Build prompt
      const { prompt } = await this.promptLoader.execute(
        {
          agentDir,
          templateName: 'prompt.md',
          variables: {
            filename: file,
            source_code: sourceContent,
            existing_tests: existingTests,
          },
        },
        context,
      );

      // Generate test code via Gemini
      this.logger.info('gemini-client', `Calling Gemini API for ${file}...`);
      try {
        const testCode = await this.gemini.generateCode(prompt);
        const fullTestPath = path.resolve(context.workDir, testPath);
        fs.mkdirSync(path.dirname(fullTestPath), { recursive: true });
        fs.writeFileSync(fullTestPath, testCode, 'utf8');
        generatedTestPaths.push(testPath);
        this.logger.success('generation', `✅ Generated: ${testPath}`);
      } catch (error) {
        this.logger.error('gemini-client', `❌ Failed to generate tests for ${file}: ${error}`);
        return {
          status: 'failure',
          summary: `Failed to generate tests for ${file}.`,
          data: { error: String(error) },
        };
      }
    }

    if (generatedTestPaths.length === 0) {
      this.logger.agent('No test files were generated.');
      return {
        status: 'skipped',
        summary: 'No test files were generated.',
      };
    }

    // 4. Validation & retry loop
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      this.logger.agent(`========================================`);
      this.logger.agent(`  Validation Attempt ${attempt} of ${MAX_RETRY_ATTEMPTS}`);
      this.logger.agent(`========================================`);

      // Format & lint
      this.logger.info(this.jestRunner.name, 'Running format & lint auto-fix...');
      const formatLintLogs = await this.jestRunner.runFormatAndLint(context);
      this.logger.info(this.jestRunner.name, formatLintLogs);

      // Run tests
      this.logger.info(this.jestRunner.name, 'Running unit test suite...');
      const { passed, output: testOutput } = await this.jestRunner.execute({}, context);

      if (passed) {
        this.logger.success(this.jestRunner.name, `✅ All tests passed on attempt ${attempt}!`);
        success = true;
        break;
      }

      this.logger.error(this.jestRunner.name, `❌ Tests failed on attempt ${attempt}.`);
      this.logger.info(this.jestRunner.name, testOutput);

      // Attempt AI fix if not last attempt
      if (attempt < MAX_RETRY_ATTEMPTS) {
        this.logger.agent(`Attempting AI fix (attempt ${attempt + 1})...`);
        await this.attemptFix(sourceFiles, generatedTestPaths, testOutput, agentDir, context);
      }
    }

    if (!success) {
      this.logger.agent(`❌ Generated tests failed validation after ${MAX_RETRY_ATTEMPTS} attempts.`);
      return {
        status: 'failure',
        summary: `Generated unit tests failed validation after ${MAX_RETRY_ATTEMPTS} attempts.`,
        data: { generatedFiles: generatedTestPaths },
      };
    }

    this.logger.agent('Unit test generation completed successfully.');
    return {
      status: 'success',
      summary: `Successfully generated ${generatedTestPaths.length} test file(s).`,
      data: { generatedFiles: generatedTestPaths },
    };
  }

  /**
   * Attempt to fix failing tests by calling Gemini with the fix-prompt template.
   */
  private async attemptFix(
    sourceFiles: string[],
    testPaths: string[],
    errorLogs: string,
    agentDir: string,
    context: AgentContext,
  ): Promise<void> {
    for (let i = 0; i < sourceFiles.length; i++) {
      const file = sourceFiles[i];
      const testPath = testPaths[i];
      if (!testPath) continue;

      const fullSourcePath = path.resolve(context.workDir, file);
      const fullTestPath = path.resolve(context.workDir, testPath);

      if (!fs.existsSync(fullTestPath)) continue;

      const sourceContent = fs.readFileSync(fullSourcePath, 'utf8');
      const testContent = fs.readFileSync(fullTestPath, 'utf8');

      try {
        const { prompt } = await this.promptLoader.execute(
          {
            agentDir,
            templateName: 'fix-prompt.md',
            variables: {
              filename: file,
              source_code: sourceContent,
              test_path: testPath,
              test_code: testContent,
              error_logs: errorLogs,
            },
          },
          context,
        );

        this.logger.info('gemini-client', `Calling Gemini API to fix ${testPath}...`);
        const fixedCode = await this.gemini.generateCode(prompt);
        fs.writeFileSync(fullTestPath, fixedCode, 'utf8');
        this.logger.success('generation', `Fixed: ${testPath}`);
      } catch (error) {
        this.logger.error('gemini-client', `Failed to fix ${testPath}: ${error}`);
      }
    }
  }
}
