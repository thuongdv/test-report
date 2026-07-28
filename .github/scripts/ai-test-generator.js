/**
 * AI-Assisted Unit Test Generation — Orchestrator
 *
 * Usage:  node ai-test-generator.js --base-ref origin/main
 *
 * Runs all phases sequentially in a single process:
 *   1. AI-assisted code review
 *   2. AI unit test generation
 *   3. Test execution with retry loop (max 3 attempts)
 */

const fs = require('fs');
const path = require('path');

const { runCmd, getChangedFiles, getGitDiff } = require('./lib/git-utils');
const {
  detectWorkspace,
  resolveTestFilePath,
  isSourceCodeFile,
  getChangedPackages,
  getTestCommand,
} = require('./lib/workspace');
const { callAI, extractCodeBlock } = require('./lib/ai-client');
const { loadPrompt } = require('./lib/prompt-loader');

const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Phase 1 — AI-Assisted Code Review
// ---------------------------------------------------------------------------

async function runCodeReview(diff, changedFiles) {
  console.log('\n🔍 Phase 1: AI-Assisted Code Review...');
  console.log(`   Analyzing ${changedFiles.length} modified file(s).`);

  if (!diff || changedFiles.length === 0) {
    console.log('✅ No code changes detected — skipping review.');
    return;
  }

  const { system, prompt } = loadPrompt('code-review', { diff });
  const result = await callAI(prompt, system);

  if (!result) {
    console.error('❌ GEMINI_API_KEY is not configured. Cannot perform AI code review.');
    process.exit(1);
  }

  if (result.includes('BLOCKING_ISSUES_FOUND:')) {
    console.error('❌ AI Code Review identified blocking issues:');
    console.error(result);
    process.exit(1);
  }

  console.log('✅ AI Code Review passed — no blocking issues.');
}

// ---------------------------------------------------------------------------
// Phase 2 — AI Unit Test Generation
// ---------------------------------------------------------------------------

function getSystemRole(workspace) {
  if (workspace === 'api') return 'NestJS test engineer writing unit tests using Jest and @nestjs/testing';
  if (workspace === 'web') return 'Next.js React test engineer writing unit tests using Jest and @testing-library/react';
  return 'test engineer writing high-coverage unit tests';
}

async function runTestGeneration(diff, changedFiles) {
  console.log('\n🧪 Phase 2: AI Unit Test Generation...');

  const codeFiles = changedFiles.filter(isSourceCodeFile);
  if (codeFiles.length === 0) {
    console.log('ℹ️  No source files require test generation.');
    return;
  }

  console.log(`   Generating tests for: ${codeFiles.join(', ')}`);

  for (const file of codeFiles) {
    const testFilePath = resolveTestFilePath(file);
    const fileContent = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    const existingTest = fs.existsSync(testFilePath) ? fs.readFileSync(testFilePath, 'utf-8') : '';
    const workspace = detectWorkspace(file) || 'root';

    const { system, prompt } = loadPrompt('test-generation', {
      systemRole: getSystemRole(detectWorkspace(file)),
      file,
      workspace,
      testFilePath,
      fileContent,
      existingTest,
      diff,
    });

    const aiResponse = await callAI(prompt, system);

    if (!aiResponse) {
      console.error(`❌ GEMINI_API_KEY is not configured. Cannot generate tests for ${file}.`);
      process.exit(1);
    }

    const testCode = extractCodeBlock(aiResponse);
    if (testCode) {
      fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
      fs.writeFileSync(testFilePath, testCode + '\n', 'utf-8');
      console.log(`   ✅ Generated: ${testFilePath}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — Test Execution with Retry Loop
// ---------------------------------------------------------------------------

async function runTestsWithRetry(diff, changedFiles) {
  console.log('\n🔄 Phase 3: Test Execution & Retry Loop...');

  const testCmd = getTestCommand(getChangedPackages(changedFiles));
  console.log(`   Command: ${testCmd}`);

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    console.log(`\n   --- Attempt ${attempt}/${MAX_RETRIES + 1} ---`);

    try {
      // Use exit code to determine pass/fail — not string matching.
      runCmd(testCmd);
      console.log('   ✅ All unit tests passed.');
      return; // success
    } catch (error) {
      const output = (error.stdout || '') + '\n' + (error.stderr || '');
      console.warn(`   ⚠️  Tests failed on attempt ${attempt}.`);
      console.warn(output.slice(-1000));

      if (attempt > MAX_RETRIES) {
        console.error(`   ❌ Exceeded ${MAX_RETRIES} retry attempts. Stopping.`);
        process.exit(1);
      }

      // Ask the AI to diagnose and produce a fix
      console.log('   🤖 AI analyzing failure...');
      const { system, prompt } = loadPrompt('retry-fix', {
        testOutput: output.slice(-2000),
        diff,
      });

      const fixResponse = await callAI(prompt, system);

      if (!fixResponse) {
        console.error('   ❌ No AI response for retry. Stopping.');
        process.exit(1);
      }

      // Apply fixes — parse "=== FILE: ... ===" blocks
      const fileBlocks = fixResponse.split(/===\s*FILE:\s*/i).slice(1);
      let appliedCount = 0;

      for (const block of fileBlocks) {
        const headerMatch = block.match(/^(.+?)\s*===\s*\n/);
        if (!headerMatch) continue;

        const filePath = headerMatch[1].trim();
        const codeMatch = block.match(/```(?:ts|typescript|tsx|js|javascript|jsx)?\n([\s\S]*?)```/);
        if (!codeMatch) continue;

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, codeMatch[1].trim() + '\n', 'utf-8');
        console.log(`   📝 Applied fix: ${filePath}`);
        appliedCount++;
      }

      if (appliedCount === 0) {
        console.error('   ❌ Could not parse AI fix. Stopping.');
        process.exit(1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const baseRefIdx = args.indexOf('--base-ref');
  const baseRef = baseRefIdx !== -1 ? args[baseRefIdx + 1] : 'origin/main';
  const skipCodeReview = args.includes('--skip-code-review');

  console.log(`🚀 AI-Assisted Unit Test Generation (base: ${baseRef})`);

  // Compute git data once and share across all phases
  const changedFiles = getChangedFiles(baseRef);
  const diff = getGitDiff(baseRef);

  if (skipCodeReview) {
    console.log('\nℹ️  Code review skipped (--skip-code-review).');
  } else {
    await runCodeReview(diff, changedFiles);
  }
  await runTestGeneration(diff, changedFiles);
  await runTestsWithRetry(diff, changedFiles);

  console.log('\n✅ All phases completed successfully.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
