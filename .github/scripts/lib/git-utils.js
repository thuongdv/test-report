/**
 * Git utility helpers for the AI test generation workflow.
 */

const { execSync } = require('child_process');

/**
 * Runs a shell command and returns stdout as a string.
 * @param {string} cmd - The command to execute.
 * @param {{ ignoreError?: boolean }} options
 * @returns {string} stdout (and stderr on error if ignoreError is true).
 */
function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    if (options.ignoreError) {
      return (error.stdout || '') + '\n' + (error.stderr || '');
    }
    throw error;
  }
}

/**
 * Returns the list of files changed between baseRef and HEAD.
 * @param {string} baseRef - e.g. "origin/main"
 * @returns {string[]}
 */
function getChangedFiles(baseRef) {
  const output = runCmd(`git diff --name-only ${baseRef}...HEAD`, {
    ignoreError: true,
  });
  return output
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Returns the unified diff between baseRef and HEAD.
 * @param {string} baseRef
 * @returns {string}
 */
function getGitDiff(baseRef) {
  return runCmd(`git diff ${baseRef}...HEAD`, { ignoreError: true });
}

module.exports = { runCmd, getChangedFiles, getGitDiff };
