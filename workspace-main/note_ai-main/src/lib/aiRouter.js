// ── AI Router (Legacy Re-export) ─────────────────────────────────────────
// All functionality moved to src/core/ai.js
// This file re-exports for backward compatibility.

export {
  complete,
  getSettings,
  saveSettings,
  pingOllama,
  getOllamaModels,
  embed,
  embedBatch,
  isEmbeddingAvailable,
} from '../core/ai.js';

import { getSettings, saveSettings } from '../core/ai.js';

export function getMode() {
  return getSettings().mode;
}

export function setMode(mode) {
  const settings = getSettings();
  settings.mode = mode;
  saveSettings(settings);
}

// ── Legacy wrappers (keep old callers working) ────────────────────────────

import { complete as aiComplete } from '../core/ai.js';

export async function summarize(text, onChunk) {
  const messages = [
    { role: 'system', content: 'Summarize in 3 bullets.' },
    { role: 'user', content: text.slice(0, 1000) },
  ];
  return aiComplete({ messages, options: { temperature: 0.2, maxTokens: 80 }, onChunk, stream: true });
}

export async function generateQuiz(text) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  let questionCount = 3;
  if (wordCount > 100) questionCount = 4;

  const messages = [
    {
      role: 'system',
      content: `JSON array of ${questionCount} MCQs. Each: {"question":"...","options":["A","B","C","D"],"correctAnswerIndex":0}`,
    },
    { role: 'user', content: text.slice(0, 800) },
  ];

  const result = await aiComplete({
    messages,
    options: { temperature: 0.2, maxTokens: 500 },
    stream: false,
  });

  let jsonStr = result.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  const parsed = JSON.parse(jsonStr);
  const quiz = Array.isArray(parsed) ? parsed : parsed.quiz;
  if (!Array.isArray(quiz)) throw new Error('No quiz array found');
  return quiz.filter(q => q.question && Array.isArray(q.options) && q.options.length === 4).slice(0, questionCount);
}

export async function chat(userMessage, context, history = [], onChunk) {
  const truncatedContext = (context || '').slice(0, 500);
  const messages = [
    { role: 'system', content: `Answer briefly. Note: ${truncatedContext || 'none'}` },
    ...history.slice(-2).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: (m.content || m.text || '').slice(0, 200),
    })),
    { role: 'user', content: userMessage },
  ];
  return aiComplete({ messages, options: { temperature: 0.3, maxTokens: 150 }, onChunk, stream: true });
}
