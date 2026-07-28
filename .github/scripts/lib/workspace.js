/**
 * Workspace detection and test-file resolution for the monorepo.
 */

const path = require('path');

/**
 * Maps a file path to its workspace name.
 * Uses hardcoded workspace paths for this monorepo.
 * @param {string} filePath
 * @returns {'api' | 'web' | 'shared' | null}
 */
function detectWorkspace(filePath) {
  if (filePath.startsWith('apps/api/')) return 'api';
  if (filePath.startsWith('apps/web/')) return 'web';
  if (filePath.startsWith('packages/shared/')) return 'shared';
  return null;
}

/**
 * Resolves the expected test file path for a given source file.
 *  - NestJS (api): *.spec.ts
 *  - Next.js (web) / other: *.test.{ext}
 * @param {string} filePath
 * @returns {string}
 */
function resolveTestFilePath(filePath) {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  if (detectWorkspace(filePath) === 'api') {
    return `${base}.spec${ext === '.tsx' || ext === '.jsx' ? '.tsx' : '.ts'}`;
  }
  return `${base}.test${ext}`;
}

/**
 * Returns true if the file is a source code file worth generating tests for.
 * Excludes test files, type declarations, config, node_modules, .next.
 * @param {string} filePath
 * @returns {boolean}
 */
function isSourceCodeFile(filePath) {
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return false;
  const skip = ['.test.', '.spec.', '.d.ts', '.config.', 'node_modules/', '.next/'];
  return !skip.some((s) => filePath.includes(s));
}

/**
 * Derives the unique set of workspace names touched by a list of files.
 * @param {string[]} changedFiles
 * @returns {string[]}
 */
function getChangedPackages(changedFiles) {
  const pkgs = new Set();
  for (const f of changedFiles) {
    const ws = detectWorkspace(f);
    if (ws) pkgs.add(ws);
  }
  return [...pkgs];
}

/**
 * Builds the turbo test command, optionally scoped to changed packages.
 * @param {string[]} changedPackages
 * @returns {string}
 */
function getTestCommand(changedPackages) {
  if (changedPackages.length === 0) return 'npx turbo test';
  const filters = changedPackages.map((p) => `--filter=${p}`).join(' ');
  return `npx turbo test ${filters}`;
}

module.exports = {
  detectWorkspace,
  resolveTestFilePath,
  isSourceCodeFile,
  getChangedPackages,
  getTestCommand,
};
