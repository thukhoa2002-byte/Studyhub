import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";

import { extractTextFromImage } from "../services/ocr.js";
import { generateQuestions } from "../services/question.js";

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
    if (cached) return res.json(cached);

    const text = await extractTextFromImage(req.file);

    const result = await generateQuestions(text);

    const payload = {
      success: true,
      text,
      title: result.title,
      data: result.questions,
    };
    recentResults.set(fingerprint, payload);
    if (recentResults.size > 50) recentResults.delete(recentResults.keys().next().value);
    res.json(payload);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
