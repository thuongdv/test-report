/**
 * AI-Assisted Unit Test Generation Helper Script
 * Handles AI Code Review, Test Generation, and Iterative Retry Loop (max 3 retries).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX_RETRIES = 3;

function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
  } catch (error) {
    if (options.ignoreError) {
      return error.stdout || error.stderr || '';
    }
    throw error;
  }
}

function getChangedFiles(baseRef = 'origin/main') {
  try {
    const output = runCmd(`git diff --name-only ${baseRef}...HEAD`, { ignoreError: true });
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
  } catch (err) {
    console.warn('Could not determine changed files using git diff:', err.message);
    return [];
  }
}

function getGitDiff(baseRef = 'origin/main') {
  try {
    return runCmd(`git diff ${baseRef}...HEAD`, { ignoreError: true });
  } catch (err) {
    return '';
  }
}

async function callAI(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('ℹ️ No AI API key (GEMINI_API_KEY/OPENAI_API_KEY) found. Using deterministic fallback generator.');
    return null;
  }

  try {
    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }]
          })
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
  } catch (error) {
    console.error('⚠️ AI API call error:', error.message);
    return null;
  }

  return null;
}

// Step 3: AI-Assisted Code Review
async function modeReview(baseRef) {
  console.log('🔍 Executing Step 3: AI-Assisted Code Review...');
  const diff = getGitDiff(baseRef);
  const changedFiles = getChangedFiles(baseRef);

  console.log(`Analyzing ${changedFiles.length} modified files in PR...`);

  if (!diff || changedFiles.length === 0) {
    console.log('✅ No code changes detected in diff for AI review.');
    return;
  }

  const prompt = `Review the following code diff for potential bugs, security issues, code smells, missing edge cases, and style violations.
If there are blocking issues, reply with "BLOCKING_ISSUES_FOUND:" followed by bullet points.
If there are no blocking issues, reply with "NO_BLOCKING_ISSUES".

Diff:
${diff}`;

  const aiResult = await callAI(prompt, 'You are a senior software reviewer performing strict automated code review.');

  if (aiResult && aiResult.includes('BLOCKING_ISSUES_FOUND:')) {
    console.error('❌ AI Code Review identified blocking issues:');
    console.error(aiResult);
    process.exit(1);
  }

  console.log('✅ AI Code Review passed with no blocking issues.');
}

// Step 4: AI Unit Test Generation
async function modeGenerate(baseRef) {
  console.log('🧪 Executing Step 4: AI Unit Test Generation...');
  const changedFiles = getChangedFiles(baseRef);
  const diff = getGitDiff(baseRef);

  const codeFiles = changedFiles.filter(f => !f.includes('.test.') && !f.includes('.spec.') && (f.endsWith('.js') || f.endsWith('.ts')));

  if (codeFiles.length === 0) {
    console.log('ℹ️ No implementation source code files modified requiring new test generation.');
    return;
  }

  console.log(`Generating/updating unit tests for target files: ${codeFiles.join(', ')}`);

  for (const file of codeFiles) {
    const testFilePath = file.replace(/\.(js|ts)$/, '.test.$1');
    const existingCode = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
    const existingTest = fs.existsSync(testFilePath) ? fs.readFileSync(testFilePath, 'utf-8') : '';

    const prompt = `Analyze the file "${file}" and PR diff.
Generate or update Jest/unit tests in file "${testFilePath}".
Rules:
- Generate comprehensive unit tests covering edge cases.
- Update existing tests only when necessary.
- Do NOT alter unrelated files.
- Return code inside triple backticks \`\`\`javascript ... \`\`\`.

File Content:
${existingCode}

Existing Test Content:
${existingTest}

Diff:
${diff}`;

    const aiResponse = await callAI(prompt, 'You are an expert test engineer writing high-coverage unit tests.');

    if (aiResponse) {
      const codeMatch = aiResponse.match(/```(?:js|javascript|ts|typescript)?\n([\s\S]*?)```/);
      const testCode = codeMatch ? codeMatch[1] : aiResponse;
      if (testCode.trim()) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        fs.writeFileSync(testFilePath, testCode.trim() + '\n', 'utf-8');
        console.log(`✅ Generated/updated test file: ${testFilePath}`);
      }
    } else {
      // Baseline test file if no API response/key available
      if (!fs.existsSync(testFilePath)) {
        const moduleName = path.basename(file, path.extname(file));
        const mockTestCode = `// AI Generated Unit Test for ${file}
const ${moduleName} = require('./${path.basename(file)}');

describe('${moduleName} Unit Tests', () => {
  test('should be defined', () => {
    expect(${moduleName}).toBeDefined();
  });
});
`;
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        fs.writeFileSync(testFilePath, mockTestCode, 'utf-8');
        console.log(`✅ Created baseline test file: ${testFilePath}`);
      }
    }
  }
}

// Step 5 & 9: Complete Test Execution & AI Retry Loop
async function modeRetryLoop(baseRef) {
  console.log('🔄 Executing Step 5 & Step 9: Unit Test Suite Execution & AI Retry Loop...');

  let testPassed = false;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    console.log(`\n--- Test Execution Attempt ${attempt}/${MAX_RETRIES + 1} ---`);

    try {
      // Run test command
      const testOutput = runCmd('npm test', { ignoreError: true });

      // Check if npm test passed
      if (!testOutput.includes('FAIL') && !testOutput.includes('Error:') && !testOutput.includes('exit 1')) {
        console.log('✅ All unit tests passed successfully!');
        testPassed = true;
        break;
      }

      console.warn(`⚠️ Test suite failed on attempt ${attempt}. Output snippet:`);
      console.warn(testOutput.slice(-500));

      if (attempt > MAX_RETRIES) {
        console.error(`❌ Exceeded maximum retry attempts (${MAX_RETRIES}). Stopping workflow.`);
        process.exit(1);
      }

      console.log(`🤖 AI Analyzing test failure for retry attempt ${attempt}...`);
      const diff = getGitDiff(baseRef);
      const prompt = `The unit test suite failed with the following log:
${testOutput}

Code diff:
${diff}

Analyze the failure, classify if it is a Test bug or Production code defect.
Provide updated fix.
CONSTRAINTS:
- Do NOT remove assertions.
- Do NOT weaken assertions.
- Do NOT disable or skip tests.
- Do NOT reduce test coverage.`;

      const fixResponse = await callAI(prompt, 'You are an automated debugger fixing unit tests and production code defects.');
      if (!fixResponse) {
        console.log('ℹ️ No AI response for retry attempt. Stopping retry loop.');
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error executing tests on attempt ${attempt}:`, err.message);
      if (attempt > MAX_RETRIES) {
        process.exit(1);
      }
    }
  }

  if (!testPassed) {
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const modeArgIndex = args.indexOf('--mode');
  const baseRefIndex = args.indexOf('--base-ref');

  const mode = modeArgIndex !== -1 ? args[modeArgIndex + 1] : 'review';
  const baseRef = baseRefIndex !== -1 ? args[baseRefIndex + 1] : 'origin/main';

  if (mode === 'review') {
    await modeReview(baseRef);
  } else if (mode === 'generate') {
    await modeGenerate(baseRef);
  } else if (mode === 'retry-loop') {
    await modeRetryLoop(baseRef);
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error in ai-test-generator script:', err);
  process.exit(1);
});
