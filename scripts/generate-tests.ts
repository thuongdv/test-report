import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

interface Options {
  files: string[];
  fixMode: boolean;
  errorOutputPath?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const files: string[] = [];
  let fixMode = false;
  let errorOutputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--fix-mode') {
      fixMode = true;
    } else if (arg === '--error-output' && i + 1 < args.length) {
      errorOutputPath = args[++i];
    } else if (!arg.startsWith('--')) {
      files.push(arg);
    }
  }

  return { files, fixMode, errorOutputPath };
}

function getTargetTestPath(sourcePath: string): string {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);

  if (ext === '.tsx') {
    return path.join(dir, `${baseName}.test.tsx`);
  }
  return path.join(dir, `${baseName}.spec.ts`);
}

function findNearbyExistingTests(sourcePath: string): string {
  const dir = path.dirname(sourcePath);
  try {
    const entries = fs.readdirSync(dir);
    const testFiles = entries.filter(
      (file) =>
        (file.endsWith('.spec.ts') ||
          file.endsWith('.test.ts') ||
          file.endsWith('.test.tsx')) &&
        file !== path.basename(getTargetTestPath(sourcePath)),
    );

    if (testFiles.length === 0) {
      return 'No nearby test files found.';
    }

    const snippets: string[] = [];
    for (const testFile of testFiles.slice(0, 2)) {
      const fullPath = path.join(dir, testFile);
      const content = fs.readFileSync(fullPath, 'utf8');
      snippets.push(`--- Example Test File: ${testFile} ---\n${content}\n`);
    }
    return snippets.join('\n');
  } catch {
    return 'No nearby test files found.';
  }
}

function cleanMarkdownFences(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  return cleaned.trim() + '\n';
}

async function main() {
  const { files, fixMode, errorOutputPath } = parseArgs();

  if (files.length === 0) {
    console.log('No source files provided for test generation.');
    process.exit(0);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required.');
    process.exit(1);
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log(`Using Gemini model: ${modelName}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const promptTemplatePath = path.join(process.cwd(), 'prompts', 'generate-tests.md');
  const promptTemplate = fs.existsSync(promptTemplatePath)
    ? fs.readFileSync(promptTemplatePath, 'utf8')
    : '';

  let errorLogs = '';
  if (fixMode && errorOutputPath && fs.existsSync(errorOutputPath)) {
    errorLogs = fs.readFileSync(errorOutputPath, 'utf8');
    console.log(`Fix mode active. Loaded error log (${errorLogs.length} bytes).`);
  }

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`Source file not found: ${file}, skipping.`);
      continue;
    }

    const sourceContent = fs.readFileSync(file, 'utf8');
    const targetTestPath = getTargetTestPath(file);
    const existingTestContext = findNearbyExistingTests(file);

    console.log(`\nProcessing: ${file}`);
    console.log(`Target test file: ${targetTestPath}`);

    let prompt = '';

    if (fixMode && fs.existsSync(targetTestPath) && errorLogs) {
      const currentTestContent = fs.readFileSync(targetTestPath, 'utf8');
      prompt = `You are a Jest test fixing expert. The unit tests generated for '${file}' failed validation.

--- SOURCE FILE (${file}) ---
${sourceContent}

--- FAILING TEST FILE (${targetTestPath}) ---
${currentTestContent}

--- TEST EXECUTION ERROR LOGS ---
${errorLogs}

INSTRUCTIONS:
1. Analyze the failure logs and determine why the test failed.
2. Fix the test file so that all assertions pass cleanly.
3. Mock missing dependencies or fix incorrect expectations.
4. Do NOT modify the production source code.
5. Return ONLY the complete, corrected TypeScript test file content without markdown fences.`;
    } else {
      prompt = promptTemplate
        .replace(/{{filename}}/g, file)
        .replace(/{{source_code}}/g, sourceContent)
        .replace(/{{existing_tests}}/g, existingTestContext);

      if (!promptTemplate) {
        prompt = `Generate Jest unit tests for '${file}'.\n\nSource:\n${sourceContent}\n\nExisting tests reference:\n${existingTestContext}\n\nOutput only valid TypeScript test code.`;
      }
    }

    try {
      console.log(`Calling Gemini API for ${file}...`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleanedCode = cleanMarkdownFences(responseText);

      fs.mkdirSync(path.dirname(targetTestPath), { recursive: true });
      fs.writeFileSync(targetTestPath, cleanedCode, 'utf8');
      console.log(`✅ Successfully generated/updated: ${targetTestPath}`);
    } catch (error) {
      console.error(`❌ Failed to generate tests for ${file}:`, error);
      process.exit(1);
    }
  }

  console.log('\nUnit test generation step completed.');
}

main().catch((err) => {
  console.error('Fatal error in generate-tests.ts:', err);
  process.exit(1);
});
