import { FileAnalysisSkill } from './file-analysis.skill';
import type { AgentContext } from '../core/types';
import * as fs from 'fs';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileAnalysisSkill', () => {
  let skill: FileAnalysisSkill;
  const context: AgentContext = {
    workDir: '/test/repo',
    env: {},
    baseRef: 'origin/main',
    headRef: 'HEAD',
    args: [],
  };

  beforeEach(() => {
    skill = new FileAnalysisSkill();
    jest.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(skill.name).toBe('file-analysis');
  });

  describe('execute (detect changed files)', () => {
    it('should filter to production source files', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await skill.execute(
        {
          changedFiles: [
            'apps/api/src/service.ts',
            'apps/web/src/page.tsx',
            'apps/api/src/service.spec.ts',
            'README.md',
            '.github/workflows/ci.yml',
            'scripts/generate-tests.ts',
            'package.json',
            'tsconfig.json',
          ],
        },
        context,
      );

      expect(result.sourceFiles).toEqual([
        'apps/api/src/service.ts',
        'apps/web/src/page.tsx',
      ]);
      expect(result.hasChanges).toBe(true);
    });

    it('should return hasChanges=false when no source files', async () => {
      const result = await skill.execute(
        { changedFiles: ['README.md', '.github/ci.yml'] },
        context,
      );

      expect(result.sourceFiles).toEqual([]);
      expect(result.hasChanges).toBe(false);
    });

    it('should exclude files that do not exist on disk', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await skill.execute(
        { changedFiles: ['apps/api/src/deleted.ts'] },
        context,
      );

      expect(result.sourceFiles).toEqual([]);
    });

    it('should exclude test files with various patterns', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await skill.execute(
        {
          changedFiles: [
            'src/app.spec.ts',
            'src/app.test.ts',
            'src/Component.test.tsx',
            'src/helper.spec.js',
          ],
        },
        context,
      );

      expect(result.sourceFiles).toEqual([]);
    });
  });

  describe('getTargetTestPath', () => {
    it('should return .spec.ts for .ts files', () => {
      expect(skill.getTargetTestPath('src/service.ts')).toBe('src/service.spec.ts');
    });

    it('should return .test.tsx for .tsx files', () => {
      expect(skill.getTargetTestPath('src/Component.tsx')).toBe('src/Component.test.tsx');
    });

    it('should return .spec.ts for .js files', () => {
      expect(skill.getTargetTestPath('src/util.js')).toBe('src/util.spec.ts');
    });
  });

  describe('findNearbyTests', () => {
    it('should return nearby test file content', () => {
      mockFs.readdirSync.mockReturnValue([
        'service.ts',
        'service.spec.ts',
        'helper.spec.ts',
      ] as any);
      mockFs.readFileSync.mockReturnValue('test content' as any);

      const result = skill.findNearbyTests(
        { sourcePath: 'apps/api/src/service.ts' },
        context,
      );

      expect(result.context).toContain('Example Test File: helper.spec.ts');
    });

    it('should return fallback when no test files found', () => {
      mockFs.readdirSync.mockReturnValue(['service.ts', 'utils.ts'] as any);

      const result = skill.findNearbyTests(
        { sourcePath: 'apps/api/src/service.ts' },
        context,
      );

      expect(result.context).toBe('No nearby test files found.');
    });

    it('should return fallback on read error', () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = skill.findNearbyTests(
        { sourcePath: 'nonexistent/path.ts' },
        context,
      );

      expect(result.context).toBe('No nearby test files found.');
    });
  });
});
