// ── Vaelon AI Router Adapter ──────────────────────────────────────────────
// Adapts the legacy JS aiRouter API surface to call the Rust core LLM commands.

import { api } from '../ipc/client';

export async function complete({ messages, options = {}, onChunk, stream = true }) {
  if (stream) {
    const sessionId = options.sessionId || Math.random().toString();
    
    // Listen for chunks
    const listenName = 'llm:chunk';
    let unsub = () => {};
    
    const promise = new Promise(async (resolve, reject) => {
      let accumulated = '';
      
      const setupListener = async () => {
        const { listen } = await import('@tauri-apps/api/event');
        unsub = await listen(listenName, (ev) => {
          const payload = ev.payload;
          if (payload && payload.session_id === sessionId) {
            accumulated += payload.content;
            if (onChunk) onChunk(payload.content, accumulated);
          }
        });
      };
      
      await setupListener();

      const { listen: listenDone } = await import('@tauri-apps/api/event');
      const unsubDone = await listenDone('llm:done', (ev) => {
        const payload = ev.payload;
        if (payload && payload.session_id === sessionId) {
          unsub();
          unsubDone();
          resolve(payload.full_content);
        }
      });

      try {
        await api.llmCompleteStreaming(
          messages,
          sessionId,
          options.temperature,
          options.maxTokens,
          options.jsonMode
        );
      } catch (err) {
        unsub();
        unsubDone();
        reject(err);
      }
    });

    return promise;
  } else {
    return await api.llmComplete(
      messages,
      options.temperature,
      options.maxTokens,
      options.jsonMode
    );
  }
}

export async function summarize(text, onChunk) {
  const messages = [
    { role: 'system', content: 'Summarize the following text in 3 concise, clear bullet points.' },
    { role: 'user', content: text.slice(0, 4000) },
  ];
  return complete({
    messages,
    options: { temperature: 0.3, maxTokens: 250, sessionId: 'summary' },
    onChunk,
    stream: true,
  });
}

export async function generateQuiz(text) {
  const messages = [
    {
      role: 'system',
      content: 'Generate a JSON array containing 3 multiple choice questions based on the text. Return ONLY the JSON array, no formatting, no markdown code block backticks. Structure: [{"question":"...","options":["A","B","C","D"],"correctAnswerIndex":0}]',
    },
    { role: 'user', content: text.slice(0, 4000) },
  ];

  const result = await api.llmComplete(messages, 0.2, 800, true);

  let jsonStr = result.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  const parsed = JSON.parse(jsonStr);
  return Array.isArray(parsed) ? parsed : [];
}

export async function chat(userMessage, context, history = [], onChunk) {
  const truncatedContext = (context || '').slice(0, 1000);
  const messages = [
    { role: 'system', content: `You are a helpful AI assistant. Context: ${truncatedContext || 'none'}` },
    ...history.slice(-4).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: (m.content || m.text || '').slice(0, 400),
    })),
    { role: 'user', content: userMessage },
  ];
  return complete({
    messages,
    options: { temperature: 0.4, maxTokens: 500, sessionId: 'chat' },
    onChunk,
    stream: true,
  });
}
