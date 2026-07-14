import express from "express";
import multer from "multer";

import { importAnkiPackage } from "../services/anki.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024,
  },
});

router.post("/", upload.single("deck"), async (req, res) => {
  try {
    const result = await importAnkiPackage(req.file);

    res.json({
      success: true,
      title: result.title,
      data: result.questions,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
