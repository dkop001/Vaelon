// ── Unified AI Router ─────────────────────────────────────────────────────
// Single entry point: complete()
// Everything goes through here. No more summarize(), quiz(), chat() wrappers.

const OLLAMA_BASE = 'http://localhost:11434';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

let cachedOllamaAvailable = null;
let lastOllamaPing = 0;
let cachedModels = null;
const OLLAMA_PING_INTERVAL = 8000;

// ── Settings ─────────────────────────────────────────────────────────────

export function getSettings() {
  try {
    const raw = localStorage.getItem('flow-ai-settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: 'auto', ollamaModel: null, cloudProvider: 'groq', groqApiKey: '' };
}

export function saveSettings(settings) {
  localStorage.setItem('flow-ai-settings', JSON.stringify(settings));
  cachedOllamaAvailable = null;
  cachedModels = null;
}

// ── Ollama ───────────────────────────────────────────────────────────────

export async function pingOllama() {
  const now = Date.now();
  if (cachedOllamaAvailable !== null && now - lastOllamaPing < OLLAMA_PING_INTERVAL) {
    return cachedOllamaAvailable;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    cachedOllamaAvailable = res.ok;
  } catch {
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

  if (settings.ollamaModel) {
    const models = await getOllamaModels();
    const found = models.find(m => m.name === settings.ollamaModel);
    if (found) return settings.ollamaModel;
    settings.ollamaModel = null;
    saveSettings(settings);
  }

  const models = await getOllamaModels();
  if (models.length > 0) {
    const model = models[0].name;
    settings.ollamaModel = model;
    saveSettings(settings);
    return model;
  }

  return null;
}

// ── Stream Helpers ───────────────────────────────────────────────────────

async function streamOllamaChat(messages, options, onChunk) {
  const model = options.model || await getActiveModel();
  if (!model) throw new Error('No Ollama models found. Pull one with: ollama pull <model>');

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    options: {
      temperature: options.temperature ?? 0.3,
      num_predict: options.maxTokens ?? 200,
      num_ctx: options.contextWindow ?? 512,
    },
  };

  if (options.jsonMode) body.format = 'json';

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
  if (!apiKey) throw new Error('Groq API key not set.');

  const body = {
    model: GROQ_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1000,
    stream: true,
  };

  if (options.jsonMode) body.response_format = { type: 'json_object' };

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

// ── Single Entry Point ───────────────────────────────────────────────────

export async function complete({ messages, options = {}, onChunk, stream = true }) {
  const settings = getSettings();
  let mode = settings.mode;

  if (mode === 'auto') {
    const ollamaUp = await pingOllama();
    mode = ollamaUp ? 'local' : 'cloud';
  }

  if (mode === 'local') {
    try {
      if (stream) return await streamOllamaChat(messages, options, onChunk);
      let result = '';
      await streamOllamaChat(messages, options, (chunk) => { result += chunk; });
      return result;
    } catch (err) {
      if (settings.groqApiKey) {
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
      if (stream) return await streamGroqChat(messages, options, onChunk);
      let result = '';
      await streamGroqChat(messages, options, (chunk) => { result += chunk; });
      return result;
    } catch (err) {
      if (stream) return await streamOllamaChat(messages, options, onChunk);
      let result = '';
      await streamOllamaChat(messages, options, (chunk) => { result += chunk; });
      return result;
    }
  }

  throw new Error(`Unknown AI mode: ${mode}`);
}

// ── Embeddings ───────────────────────────────────────────────────────────

export async function embed(text, model = 'nomic-embed-text') {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Ollama embed error ${res.status}`);
  const data = await res.json();
  if (data.embeddings?.length > 0) return data.embeddings[0];
  throw new Error('No embeddings returned');
}

export async function embedBatch(texts, model = 'nomic-embed-text') {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Ollama embedBatch error ${res.status}`);
  const data = await res.json();
  return data.embeddings || [];
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
