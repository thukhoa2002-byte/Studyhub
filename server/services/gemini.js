const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY. Hãy thêm biến môi trường này trên Render.");
  }
  return apiKey;
}

function extractResponseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part?.text ?? "").join("").trim();
  if (text) return text;

  const reason = payload?.promptFeedback?.blockReason;
  if (reason) throw new Error(`Gemini đã từ chối nội dung (${reason}).`);
  throw new Error("Gemini không trả về nội dung.");
}

export async function generateStructuredFromImage({ file, prompt, schema, maxOutputTokens = 12000 }) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(
      `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": getApiKey(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: file.buffer.toString("base64"),
                },
              },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            maxOutputTokens,
            temperature: 0.2,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const apiMessage = payload?.error?.message;
      const error = new Error(apiMessage || `Gemini API lỗi ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    return JSON.parse(extractResponseText(payload));
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Gemini xử lý quá lâu. Vui lòng thử lại với ảnh nhỏ hơn.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

