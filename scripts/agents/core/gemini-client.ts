/**
 * Centralized Gemini API client.
 *
 * Thin wrapper around @google/generative-ai that provides:
 * - API key resolution from environment
 * - Model selection from environment
 * - Markdown fence cleaning on responses
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

export class GeminiClient {
  private readonly model: GenerativeModel;
  public readonly modelName: string;

  constructor(apiKey?: string, modelName?: string) {
    const resolvedKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!resolvedKey) {
      throw new Error(
        'Gemini API key is required. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.',
      );
    }

    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(resolvedKey);
    this.model = genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Generate content from a prompt and return the raw text response.
   */
  async generateContent(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Generate content and strip any markdown code fences from the response.
   * Useful for code generation tasks where Gemini wraps output in ```blocks```.
   */
  async generateCode(prompt: string): Promise<string> {
    const raw = await this.generateContent(prompt);
    return GeminiClient.cleanMarkdownFences(raw);
  }

  /**
   * Remove markdown code fence wrappers from a string.
   */
  static cleanMarkdownFences(code: string): string {
    let cleaned = code.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
      cleaned = cleaned.replace(/\n?```$/, '');
    }
    return cleaned.trim() + '\n';
  }
}
