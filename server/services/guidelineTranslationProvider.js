import OpenAI from "openai";
import { generateStructuredFromFile } from "./gemini.js";

function openAIClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Thiếu OPENAI_API_KEY. Không thể dùng OpenAI cho phiên dịch này.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseJson(content) {
  const value = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(value);
}

export function isProviderQuotaError(error) {
  const status = Number(error?.status || error?.statusCode);
  return status === 429 || /quota|rate limit|resource exhausted|too many requests|limit:\s*\d+/i.test(String(error?.message || ""));
}

export async function generateGuidelineStructured({ provider, file, prompt, schema, maxOutputTokens, timeoutMs }) {
  if (provider !== "openai") return generateStructuredFromFile({ file, prompt, schema, maxOutputTokens, timeoutMs });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await openAIClient().chat.completions.create({
      model: process.env.OPENAI_GUIDELINE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return valid JSON only. Follow the supplied JSON schema and do not invent source content." },
        { role: "user", content: `${prompt}\n\nJSON schema:\n${JSON.stringify(schema)}` },
      ],
      max_tokens: Math.min(maxOutputTokens, 16_000),
      signal: controller.signal,
    });
    return parseJson(response.choices?.[0]?.message?.content);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("OpenAI xử lý quá lâu. Hãy thử lại với phạm vi hẹp hơn.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
