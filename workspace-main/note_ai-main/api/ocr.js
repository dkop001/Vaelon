import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPPORTED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/bmp",
  "image/heic", "image/heif",
]);

const MAX_SIZE = 20 * 1024 * 1024;

const ocrPrompt = `Extract all text from this image. If the image contains:
- Handwritten text: extract it and note confidence
- Tables/grids: format as markdown tables
- Diagrams/flowcharts: provide a concise textual description
- Screenshots with code: format code in markdown code blocks
- Mixed content: extract everything

Return a JSON object with this structure:
{
  "text": "all extracted text content",
  "tables": ["markdown table 1", "markdown table 2"],
  "confidence": "high|medium|low",
  "language": "en"
}`;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";
    const boundary = contentType.split("boundary=")[1];
    if (!boundary) {
      return res.status(400).json({ error: "No multipart boundary found" });
    }

    // Parse multipart form data properly handling binary content
    const parts = buffer.toString("binary").split(`--${boundary}`);
    let fileBuffer = null;
    let fileMime = "";

    for (const part of parts) {
      if (part.includes("Content-Type:")) {
        const mimeMatch = part.match(/Content-Type:\s*(\S+)/);
        if (mimeMatch) fileMime = mimeMatch[1].split(";")[0].trim().toLowerCase();

        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          // Slice after header, and strip trailing \r\n--
          let body = part.slice(headerEnd + 4);
          // Remove trailing boundary markers and whitespace
          body = body.replace(/\r\n$/, "").replace(/--$/, "");
          if (body.length > 0) {
            fileBuffer = Buffer.from(body, "binary");
          }
        }
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: "No image file found in upload" });
    }

    if (!SUPPORTED_TYPES.has(fileMime) && !fileMime.startsWith("image/")) {
      return res.status(400).json({ error: "Unsupported image type. Supported: PNG, JPG, WEBP, BMP, HEIC" });
    }

    if (fileBuffer.length > MAX_SIZE) {
      return res.status(400).json({ error: "Image too large. Max 20 MB." });
    }

    // Convert HEIC/HEIF to JPEG using sharp for Gemini compatibility
    let processedBuffer = fileBuffer;
    let processedMime = fileMime;

    if (fileMime === "image/heic" || fileMime === "image/heif") {
      try {
        const sharp = (await import("sharp")).default;
        processedBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
        processedMime = "image/jpeg";
      } catch (sharpErr) {
        console.warn("sharp HEIC conversion failed, passing raw buffer:", sharpErr.message);
        // Fall back to raw buffer if sharp fails — Gemini may still handle it
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64Data = processedBuffer.toString("base64");
    const displayMime = processedMime || "image/jpeg";

    const result = await model.generateContent([
      { text: ocrPrompt },
      {
        inlineData: {
          mimeType: displayMime,
          data: base64Data,
        },
      },
    ]);

    const response = result.response;
    let responseText = response.text().trim();
    // Strip markdown code fences if Gemini wrapped response in ```json ... ```
    responseText = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { text: responseText, tables: [], confidence: "medium", language: "en" };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("OCR API Error:", error);
    return res.status(500).json({ error: "Failed to process image" });
  }
}
