/**
 * FileAnalysisSkill — Detects changed production source files and discovers
 * nearby test context.
 *
 * Consolidates:
 * - Source file detection from generate-unit-tests.yml (lines 44-77)
 * - Nearby test file discovery from generate-tests.ts (lines 42-68)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ISkill, AgentContext } from '../core/types';
import { SkillError } from '../core/types';

// ---------------------------------------------------------------------------
// Detect Changed Source Files
// ---------------------------------------------------------------------------

export interface DetectChangedFilesInput {
  /** Raw list of all changed file paths from a git diff. */
  changedFiles: string[];
}

export interface DetectChangedFilesOutput {
  /** Filtered list of production source files. */
  sourceFiles: string[];
  /** Whether any production source files were found. */
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Find Nearby Test Context
// ---------------------------------------------------------------------------

export interface FindNearbyTestsInput {
  /** Path to the source file to find context for. */
  sourcePath: string;
}

export interface FindNearbyTestsOutput {
  /** Concatenated content of nearby test files for prompt context. */
  context: string;
}

// ---------------------------------------------------------------------------
// Get Target Test Path
// ---------------------------------------------------------------------------

export interface GetTargetTestPathInput {
  /** Path to the source file. */
  sourcePath: string;
}

export interface GetTargetTestPathOutput {
  /** Computed test file path for the given source. */
  testPath: string;
}

/**
 * FileAnalysisSkill implements three related capabilities:
 * 1. Filtering changed files to production source files
 * 2. Discovering nearby existing test files for context
 * 3. Computing the target test file path for a source file
 *
 * Agents call the specific method they need rather than a generic execute().
 */
export class FileAnalysisSkill
  implements ISkill<DetectChangedFilesInput, DetectChangedFilesOutput>
{
  readonly name = 'file-analysis';

  /** Production source file extensions. */
  private static readonly SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx)$/;

  /** Patterns to exclude from production source detection. */
  private static readonly EXCLUDE_PATTERNS = [
    /\.(spec|test)\.(ts|tsx|js|jsx)$/,
    /^\.github\//,
    /^scripts\//,
    /^prompts\//,
    /package.*\.json$/,
    /tsconfig.*\.json$/,
  ];

  /**
   * ISkill.execute — Detect changed production source files.
   */
  async execute(
    input: DetectChangedFilesInput,
    context: AgentContext,
  ): Promise<DetectChangedFilesOutput> {
    const sourceFiles = input.changedFiles.filter((file) => {
      if (!FileAnalysisSkill.SOURCE_EXTENSIONS.test(file)) return false;

      for (const pattern of FileAnalysisSkill.EXCLUDE_PATTERNS) {
        if (pattern.test(file)) return false;
      }

      // Verify file exists on disk
      const fullPath = path.resolve(context.workDir, file);
      return fs.existsSync(fullPath);
    });

    return {
      sourceFiles,
      hasChanges: sourceFiles.length > 0,
    };
  }

  /**
   * Find nearby test files in the same directory for prompt context.
   * Returns up to 2 test file snippets.
   */
  findNearbyTests(input: FindNearbyTestsInput, context: AgentContext): FindNearbyTestsOutput {
    const fullSourcePath = path.resolve(context.workDir, input.sourcePath);
    const dir = path.dirname(fullSourcePath);
    const targetTestBaseName = path.basename(this.getTargetTestPath(input.sourcePath));

    try {
      const entries = fs.readdirSync(dir);
      const testFiles = entries.filter(
        (file) =>
          (file.endsWith('.spec.ts') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) &&
          file !== targetTestBaseName,
      );

      if (testFiles.length === 0) {
        return { context: 'No nearby test files found.' };
      }

      const snippets: string[] = [];
      for (const testFile of testFiles.slice(0, 2)) {
        const fullPath = path.join(dir, testFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        snippets.push(`--- Example Test File: ${testFile} ---\n${content}\n`);
      }
      return { context: snippets.join('\n') };
    } catch {
      return { context: 'No nearby test files found.' };
    }
  }

  /**
   * Compute the target test file path for a given source file.
   * - .tsx files → .test.tsx (React component convention)
   * - All others → .spec.ts (NestJS convention)
   */
  getTargetTestPath(sourcePath: string): string {
    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const dir = path.dirname(sourcePath);

    if (ext === '.tsx') {
      return path.join(dir, `${baseName}.test.tsx`);
    }
    return path.join(dir, `${baseName}.spec.ts`);
  }
}
