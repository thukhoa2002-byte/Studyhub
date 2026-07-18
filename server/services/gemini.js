import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta";
const FILE_API_THRESHOLD_BYTES = 14 * 1024 * 1024;
const GENERATION_RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY. Hãy thêm biến môi trường này trên Render.");
  }
  return apiKey;
}

function extractResponseText(payload) {
  const finishReason = payload?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new Error("Tài liệu quá dài nên đầu ra AI đã chạm giới hạn. Hãy chia PDF thành các phần nhỏ hơn theo chương.");
  }
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part?.text ?? "").join("").trim();
  if (text) return text;

  const reason = payload?.promptFeedback?.blockReason;
  if (reason) throw new Error(`Gemini đã từ chối nội dung (${reason}).`);
  throw new Error(`Gemini không trả về nội dung${finishReason ? ` (finishReason: ${finishReason})` : ""}.`);
}

function parseGeneratedJson(payload) {
  const text = extractResponseText(payload);
  try { return JSON.parse(text); }
  catch {
    const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(unfenced);
  }
}

function createApiError(response, payload, fallback) {
  const apiMessage = String(payload?.error?.message || `Gemini API lỗi ${response.status}.`);
  const message = /high demand|temporarily unavailable|overloaded|resource exhausted/i.test(apiMessage)
    ? "Gemini đang quá tải tạm thời sau khi đã tự thử lại. Vui lòng thử lại sau ít phút."
    : fallback ? `${fallback} ${apiMessage}` : apiMessage;
  const error = new Error(message);
  error.status = response.status;
  return error;
}

function shouldRetryWithoutSchema(response, payload) {
  if (response.status !== 400) return false;
  const message = String(payload?.error?.message || "");
  return /invalid argument|schema|response.*json/i.test(message);
}

function shouldRetryWithCompatibleOutputLimit(response, payload) {
  if (response.status !== 400) return false;
  return /invalid argument/i.test(String(payload?.error?.message || ""));
}

async function requestGeneration({ model, apiKey, signal, prompt, mediaParts, schema, maxOutputTokens, useSchema, useJsonMode = true, useOutputLimit = true }) {
  const generationConfig = {
    temperature: 0.2,
  };
  if (useJsonMode) generationConfig.responseMimeType = "application/json";
  if (useOutputLimit) generationConfig.maxOutputTokens = maxOutputTokens;
  if (useSchema) generationConfig.responseJsonSchema = schema;

  const response = await fetch(
    `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal,
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            ...mediaParts,
          ],
        }],
        generationConfig,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function shouldRetryGeneration(response, payload) {
  if (![429, 500, 502, 503].includes(response.status)) return false;
  const message = String(payload?.error?.message || "");
  return /high demand|temporarily unavailable|overloaded|resource exhausted|internal error|unavailable/i.test(message) || response.status !== 429;
}

async function requestGenerationWithRetries(input) {
  let result;
  for (let attempt = 0; attempt <= GENERATION_RETRY_DELAYS_MS.length; attempt += 1) {
    result = await requestGeneration(input);
    if (result.response.ok || !shouldRetryGeneration(result.response, result.payload) || attempt === GENERATION_RETRY_DELAYS_MS.length) return result;
    const delay = GENERATION_RETRY_DELAYS_MS[attempt];
    console.warn(`Gemini is temporarily busy; retrying generation in ${delay}ms (attempt ${attempt + 1}).`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return result;
}

async function uploadGeminiFile(inputFile, apiKey, signal) {
  const inputSize = inputFile.size ?? inputFile.buffer?.length ?? 0;
  const startResponse = await fetch(`${GEMINI_UPLOAD_ROOT}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(inputSize),
      "X-Goog-Upload-Header-Content-Type": inputFile.mimetype,
    },
    signal,
    body: JSON.stringify({ file: { display_name: inputFile.originalname || "guideline.pdf" } }),
  });
  const startPayload = await startResponse.json().catch(() => null);
  if (!startResponse.ok) throw createApiError(startResponse, startPayload, "Không thể bắt đầu tải PDF lên Gemini.");

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini không trả về địa chỉ tải file tạm.");

  const uploadOptions = {
    method: "POST",
    headers: {
      "Content-Type": inputFile.mimetype,
      "Content-Length": String(inputSize),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    signal,
    body: inputFile.path ? createReadStream(inputFile.path) : inputFile.buffer,
  };
  if (inputFile.path) uploadOptions.duplex = "half";
  const uploadResponse = await fetch(uploadUrl, uploadOptions);
  const uploadPayload = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok) throw createApiError(uploadResponse, uploadPayload, "Không thể tải PDF lên Gemini.");
  let remoteFile = uploadPayload?.file || uploadPayload;

  while (remoteFile?.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const statusResponse = await fetch(`${GEMINI_API_ROOT}/${remoteFile.name}`, {
      headers: { "x-goog-api-key": apiKey },
      signal,
    });
    const statusPayload = await statusResponse.json().catch(() => null);
    if (!statusResponse.ok) throw createApiError(statusResponse, statusPayload, "Không thể kiểm tra trạng thái PDF trên Gemini.");
    remoteFile = statusPayload?.file || statusPayload;
  }

  if (remoteFile?.state === "FAILED") throw new Error("Gemini không thể xử lý PDF đã tải lên.");
  if (!remoteFile?.name || !remoteFile?.uri) throw new Error("Gemini không trả về file PDF hợp lệ.");
  return remoteFile;
}

async function deleteGeminiFile(fileName, apiKey) {
  if (!fileName) return;
  await fetch(`${GEMINI_API_ROOT}/${fileName}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": apiKey },
  }).catch(() => null);
}

export async function generateStructuredFromFile({ file, files, prompt, schema, maxOutputTokens = 12000, timeoutMs = 90_000 }) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const inputFiles = files?.length ? files : file ? [file] : [];
  if (inputFiles.length === 0) throw new Error("Không có file để Gemini xử lý.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const apiKey = getApiKey();
  const uploadedFileNames = [];

  try {
    const totalBytes = inputFiles.reduce((sum, inputFile) => sum + (inputFile.size ?? inputFile.buffer?.length ?? 0), 0);
    const useFilesApi = totalBytes > FILE_API_THRESHOLD_BYTES;
    const mediaParts = [];
    for (const [index, inputFile] of inputFiles.entries()) {
      if (inputFiles.length > 1) {
        mediaParts.push({ text: `TÀI LIỆU NGUỒN ${index + 1} — ${inputFile.originalname || "không có tên"}` });
      }
      if (useFilesApi) {
        const remoteFile = await uploadGeminiFile(inputFile, apiKey, controller.signal);
        uploadedFileNames.push(remoteFile.name);
        mediaParts.push({
          fileData: {
            mimeType: remoteFile.mimeType || remoteFile.mime_type || inputFile.mimetype,
            fileUri: remoteFile.uri,
          },
        });
      } else {
        const inputBuffer = inputFile.buffer || await readFile(inputFile.path);
        mediaParts.push({
          inlineData: {
            mimeType: inputFile.mimetype,
            data: inputBuffer.toString("base64"),
          },
        });
      }
    }

    let { response, payload } = await requestGenerationWithRetries({
      model,
      apiKey,
      signal: controller.signal,
      prompt,
      mediaParts,
      schema,
      maxOutputTokens,
      useSchema: true,
    });
    if (!response.ok && shouldRetryWithoutSchema(response, payload)) {
      console.warn("Gemini rejected responseJsonSchema; retrying in JSON mode without a server schema.");
      ({ response, payload } = await requestGenerationWithRetries({
        model,
        apiKey,
        signal: controller.signal,
        prompt,
        mediaParts,
        schema,
        maxOutputTokens,
        useSchema: false,
      }));
    }
    if (!response.ok && shouldRetryWithCompatibleOutputLimit(response, payload)) {
      console.warn("Gemini rejected the requested output limit; retrying with a compatible 8192-token JSON response.");
      ({ response, payload } = await requestGenerationWithRetries({
        model,
        apiKey,
        signal: controller.signal,
        prompt,
        mediaParts,
        schema,
        maxOutputTokens: Math.min(maxOutputTokens, 8192),
        useSchema: false,
      }));
    }
    if (!response.ok && shouldRetryWithCompatibleOutputLimit(response, payload)) {
      console.warn("Gemini rejected JSON response mode; retrying with a plain response while the prompt still requires JSON.");
      ({ response, payload } = await requestGenerationWithRetries({
        model,
        apiKey,
        signal: controller.signal,
        prompt,
        mediaParts,
        schema,
        maxOutputTokens: Math.min(maxOutputTokens, 8192),
        useSchema: false,
        useJsonMode: false,
      }));
    }
    if (!response.ok && shouldRetryWithCompatibleOutputLimit(response, payload)) {
      console.warn("Gemini rejected the output configuration; retrying with a bare generation request.");
      ({ response, payload } = await requestGenerationWithRetries({
        model,
        apiKey,
        signal: controller.signal,
        prompt,
        mediaParts,
        schema,
        maxOutputTokens: 0,
        useSchema: false,
        useJsonMode: false,
        useOutputLimit: false,
      }));
    }
    if (!response.ok) {
      throw createApiError(response, payload);
    }

    try {
      return parseGeneratedJson(payload);
    } catch (error) {
      if (!/Gemini không trả về nội dung/i.test(error?.message || "")) throw error;
      console.warn("Gemini returned an empty candidate; retrying without response schema.");
      ({ response, payload } = await requestGenerationWithRetries({
        model,
        apiKey,
        signal: controller.signal,
        prompt,
        mediaParts,
        schema,
        maxOutputTokens: Math.min(maxOutputTokens, 8192),
        useSchema: false,
        useJsonMode: true,
      }));
      if (!response.ok) throw createApiError(response, payload);
      return parseGeneratedJson(payload);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Gemini xử lý quá lâu. Vui lòng thử lại với file nhỏ hơn hoặc chọn phạm vi trích xuất hẹp hơn.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await Promise.allSettled(uploadedFileNames.map((fileName) => deleteGeminiFile(fileName, apiKey)));
  }
}

export const generateStructuredFromImage = generateStructuredFromFile;
