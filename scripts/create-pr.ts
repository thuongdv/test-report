import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

function runGit(command: string): string {
  try {
    return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
  } catch (error: any) {
    console.error(`Git command failed: git ${command}\n${error?.stderr || error?.message}`);
    throw error;
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required.');
    process.exit(1);
  }

  const prNumber = process.env.PR_NUMBER;
  const targetBranch = process.env.PR_BRANCH;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!prNumber || !targetBranch || !repository) {
    console.error('Error: PR_NUMBER, PR_BRANCH, and GITHUB_REPOSITORY environment variables are required.');
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  const aiBranch = `ai/generated-tests/${prNumber}`;

  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Target developer branch: ${targetBranch}`);
  console.log(`AI branch to create: ${aiBranch}`);

  const statusOutput = runGit('status --porcelain');
  const lines = statusOutput.split('\n').filter((l) => l.trim() !== '');

  const testFileRegex = /\.(spec|test)\.(ts|tsx)$/;
  const generatedFiles: string[] = [];

  for (const line of lines) {
    const filePath = line.substring(3).trim();
    if (testFileRegex.test(filePath)) {
      generatedFiles.push(filePath);
    }
  }

  if (generatedFiles.length === 0) {
    console.log('No new or modified test files found to commit.');
    process.exit(0);
  }

  console.log('\nFound generated test files to commit:');
  generatedFiles.forEach((f) => console.log(`  - ${f}`));

  runGit('config user.name "github-actions[bot]"');
  runGit('config user.email "github-actions[bot]@users.noreply.github.com"');

  runGit(`checkout -b ${aiBranch}`);

  for (const file of generatedFiles) {
    runGit(`add "${file}"`);
  }

  const commitMsg = `test(ai): auto-generated unit tests for PR #${prNumber}`;
  runGit(`commit -m "${commitMsg}"`);

  console.log(`Pushing branch ${aiBranch} to origin...`);
  runGit(`push -u origin ${aiBranch} --force`);

  const octokit = new Octokit({ auth: token });

  const prTitle = `test(ai): generated unit tests for PR #${prNumber}`;
  const fileListMd = generatedFiles.map((f) => `- \`${f}\``).join('\n');

  const prBody = `## 🤖 AI-Generated Unit Tests

This Pull Request contains unit tests generated automatically by Gemini for changes in PR #${prNumber}.

### 📄 Generated Test Files
${fileListMd}

### ℹ️ Details
- Target Branch: \`${targetBranch}\`
- Generated using Jest and NestJS / React testing conventions.
- All tests passed validation before this PR was created.

---
*Please review the generated test cases and merge this PR into your feature branch \`${targetBranch}\` when ready.*`;

  try {
    const existingPrs = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${aiBranch}`,
      base: targetBranch,
      state: 'open',
    });

    if (existingPrs.data.length > 0) {
      const existing = existingPrs.data[0];
      console.log(`\nExisting AI PR found: ${existing.html_url}`);
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: existing.number,
        body: prBody,
      });
      console.log(`Updated PR #${existing.number} description.`);
    } else {
      const createdPr = await octokit.rest.pulls.create({
        owner,
        repo,
        title: prTitle,
        head: aiBranch,
        base: targetBranch,
        body: prBody,
      });
      console.log(`\n✅ Created AI Pull Request #${createdPr.data.number}: ${createdPr.data.html_url}`);
    }
  } catch (error: any) {
    console.error('Failed to create or update Pull Request via GitHub API:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in create-pr.ts:', err);
  process.exit(1);
});
