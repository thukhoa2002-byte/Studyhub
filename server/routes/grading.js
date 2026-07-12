import express from "express";
import { gradeAnswer } from "../services/grading.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { question, answer, userAnswer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu.",
      });
    }

    const result = await gradeAnswer(
      question,
      answer,
      userAnswer ?? ""
    );

    res.json({
      success: true,
      data: result,
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