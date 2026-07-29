/**
 * PromptLoaderSkill — Loads co-located prompt markdown templates and
 * performs variable substitution.
 *
 * Replaces the inline template loading logic from generate-tests.ts (lines 99-152).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ISkill, AgentContext } from '../core/types';
import { SkillError } from '../core/types';

export interface PromptLoaderInput {
  /** Directory of the agent containing the prompt file (absolute or relative to workDir). */
  agentDir: string;
  /** Name of the template file (e.g., 'prompt.md', 'fix-prompt.md'). */
  templateName: string;
  /** Key-value pairs to substitute for {{variable}} placeholders. */
  variables?: Record<string, string>;
}

export interface PromptLoaderOutput {
  /** The fully-resolved prompt string with variables substituted. */
  prompt: string;
}

export class PromptLoaderSkill implements ISkill<PromptLoaderInput, PromptLoaderOutput> {
  readonly name = 'prompt-loader';

  async execute(input: PromptLoaderInput, context: AgentContext): Promise<PromptLoaderOutput> {
    const agentDir = path.isAbsolute(input.agentDir)
      ? input.agentDir
      : path.resolve(context.workDir, input.agentDir);

    const templatePath = path.join(agentDir, input.templateName);

    if (!fs.existsSync(templatePath)) {
      throw new SkillError(
        this.name,
        `Prompt template not found: ${templatePath}`,
      );
    }

    let prompt = fs.readFileSync(templatePath, 'utf8');

    // Substitute {{variable}} placeholders
    if (input.variables) {
      for (const [key, value] of Object.entries(input.variables)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        prompt = prompt.replace(pattern, value);
      }
    }

    return { prompt };
  }
}
