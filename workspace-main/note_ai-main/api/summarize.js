import { GoogleGenerativeAI } from "@google/generative-ai";

const buildSummaryPrompt = (text) => `
You are an expert note summarizer.

Summarize the following notes into a clean, concise, and easy-to-read format.

Follow this exact structure:

# Short Catchy Title

## Key Points
- Important point
- Important point
- Important point

## Quick Summary
Write a short paragraph (3-5 lines max).

Rules:
- Keep it concise
- Remove slang/emojis/repetition
- Preserve meaning
- Max 200 words

NOTES:
${text}
`;

const summarizeWithGemini = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const result = await model.generateContent(buildSummaryPrompt(text));
  const summary = result.response.text().trim();

  if (!summary) {
    throw new Error("Gemini returned an empty summary");
  }

  return summary;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { text } = req.body;

  if (!text || text.trim().length < 10) {
    return res.status(400).json({
      error: "Text too short",
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Disable buffering for nginx/proxies
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // Tell client to start listening

  try {
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
        messages: [
          {
            role: "user",
            content: buildSummaryPrompt(text),
          },
        ],
        temperature: 0.2,
        max_tokens: 450,
        stream: true, // Enable streaming
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with ${response.status}`);
    }

    if (!response.body) throw new Error("No readable stream in response");

    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0].delta.content) {
              const content = data.choices[0].delta.content;
              // Send chunk as SSE
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
            console.error("Parse error on chunk:", e);
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (groqError) {
    console.error("Groq API Error, falling back to Gemini:", groqError);

    try {
      // Fallback to Gemini (non-streamed, but sent as single SSE chunk)
      const summary = await summarizeWithGemini(text);
      res.write(`data: ${JSON.stringify({ content: summary })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (geminiError) {
      console.error("Summary API Error (Gemini fallback):", geminiError);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate summary" })}\n\n`);
      res.end();
    }
  }
}
