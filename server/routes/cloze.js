import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";

import { generateStructuredFromImage } from "../services/gemini.js";
import { questionSchema } from "../schema/questionSchema.js";
import { consumeAiCall, getAiCallsRemaining } from "../services/aiUsage.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Tránh tốn thêm lượt gọi khi người dùng bấm lại cùng một ảnh trong thời gian ngắn.
const recentResults = new Map();

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có ảnh.",
      });
    }

    const fingerprint = createHash("sha256").update(req.file.buffer).digest("hex");
    const cached = recentResults.get(fingerprint);
    if (cached) return res.json({ ...cached, aiCallsRemaining: getAiCallsRemaining() });

    const aiCallsRemaining = consumeAiCall();
    if (aiCallsRemaining === null) return res.status(429).json({ success: false, message: "Đã hết lượt AI dùng chung.", aiCallsRemaining: 0 });

    const result = await generateStructuredFromImage({
      file: req.file,
      maxOutputTokens: 10000,
      schema: questionSchema.schema,
      prompt: `Bạn là giảng viên Nội khoa biên soạn thẻ điền khuyết cho kỳ thi Bác sĩ Nội trú.

Đọc toàn bộ nội dung y khoa nhìn thấy trong ảnh. Chỉ dùng thông tin trong ảnh, không tự bổ sung dữ kiện ngoài tài liệu. Xác định chủ đề chính làm title và tạo thẻ cho từng ý quan trọng, không giới hạn số lượng cố định và không lặp ý.

Mỗi thẻ là câu ĐIỀN KHUYẾT: giữ nguyên câu gốc, chỉ che đúng một ý quan trọng nhất bằng _____. Đáp án phải ngắn, duy nhất và có thể điền chính xác vào chỗ trống. Không hỏi mở, không hỏi suy luận, không viết kiểu “là gì”, “hãy kể” hoặc “các biểu hiện”. Ưu tiên định nghĩa, tiêu chuẩn, phân loại, chỉ định, chống chỉ định, thuốc, liều, xét nghiệm và guideline. importance là số nguyên từ 1 đến 5. Trả đúng JSON theo schema.`,
    });

    const payload = {
      success: true,
      text: "",
      title: result.title,
      data: result.questions,
      aiCallsRemaining,
    };
    recentResults.set(fingerprint, payload);
    if (recentResults.size > 50) recentResults.delete(recentResults.keys().next().value);
    res.json(payload);
  } catch (error) {
    console.error(error);

    const status = error?.status === 429 ? 429 : 500;
    res.status(status).json({
      success: false,
      message: status === 429 ? "Gemini đã hết hạn mức hoặc đang quá tải. Vui lòng thử lại sau." : error.message,
    });
  }
});

export default router;
