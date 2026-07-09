// ── AI Helper Adapter ─────────────────────────────────────────────────────
// Adapts the legacy JS ai.js re-exports to the new Rust-backed aiRouter.

import { summarize, generateQuiz } from './aiRouter.js';

export const summarizeNotes = async (text, onChunk) => {
  if (!text || text.trim().length < 10) {
    throw new Error('Text is too short to summarize.');
  }
  return await summarize(text, onChunk);
};

export const generateQuizFromSummary = async (text) => {
  if (!text || text.trim().length < 10) {
    throw new Error('Summary text is too short to generate a quiz.');
  }
  return await generateQuiz(text);
};
