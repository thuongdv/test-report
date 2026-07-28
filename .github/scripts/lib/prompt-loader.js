/**
 * Prompt template loader.
 * Reads .md prompt files from the prompts/ directory and substitutes {{placeholders}}.
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');

/**
 * Loads a prompt template and splits it into system instruction and user prompt.
 * Format: system instruction, then "---" separator, then user prompt body.
 * @param {string} name - Template filename without extension (e.g. "code-review")
 * @param {Record<string, string>} vars - Placeholder values to substitute
 * @returns {{ system: string, prompt: string }}
 */
function loadPrompt(name, vars = {}) {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Substitute {{key}} placeholders
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  // Split on the first "---" separator
  const separatorIndex = content.indexOf('\n---\n');
  if (separatorIndex === -1) {
    return { system: '', prompt: content.trim() };
  }

  return {
    system: content.slice(0, separatorIndex).trim(),
    prompt: content.slice(separatorIndex + 5).trim(),
  };
}

module.exports = { loadPrompt };
