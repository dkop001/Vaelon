import { neon } from "@neondatabase/serverless";

const buildSystemPrompt = (noteText, memorySummary) => {
  let prompt = `You are a helpful AI assistant answering questions about a user's notes.

CONTEXT — The user's original notes:
"""
${noteText}
"""`;

  if (memorySummary) {
    prompt += `\n\nPREVIOUS CONVERSATION SUMMARY (compressed history):
"""
${memorySummary}
"""`;
  }

  prompt += `\n\nAnswer the user's question based on their notes. Be concise and helpful. If asked something not covered in the notes, say so politely.`;

  return prompt;
};

const saveMessages = async (sql, sessionId, userMessage, aiResponse) => {
  await sql(
    `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
    [sessionId, userMessage, aiResponse]
  );
  await sql(
    `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId]
  );
};

const getOrCreateSession = async (sql, userId, noteId) => {
  let result = await sql(
    `SELECT id FROM chat_sessions WHERE user_id = $1 AND note_id = $2 ORDER BY updated_at DESC LIMIT 1`,
    [userId, noteId]
  );

  if (result.length === 0) {
    result = await sql(
      `INSERT INTO chat_sessions (user_id, note_id) VALUES ($1, $2) RETURNING id`,
      [userId, noteId]
    );
  }

  return result[0].id;
};

const getRecentMessages = async (sql, sessionId, limit = 20) => {
  const messages = await sql(
    `SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [sessionId, limit]
  );
  return messages;
};

const getChatMemory = async (sql, userId, noteId) => {
  const result = await sql(
    `SELECT summary FROM chat_memory WHERE user_id = $1 AND note_id = $2`,
    [userId, noteId]
  );
  return result.length > 0 ? result[0].summary : null;
};

const streamWithGroq = async (res, messages) => {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("GROQ_API_KEY is missing");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.3,
      max_tokens: 600,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with ${response.status}`);
  }

  if (!response.body) throw new Error("No readable stream in response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.choices[0].delta.content) {
            const content = data.choices[0].delta.content;
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  res.write("data: [DONE]\n\n");
  return fullContent;
};

const streamWithGemini = async (res, messages) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const systemMsg = messages.find(m => m.role === "system");
  const userMsg = messages.find(m => m.role === "user");
  const historyMsgs = messages.filter(m => m.role !== "system" && m.role !== "user");

  const chat = model.startChat({
    systemInstruction: systemMsg?.content,
    history: historyMsgs.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessage(userMsg.content);
  const text = result.response.text().trim();
  res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
  res.write("data: [DONE]\n\n");
  return text;
};

const compressHistory = async (sql, userId, noteId, noteText) => {
  const sessionId = await getOrCreateSession(sql, userId, noteId);
  const messages = await sql(
    `SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  if (messages.length === 0) return null;

  const formattedHistory = messages.map(m => `${m.role}: ${m.content}`).join("\n");
  const prompt = `Compress the following conversation history between a user and an AI assistant about their notes into a concise summary. Maintain all key facts, contexts, and details.

Notes:
${noteText || ""}

History:
${formattedHistory}`;

  let summary = "";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      summary = result.response.text().trim();
    }
  } catch (e) {
    console.error("Compression error:", e);
  }

  if (summary) {
    await sql(
      `INSERT INTO chat_memory (user_id, note_id, summary, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, note_id)
       DO UPDATE SET summary = EXCLUDED.summary, updated_at = now()`,
      [userId, noteId, summary]
    );
  }
  return summary;
};

export default async function handler(req, res) {
  const databaseUrl = process.env.DATABASE_URL;

  if (req.method === "GET") {
    const { userId, noteId } = req.query;
    if (!userId || !noteId) {
      return res.status(400).json({ error: "Missing required query parameters: userId, noteId" });
    }
    if (!databaseUrl) {
      return res.status(200).json([]);
    }
    try {
      const sql = neon(databaseUrl);
      const sessionId = await getOrCreateSession(sql, userId, noteId);
      const messages = await getRecentMessages(sql, sessionId, 20);
      return res.status(200).json(messages);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      return res.status(500).json({ error: "Failed to fetch chat history" });
    }
  }

  if (req.method === "DELETE") {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId for deletion" });
    }
    if (!databaseUrl) {
      return res.status(200).json({ success: true });
    }
    try {
      const sql = neon(databaseUrl);
      await sql(`DELETE FROM chat_sessions WHERE user_id = $1`, [userId]);
      return res.status(200).json({ success: true, message: "User chat sessions and messages deleted successfully" });
    } catch (error) {
      console.error("Failed to delete user chat sessions:", error);
      return res.status(500).json({ error: "Failed to perform GDPR deletion" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, noteId, message, history, noteText, action } = req.body;

  if (!userId || !noteId) {
    return res.status(400).json({ error: "Missing required fields: userId, noteId" });
  }

  // Handle explicit compression request (e.g. on note close)
  if (action === "compress") {
    if (!databaseUrl) {
      return res.status(200).json({ success: true });
    }
    try {
      const sql = neon(databaseUrl);
      const summary = await compressHistory(sql, userId, noteId, noteText);
      return res.status(200).json({ success: true, summary });
    } catch (error) {
      console.error("Explicit compression failed:", error);
      return res.status(500).json({ error: "Failed to compress history" });
    }
  }

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    let memorySummary = null;
    let sessionId = null;

    if (databaseUrl) {
      const sql = neon(databaseUrl);
      sessionId = await getOrCreateSession(sql, userId, noteId);
      memorySummary = await getChatMemory(sql, userId, noteId);
    }

    const systemPrompt = buildSystemPrompt(noteText || "", memorySummary);

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    let fullResponse;

    try {
      fullResponse = await streamWithGroq(res, chatMessages);
    } catch (groqError) {
      console.error("Groq chat error, falling back to Gemini:", groqError);
      fullResponse = await streamWithGemini(res, chatMessages);
    }

    res.end();

    if (databaseUrl && sessionId) {
      try {
        const sql = neon(databaseUrl);
        await saveMessages(sql, sessionId, message, fullResponse);

        // Check if messages count is multiple of 30
        const countResult = await sql(`SELECT COUNT(*) as count FROM chat_messages WHERE session_id = $1`, [sessionId]);
        const count = parseInt(countResult[0].count, 10);
        if (count > 0 && count % 30 === 0) {
          compressHistory(sql, userId, noteId, noteText || "").catch(console.error);
        }
      } catch (dbError) {
        console.error("Failed to save chat messages:", dbError);
      }
    }
  } catch (error) {
    console.error("Chat API Error:", error);
    res.write(`data: ${JSON.stringify({ error: "Failed to process chat message" })}\n\n`);
    res.end();
  }
}

