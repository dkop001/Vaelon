# aiRouter.js — Unified AI Routing Module

## Purpose
Single entry point for ALL AI calls in Flow. Decides whether to use local Ollama or cloud APIs based on user settings and hardware capability.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     aiRouter.js                             │
├─────────────────────────────────────────────────────────────┤
│  Input: { type, messages, options, stream }                 │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Check Mode  │───▶│ Ping Ollama │───▶│ Route Call  │     │
│  │ (settings)  │    │ (if auto)   │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                           │                   │             │
│                           ▼                   ▼             │
│                    ┌─────────────┐    ┌─────────────┐       │
│                    │ Local Mode  │    │ Cloud Mode  │       │
│                    │ (Ollama)    │    │ (Groq/Gemini│       │
│                    └─────────────┘    └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## API Surface

```javascript
// Main entry point
aiRouter.complete(params) → Promise<Stream | Response>

// Helper methods
aiRouter.pingOllama() → Promise<boolean>
aiRouter.getModels() → Promise<Model[]>
aiRouter.setMode(mode) → void
aiRouter.getMode() → string
```

## Parameters

```javascript
{
  type: 'summarize' | 'quiz' | 'chat' | 'embed',
  messages: Array<{ role: string, content: string }>,
  options: {
    model: string,           // Override model (optional)
    temperature: number,     // Default: 0.3
    maxTokens: number,       // Default: 1000
    jsonMode: boolean,       // For quiz generation
  },
  stream: boolean,           // Enable SSE streaming
  onChunk: Function,         // Callback for streaming chunks
}
```

## Mode Logic

```javascript
// User settings (from SQLite or localStorage)
mode: 'local' | 'cloud' | 'auto'

// Auto mode logic:
if (mode === 'auto') {
  const ollamaAvailable = await pingOllama();
  if (ollamaAvailable) {
    return routeToLocal(params);
  } else {
    return routeToCloud(params);
  }
}

if (mode === 'local') return routeToLocal(params);
if (mode === 'cloud') return routeToCloud(params);
```

## Ollama Integration

```javascript
// Endpoint: http://localhost:11434/api/chat
// Format: OpenAI-compatible

const ollamaRequest = {
  model: 'llama3.2:3b',  // or user's chosen model
  messages: params.messages,
  stream: true,
  options: {
    temperature: params.options.temperature,
    num_predict: params.options.maxTokens,
  }
};

// For JSON mode (quiz):
options: { ...params.options, format: 'json' }
```

## Cloud Fallback

```javascript
// Groq (primary cloud)
const groqRequest = {
  model: 'llama-3.1-8b-instant',
  messages: params.messages,
  temperature: params.options.temperature,
  max_tokens: params.options.maxTokens,
  stream: true,
};

// Gemini (fallback for OCR/specialized)
// Only used for specific features like OCR
```

## Error Handling

```javascript
// 1. Try primary provider (based on mode)
// 2. If fails, try fallback (Ollama → Groq → Gemini)
// 3. If all fail, return user-friendly error

try {
  return await routeToProvider(params);
} catch (error) {
  if (params.mode === 'auto') {
    return await fallbackToAlternative(params);
  }
  throw error;
}
```

## Streaming Protocol

```javascript
// Both Ollama and Groq use SSE format:
// data: {"content": "chunk text"}\n\n
// data: [DONE]\n\n

// aiRouter normalizes responses:
{
  stream: ReadableStream,
  promise: Promise<string>,  // Full text after stream completes
}
```

## Files Modified

1. `src/lib/aiRouter.js` — NEW: The router module
2. `src/lib/ai.js` — UPDATE: Use aiRouter instead of direct fetch
3. `src/lib/chatApi.js` — UPDATE: Use aiRouter for chat completions
4. `src/store/appStore.js` — UPDATE: Add aiMode setting
5. `src/components/Settings.jsx` — NEW: Settings panel for mode selection

## Migration Path

### Phase 0 (Tauri Shell)
- Keep existing `/api/*` endpoints working
- Add aiRouter.js but don't use it yet

### Phase 1 (Local AI)
- Update ai.js to use aiRouter
- Update chatApi.js to use aiRouter
- Remove Supabase dependencies from chatApi
- Add Settings panel

### Phase 2 (Agent Mode)
- Extend aiRouter for agent-specific prompts
- Add context injection for project notes
