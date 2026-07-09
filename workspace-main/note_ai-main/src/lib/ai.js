// ── AI Logic (Legacy Re-export) ──────────────────────────────────────────
// All functionality moved to src/core/ai.js
// This file re-exports for backward compatibility.

import { complete as aiComplete, summarize as aiSummarize, generateQuiz as aiGenerateQuiz } from './aiRouter.js';

export const summarizeNotes = async (text, onChunk) => {
  if (!text || text.trim().length < 10) {
    throw new Error('Text is too short to summarize.');
  }
  try {
    return await aiSummarize(text, onChunk);
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};

export const generateQuizFromSummary = async (text) => {
  if (!text || text.trim().length < 10) {
    throw new Error('Summary text is too short to generate a quiz.');
  }
  try {
    return await aiGenerateQuiz(text);
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};

// Re-export complete for direct usage
export { aiComplete as complete };
