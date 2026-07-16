const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta";
const FILE_API_THRESHOLD_BYTES = 14 * 1024 * 1024;

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
    throw new Error("Tài liệu có quá nhiều bảng nên đầu ra AI đã chạm giới hạn. Hãy chia guideline thành các PDF nhỏ hơn theo chương.");
  }
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part?.text ?? "").join("").trim();
  if (text) return text;

  const reason = payload?.promptFeedback?.blockReason;
  if (reason) throw new Error(`Gemini đã từ chối nội dung (${reason}).`);
  throw new Error("Gemini không trả về nội dung.");
}

function createApiError(response, payload, fallback) {
  const error = new Error(payload?.error?.message || fallback || `Gemini API lỗi ${response.status}.`);
  error.status = response.status;
  return error;
}

async function uploadGeminiFile(inputFile, apiKey, signal) {
  const startResponse = await fetch(`${GEMINI_UPLOAD_ROOT}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(inputFile.buffer.length),
      "X-Goog-Upload-Header-Content-Type": inputFile.mimetype,
    },
    signal,
    body: JSON.stringify({ file: { display_name: inputFile.originalname || "guideline.pdf" } }),
  });
  const startPayload = await startResponse.json().catch(() => null);
  if (!startResponse.ok) throw createApiError(startResponse, startPayload, "Không thể bắt đầu tải PDF lên Gemini.");

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini không trả về địa chỉ tải file tạm.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": inputFile.mimetype,
      "Content-Length": String(inputFile.buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    signal,
    body: inputFile.buffer,
  });
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
    const totalBytes = inputFiles.reduce((sum, inputFile) => sum + inputFile.buffer.length, 0);
    const useFilesApi = totalBytes > FILE_API_THRESHOLD_BYTES;
    const mediaParts = [];
    for (const [index, inputFile] of inputFiles.entries()) {
      if (inputFiles.length > 1) {
        mediaParts.push({ text: index === 0 ? "TÀI LIỆU 1 — GUIDELINE CHÍNH" : `TÀI LIỆU ${index + 1} — SUPPLEMENTARY DATA` });
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
        mediaParts.push({
          inlineData: {
            mimeType: inputFile.mimetype,
            data: inputFile.buffer.toString("base64"),
          },
        });
      }
    }

    const response = await fetch(
      `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              ...mediaParts,
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
      throw createApiError(response, payload);
    }

    return JSON.parse(extractResponseText(payload));
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
