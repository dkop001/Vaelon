const MAX_TEXT_LENGTH = 4000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, voice = "alloy" } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: "Text too long. Max 4000 characters." });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!openAiKey && !elevenLabsKey) {
    return res.status(500).json({ error: "No TTS API keys configured" });
  }

  try {
    if (openAiKey) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS request failed with ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.byteLength);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(Buffer.from(audioBuffer));
    }

    if (elevenLabsKey) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice === "alloy" ? "21m00Tcm4TlvDq8ikWAM" : "21m00Tcm4TlvDq8ikWAM"}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.5 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS request failed with ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.byteLength);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(Buffer.from(audioBuffer));
    }

    return res.status(500).json({ error: "No TTS provider available" });
  } catch (error) {
    console.error("TTS API Error:", error);
    return res.status(500).json({ error: "Failed to generate speech" });
  }
}
