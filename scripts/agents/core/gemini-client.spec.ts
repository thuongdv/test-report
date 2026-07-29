import { GeminiClient } from './gemini-client';

// Mock @google/generative-ai module
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('GeminiClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use provided apiKey and modelName', () => {
      const client = new GeminiClient('custom-key', 'gemini-2.5-pro');
      expect(client.modelName).toBe('gemini-2.5-pro');
    });

    it('should fall back to GEMINI_API_KEY env var', () => {
      const client = new GeminiClient();
      expect(client.modelName).toBe('gemini-2.5-flash');
    });

    it('should fall back to GOOGLE_API_KEY env var', () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = 'google-key';
      const client = new GeminiClient();
      expect(client.modelName).toBe('gemini-2.5-flash');
    });

    it('should throw when no API key is available', () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      expect(() => new GeminiClient()).toThrow('Gemini API key is required');
    });

    it('should use GEMINI_MODEL env var for model name', () => {
      process.env.GEMINI_MODEL = 'gemini-2.5-pro';
      const client = new GeminiClient();
      expect(client.modelName).toBe('gemini-2.5-pro');
    });
  });

  describe('generateContent', () => {
    it('should return text response from Gemini', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Review result' },
      });

      const client = new GeminiClient();
      const result = await client.generateContent('Test prompt');

      expect(result).toBe('Review result');
      expect(mockGenerateContent).toHaveBeenCalledWith('Test prompt');
    });
  });

  describe('generateCode', () => {
    it('should strip markdown fences from response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '```typescript\nconsole.log("hello");\n```' },
      });

      const client = new GeminiClient();
      const result = await client.generateCode('Generate code');

      expect(result).toBe('console.log("hello");\n');
    });

    it('should handle response without fences', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'console.log("hello");' },
      });

      const client = new GeminiClient();
      const result = await client.generateCode('Generate code');

      expect(result).toBe('console.log("hello");\n');
    });
  });

  describe('cleanMarkdownFences', () => {
    it('should remove typescript fences', () => {
      const input = '```typescript\nconst x = 1;\n```';
      expect(GeminiClient.cleanMarkdownFences(input)).toBe('const x = 1;\n');
    });

    it('should remove generic fences', () => {
      const input = '```\nconst x = 1;\n```';
      expect(GeminiClient.cleanMarkdownFences(input)).toBe('const x = 1;\n');
    });

    it('should handle input without fences', () => {
      const input = 'const x = 1;';
      expect(GeminiClient.cleanMarkdownFences(input)).toBe('const x = 1;\n');
    });

    it('should trim whitespace', () => {
      const input = '  \n```typescript\nconst x = 1;\n```\n  ';
      expect(GeminiClient.cleanMarkdownFences(input)).toBe('const x = 1;\n');
    });
  });
});
