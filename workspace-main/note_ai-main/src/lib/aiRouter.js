const OLLAMA_BASE = 'http://localhost:11434';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

let cachedOllamaAvailable = null;
let lastOllamaPing = 0;
let cachedModels = null;
const OLLAMA_PING_INTERVAL = 8000;

export function getSettings() {
  try {
    const raw = localStorage.getItem('flow-ai-settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: 'auto', ollamaModel: null, cloudProvider: 'groq', groqApiKey: '' };
}

// One-time cleanup: remove stale model names from old sessions
const KNOWN_STALE = ['llama3.2:3b', 'llama3:8b', 'deepseek-coder:6.7b'];
(function sanitizeStoredModel() {
  try {
    const raw = localStorage.getItem('flow-ai-settings');
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings.ollamaModel && KNOWN_STALE.includes(settings.ollamaModel)) {
      settings.ollamaModel = null;
      localStorage.setItem('flow-ai-settings', JSON.stringify(settings));
      console.log('[aiRouter] Cleared stale model:', settings.ollamaModel);
    }
  } catch {}
})();

export function saveSettings(settings) {
  localStorage.setItem('flow-ai-settings', JSON.stringify(settings));
  cachedOllamaAvailable = null;
  cachedModels = null;
}

export function getMode() {
  return getSettings().mode;
}

export function setMode(mode) {
  const settings = getSettings();
  settings.mode = mode;
  saveSettings(settings);
}

export async function pingOllama() {
  const now = Date.now();
  if (cachedOllamaAvailable !== null && now - lastOllamaPing < OLLAMA_PING_INTERVAL) {
    console.log('[aiRouter] pingOllama cached:', cachedOllamaAvailable);
    return cachedOllamaAvailable;
  }

  console.log('[aiRouter] pinging Ollama...');
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    cachedOllamaAvailable = res.ok;
    console.log('[aiRouter] Ollama ping result:', res.status, res.ok);
  } catch (err) {
    console.log('[aiRouter] Ollama ping failed:', err.message);
    cachedOllamaAvailable = false;
  }
  lastOllamaPing = now;
  return cachedOllamaAvailable;
}

export async function getOllamaModels() {
  if (cachedModels) return cachedModels;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    cachedModels = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }));
    return cachedModels;
  } catch {
    return [];
  }
}

async function getActiveModel() {
  const settings = getSettings();

  // If user explicitly set a model, verify it exists
  if (settings.ollamaModel) {
    const models = await getOllamaModels();
    const found = models.find(m => m.name === settings.ollamaModel);
    if (found) {
      console.log('[aiRouter] Using configured model:', settings.ollamaModel);
      return settings.ollamaModel;
    }
    console.log('[aiRouter] Configured model not found, clearing:', settings.ollamaModel);
    settings.ollamaModel = null;
    saveSettings(settings);
  }

  // Auto-detect: fetch available models and use the first one
  const models = await getOllamaModels();
  if (models.length > 0) {
    const model = models[0].name;
    console.log('[aiRouter] Auto-detected model:', model);
    settings.ollamaModel = model;
    saveSettings(settings);
    return model;
  }

  console.log('[aiRouter] No Ollama models found');
  return null;
}

async function streamOllamaChat(messages, options, onChunk) {
  const model = options.model || await getActiveModel();

  if (!model) {
    throw new Error('No Ollama models found. Pull one with: ollama pull <model>');
  }

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    options: {
      temperature: options.temperature ?? 0.3,
      num_predict: options.maxTokens ?? 200,
      num_ctx: 512,
    },
  };

  if (options.jsonMode) {
    body.format = 'json';
  }

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          fullContent += data.message.content;
          if (onChunk) onChunk(data.message.content, fullContent);
        }
      } catch {}
    }
  }

  return fullContent;
}

async function streamGroqChat(messages, options, onChunk) {
  const settings = getSettings();
  const apiKey = settings.groqApiKey || '';
  if (!apiKey) {
    throw new Error('Groq API key not set. Add it in Settings or use local mode.');
  }

  const body = {
    model: GROQ_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1000,
    stream: true,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Groq error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const data = JSON.parse(line.slice(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          if (onChunk) onChunk(content, fullContent);
        }
      } catch {}
    }
  }

  return fullContent;
}

export async function complete({ messages, options = {}, onChunk, stream = true }) {
  const settings = getSettings();
  let mode = settings.mode;

  console.log('[aiRouter] complete called, mode:', mode, 'settings:', settings);

  if (mode === 'auto') {
    const ollamaUp = await pingOllama();
    mode = ollamaUp ? 'local' : 'cloud';
    console.log('[aiRouter] auto mode resolved to:', mode);
  }

  if (mode === 'local') {
    try {
      console.log('[aiRouter] trying Ollama...');
      if (stream) {
        return await streamOllamaChat(messages, options, onChunk);
      }
      let result = '';
      await streamOllamaChat(messages, options, (chunk) => { result += chunk; });
      return result;
    } catch (err) {
      console.error('[aiRouter] Ollama failed:', err);
      if (settings.groqApiKey) {
        console.log('[aiRouter] falling back to Groq...');
        if (stream) return await streamGroqChat(messages, options, onChunk);
        let result = '';
        await streamGroqChat(messages, options, (chunk) => { result += chunk; });
        return result;
      }
      throw err;
    }
  }

  if (mode === 'cloud') {
    try {
      console.log('[aiRouter] trying Groq...');
      if (stream) {
        return await streamGroqChat(messages, options, onChunk);
      }
      let result = '';
      await streamGroqChat(messages, options, (chunk) => { result += chunk; });
      return result;
    } catch (err) {
      console.error('[aiRouter] Groq failed:', err);
      console.log('[aiRouter] falling back to Ollama...');
      if (stream) return await streamOllamaChat(messages, options, onChunk);
      let result = '';
      await streamOllamaChat(messages, options, (chunk) => { result += chunk; });
      return result;
    }
  }

  throw new Error(`Unknown AI mode: ${mode}`);
}

export async function summarize(text, onChunk) {
  const messages = [
    {
      role: 'system',
      content: 'Summarize in 3 bullets.',
    },
    { role: 'user', content: text.slice(0, 1000) },
  ];

  return complete({ messages, options: { temperature: 0.2, maxTokens: 80 }, onChunk, stream: true });
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

  console.log('[aiRouter] Generating quiz with', questionCount, 'questions from', wordCount, 'words');

  const result = await complete({
    messages,
    options: { temperature: 0.2, maxTokens: 500 },
    stream: false,
  });

  console.log('[aiRouter] Raw quiz response:', result.slice(0, 500));

  let jsonStr = result.trim();

  // Strip markdown code fences if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }

  // Try to find a JSON array in the response
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const quiz = Array.isArray(parsed) ? parsed : parsed.quiz;
    if (!Array.isArray(quiz)) throw new Error('No quiz array found');
    return quiz.filter(
      (q) => q.question && Array.isArray(q.options) && q.options.length === 4
    ).slice(0, questionCount);
  } catch (parseErr) {
    console.error('[aiRouter] Quiz parse failed:', parseErr.message, 'Raw:', result.slice(0, 200));
    throw new Error('Failed to parse quiz. Try again.');
  }
}

// ── Embeddings ──────────────────────────────────────────────────────────────

export async function embed(text, model = 'nomic-embed-text') {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: text,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama embed error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    // Ollama returns { embeddings: [[...float...]] }
    if (data.embeddings && data.embeddings.length > 0) {
      return data.embeddings[0];
    }

    throw new Error('No embeddings returned from Ollama');
  } catch (err) {
    console.error('[aiRouter] embed failed:', err.message);
    throw err;
  }
}

export async function embedBatch(texts, model = 'nomic-embed-text') {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: texts,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama embedBatch error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.embeddings || [];
  } catch (err) {
    console.error('[aiRouter] embedBatch failed:', err.message);
    throw err;
  }
}

export async function isEmbeddingAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    return models.some(m => m.includes('nomic-embed') || m.includes('embed'));
  } catch {
    return false;
  }
}

// ── Chat ────────────────────────────────────────────────────────────────────

export async function chat(userMessage, context, history = [], onChunk) {
  const truncatedContext = (context || '').slice(0, 500);
  const messages = [
    {
      role: 'system',
      content: `Answer briefly. Note: ${truncatedContext || 'none'}`,
    },
    ...history.slice(-2).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: (m.content || m.text || '').slice(0, 200),
    })),
    { role: 'user', content: userMessage },
  ];

  return complete({ messages, options: { temperature: 0.3, maxTokens: 150 }, onChunk, stream: true });
}
