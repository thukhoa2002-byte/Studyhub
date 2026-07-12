import express from "express";
import multer from "multer";

import { extractTextFromImage } from "../services/ocr.js";
import { generateQuestions } from "../services/question.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có ảnh.",
      });
    }

    const text = await extractTextFromImage(req.file);

    const result = await generateQuestions(text);

    res.json({
      success: true,
      text,
      title: result.title,
      data: result.questions,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;