import { GoogleGenerativeAI } from "@google/generative-ai";

const getQuizQuestionCount = (text) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 120) return 4;
  if (wordCount < 250) return 6;
  if (wordCount < 500) return 8;
  if (wordCount < 900) return 10;
  return 12;
};

const normalizeQuizData = (quizData, questionCount) => {
  if (!Array.isArray(quizData)) {
    throw new Error("Quiz response was not an array.");
  }

  return quizData
    .filter((item) => (
      item &&
      typeof item.question === "string" &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      Number.isInteger(item.correctAnswerIndex) &&
      item.correctAnswerIndex >= 0 &&
      item.correctAnswerIndex <= 3
    ))
    .slice(0, questionCount);
};

const buildQuizPrompt = (text, questionCount) => `
You are an expert educator. Create an engaging multiple-choice quiz based on the following text.
The quiz length has already been chosen based on the size and density of the topic.
Return EXACTLY a JSON array of ${questionCount} objects, where each object represents one question.

Follow this exact JSON structure:
[
  {
    "question": "What is the main topic?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0
  }
]

Make sure "correctAnswerIndex" is an integer from 0 to 3 that corresponds to the correct option.
Cover the most important ideas across the whole text. For longer texts, include a mix of main concepts, supporting details, and practical implications.
Avoid repeating the same concept in multiple questions.
Do not include any markdown formatting, only valid JSON.

TEXT TO BASE QUIZ ON:
${text}
`;

const parseQuizResponse = (responseText, questionCount) => {
  const quizData = normalizeQuizData(JSON.parse(responseText), questionCount);

  if (quizData.length === 0) {
    throw new Error("No valid quiz questions returned.");
  }

  return quizData;
};

const generateQuizWithGroq = async (text, questionCount) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `${buildQuizPrompt(text, questionCount)}

For JSON mode, return a JSON object with one key named "quiz". The value of "quiz" must be the quiz array described above.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1400,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Groq returned an empty quiz");
  }

  const parsedContent = JSON.parse(content);
  const rawQuiz = Array.isArray(parsedContent) ? parsedContent : parsedContent.quiz;

  if (!rawQuiz) {
    throw new Error("Groq returned JSON without a quiz array");
  }

  return parseQuizResponse(JSON.stringify(rawQuiz), questionCount);
};

const generateQuizWithGemini = async (text, questionCount) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const result = await model.generateContent(buildQuizPrompt(text, questionCount));

  return parseQuizResponse(result.response.text(), questionCount);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { text } = req.body;

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: "Text too short to generate a quiz.",
      });
    }

    const questionCount = getQuizQuestionCount(text);

    try {
      const quizData = await generateQuizWithGroq(text, questionCount);

      return res.status(200).json({
        quiz: quizData,
        questionCount: quizData.length,
      });
    } catch (groqError) {
      console.error("Groq API Error (Quiz):", groqError);
    }

    const quizData = await generateQuizWithGemini(text, questionCount);

    return res.status(200).json({
      quiz: quizData,
      questionCount: quizData.length,
    });

  } catch (error) {
    console.error("Quiz API Error:", error);

    return res.status(500).json({
      error: "Failed to generate quiz",
    });
  }
}
