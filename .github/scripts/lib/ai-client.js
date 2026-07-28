/**
 * AI client — Gemini-only.
 * Sends prompts to the Gemini API and extracts code blocks from responses.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Calls the Gemini API. Returns the text response, or null on failure.
 * @param {string} prompt
 * @param {string} [systemInstruction]
 * @returns {Promise<string | null>}
 */
async function callAI(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        }),
      },
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('⚠️  Gemini API call failed:', error.message);
    return null;
  }
}

/**
 * Extracts the first fenced code block from an AI response.
 * Falls back to the raw response if no fence is found.
 * @param {string} text
 * @returns {string}
 */
function extractCodeBlock(text) {
  const match = text.match(/```(?:js|javascript|ts|typescript|tsx|jsx)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

module.exports = { callAI, extractCodeBlock };
